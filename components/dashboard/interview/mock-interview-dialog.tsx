"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Headphones,
  History,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Repeat2,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  recordingSupported,
  speechRecognitionSupported,
  useInterviewVoice,
  useMicCheck,
  useServerTranscription,
  useSpeechRecognition,
  type RecognitionError,
} from "./speech";
import { MockInterviewReport, scoreTone } from "./mock-interview-report";
import {
  DEFAULT_SPEECH_LOCALE,
  isSpeechLocale,
  SPEECH_LOCALES,
  speechLocaleFor,
  speechLocaleLabel,
} from "@/lib/speech-locales";
import type { InterviewJob, MockAnswer, MockOverview, MockSession } from "./types";

type Phase = "lobby" | "starting" | "call" | "wrapping" | "report";
type Stage = "speaking" | "answering" | "saving";
type AnswerMode = "voice" | "type";

// The same bands the server pitches questions at (experienceLevel in
// lib/server/interview.js), so the lobby can say what a choice means.
const levelLabel = (years: number | null) => {
  if (years === null) return "Mid-level";
  if (years <= 1) return "Entry level";
  if (years <= 4) return "Early career";
  if (years <= 8) return "Mid-senior";
  if (years <= 14) return "Senior / lead";
  return "Principal / leadership";
};

const EXPERIENCE_OPTIONS = [
  { value: "0", label: "Less than a year" },
  ...Array.from({ length: 20 }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1} year${index ? "s" : ""}`,
  })),
  { value: "25", label: "More than 20 years" },
];

const RECOGNITION_MESSAGES: Record<RecognitionError, string> = {
  blocked: "Microphone access is blocked, so you can type your answers instead. To speak, allow the microphone for this site in your browser settings.",
  "no-mic": "No microphone was found. You can type your answers instead.",
  network: "Speech recognition lost its connection. You can type this answer, or try your voice again.",
  unavailable: "Speech recognition stopped working in this browser. You can type your answers instead.",
  transcription: "We couldn't transcribe that just now. You can type this answer, or try your voice again.",
};

// How spoken answers become text: recorded and transcribed by the server
// (accurate on the job's vocabulary), or by the browser's own recognizer
// (free; the fallback, and the only kind when the server's is switched off).
type CaptureMode = "openai" | "browser";

// The accent answers are transcribed in follows the visitor's location. One
// they pick themselves is kept on the device and wins from then on: someone
// abroad, or on a VPN, shouldn't have to correct it before every interview.
const ACCENT_KEY = "syncv:mock-interview:accent";
const savedSpeechLocale = () => {
  try {
    const value = window.localStorage.getItem(ACCENT_KEY);
    return value && isSpeechLocale(value) ? value : null;
  } catch {
    return null;
  }
};
const saveSpeechLocale = (code: string) => {
  try {
    window.localStorage.setItem(ACCENT_KEY, code);
  } catch {
    // Not remembered; the choice still holds for this interview.
  }
};
const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
};

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const wordCount = (text: string) => (text.match(/\S+/g) || []).length;

const readJson = async (response: Response) => {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Something went wrong. Please try again.");
  }
  return result;
};

type MockInterviewDialogProps = {
  job: InterviewJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Told when an interview starts: every start counts towards the job's limit. */
  onStarted?: (jobId: string) => void;
  /** Told when an interview is scored, so the tracker row can show it. */
  onCompleted?: (jobId: string, score: number) => void;
};

export const MockInterviewDialog = ({
  job,
  open,
  onOpenChange,
  onStarted,
  onCompleted,
}: MockInterviewDialogProps) => {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [overview, setOverview] = useState<MockOverview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [experience, setExperience] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("voice");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"openai" | "browser">("openai");
  const [session, setSession] = useState<MockSession | null>(null);
  const [report, setReport] = useState<MockSession | null>(null);
  const [reportFromLobby, setReportFromLobby] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("speaking");
  const [answers, setAnswers] = useState<MockAnswer[]>([]);
  const [callStartedAt, setCallStartedAt] = useState(0);
  const [answerStartedAt, setAnswerStartedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notice, setNotice] = useState("");
  const [speechLocale, setSpeechLocale] = useState<string>(DEFAULT_SPEECH_LOCALE);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("browser");

  const voice = useInterviewVoice({ sessionId: session?.id ?? null, mode: voiceMode });
  // Both are mounted so an interview can drop from the server's transcription
  // to the browser's mid-answer; only the one in use ever holds the microphone.
  const browserCapture = useSpeechRecognition(speechLocale);
  const serverCapture = useServerTranscription({ sessionId: session?.id ?? null });
  const recognition = captureMode === "openai" ? serverCapture : browserCapture;
  const mic = useMicCheck();

  const answersRef = useRef<MockAnswer[]>([]);
  const answerModeRef = useRef<AnswerMode>("voice");
  answerModeRef.current = answerMode;
  const pendingFirstQuestionRef = useRef(false);
  // Bumped whenever the dialog opens or closes. A request that returns after
  // that (starting, scoring) belongs to a visit that is over and is ignored,
  // so a late reply can't start an interview in a closed dialog.
  const visitRef = useRef(0);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
  const jobId = job?.id || "";

  /** Which kind of transcription this browser can do, given what the server offers. */
  const chooseCapture = useCallback((offered: CaptureMode) => {
    const mode: CaptureMode = offered === "openai" && recordingSupported() ? "openai" : "browser";
    const canSpeak = mode === "openai" || speechRecognitionSupported();
    setCaptureMode(mode);
    setSpeechSupported(canSpeak);
    return canSpeak;
  }, []);

  const loadOverview = useCallback(async () => {
    if (!jobId) return;
    setOverviewError("");
    try {
      const result = await readJson(await authedFetch(`/api/interview/mock?jobId=${encodeURIComponent(jobId)}`));
      const data = result as MockOverview & { success: boolean };
      setOverview(data);
      setVoiceMode(data.voice);
      if (!chooseCapture(data.transcription)) setAnswerMode("type");
      setSpeechLocale(
        savedSpeechLocale() ||
          speechLocaleFor({ country: data.country, timeZone: deviceTimeZone() })
      );
      setExperience((current) =>
        current !== "" ? current : data.candidate.experienceYears === null ? "" : String(Math.min(25, data.candidate.experienceYears))
      );
    } catch (reason) {
      setOverviewError(reason instanceof Error ? reason.message : "Couldn't load your mock interview.");
    }
  }, [jobId, chooseCapture]);

  // Every open starts in the lobby; closing tears the call down completely.
  useEffect(() => {
    if (!open) return;
    setPhase("lobby");
    setOverview(null);
    setExperience("");
    setReport(null);
    setSession(null);
    setError("");
    setNotice("");
    setConfirmEnd(false);
    setAnswerMode("voice");
    loadOverview();
  }, [open, loadOverview]);

  const teardown = useCallback(() => {
    voice.stop();
    browserCapture.abort();
    serverCapture.abort();
    mic.release();
  }, [voice, browserCapture, serverCapture, mic]);

  useEffect(() => {
    visitRef.current += 1;
    if (!open) teardown();
    // Only on open/close; teardown's identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The clock for the call and answer timers, and for the "finished?" nudge.
  useEffect(() => {
    if (phase !== "call") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Keep the newest words in view while the transcript grows.
  useEffect(() => {
    const box = transcriptRef.current;
    if (box && recognition.listening) box.scrollTop = box.scrollHeight;
  }, [recognition.text, recognition.listening]);

  // Transcription that fails mid-interview never costs the answer. If the
  // server's stops working, the browser's recognizer takes over where it has
  // one; anything else hands the answer to typing. What was already
  // transcribed is kept either way.
  useEffect(() => {
    if (!recognition.error || phase !== "call") return;
    if (
      recognition.error === "transcription" &&
      captureMode === "openai" &&
      speechRecognitionSupported()
    ) {
      const kept = serverCapture.text;
      serverCapture.clearError();
      setCaptureMode("browser");
      setNotice(
        "We couldn't reach the transcription service, so your browser is transcribing instead. Check the text before you move on."
      );
      if (stage === "answering" && answerModeRef.current === "voice") browserCapture.start(kept);
      else browserCapture.reset(kept);
      return;
    }
    setNotice(RECOGNITION_MESSAGES[recognition.error]);
    setAnswerMode("type");
    // Runs on a new error only; the captures' identities change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.error, phase]);

  // The browser had no model for the chosen accent and fell back to US
  // English; say so, since the transcript may be rougher than expected.
  useEffect(() => {
    if (!recognition.localeFallback || phase !== "call") return;
    setNotice(
      `${speechLocaleLabel(speechLocale)} isn't available in this browser, so your answers are being transcribed as US English.`
    );
  }, [recognition.localeFallback, phase, speechLocale]);

  const changeSpeechLocale = (code: string) => {
    setSpeechLocale(code);
    saveSpeechLocale(code);
  };

  const beginAnswer = () => {
    setStage("answering");
    setAnswerStartedAt(Date.now());
    if (answerModeRef.current === "voice") recognition.start("");
    else window.setTimeout(() => transcriptRef.current?.focus(), 50);
  };

  const runQuestion = async (questionIndex: number, current: MockSession) => {
    setIndex(questionIndex);
    setStage("speaking");
    recognition.abort();
    recognition.reset("");
    const line = current.script?.lines[questionIndex] || current.questions[questionIndex]?.question || "";
    const finished = await voice.speak(`line-${questionIndex}`, line);
    if (!finished) return;
    beginAnswer();
    voice.prefetch(questionIndex + 1 < current.questions.length ? `line-${questionIndex + 1}` : "outro");
  };

  // The first question waits for the render after the session arrives, so
  // the voice hook is already bound to the new interview when it speaks.
  useEffect(() => {
    if (phase !== "call" || !session || !pendingFirstQuestionRef.current) return;
    pendingFirstQuestionRef.current = false;
    runQuestion(0, session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session]);

  const startInterview = async () => {
    if (!jobId) return;
    // Inside the click: this is what lets phones play the interviewer later,
    // and read the microphone's level once answers are being recorded.
    voice.unlock();
    serverCapture.prime();
    mic.release();
    setError("");
    setNotice("");
    setPhase("starting");
    const visit = visitRef.current;
    try {
      const result = await readJson(
        await authedFetch("/api/interview/mock", {
          method: "POST",
          body: JSON.stringify({ jobId, experienceYears: experience === "" ? null : Number(experience) }),
        })
      );
      if (visit !== visitRef.current) return;
      const started = result.session as MockSession;
      setOverview((current) =>
        current ? { ...current, attemptsUsed: current.attemptsUsed + 1 } : current
      );
      onStarted?.(jobId);
      answersRef.current = [];
      setAnswers([]);
      setVoiceMode(result.voice === "browser" ? "browser" : "openai");
      chooseCapture(result.transcription === "openai" ? "openai" : "browser");
      setSession(started);
      setCallStartedAt(Date.now());
      setNow(Date.now());
      pendingFirstQuestionRef.current = true;
      setPhase("call");
    } catch (reason) {
      if (visit !== visitRef.current) return;
      setError(reason instanceof Error ? reason.message : "Couldn't set up your interview.");
      setPhase("lobby");
      // The refusal may be the attempt limit; show the lobby's real count.
      loadOverview();
    }
  };

  const recordAnswer = (answer: MockAnswer) => {
    answersRef.current = [
      ...answersRef.current.filter((item) => item.questionId !== answer.questionId),
      answer,
    ];
    setAnswers(answersRef.current);
    if (!session) return;
    // Saved as it goes so an interrupted interview keeps what was said; the
    // finish call re-sends everything, so a failed save here loses nothing.
    authedFetch("/api/interview/mock/answer", {
      method: "POST",
      body: JSON.stringify({ sessionId: session.id, ...answer }),
    }).catch(() => {});
  };

  const finish = async () => {
    if (!session) return null;
    setError("");
    const visit = visitRef.current;
    try {
      const result = await readJson(
        await authedFetch("/api/interview/mock/finish", {
          method: "POST",
          body: JSON.stringify({ sessionId: session.id, answers: answersRef.current }),
        })
      );
      const completed = result.session as MockSession;
      // The tracker hears about the score even if the dialog was closed while
      // it was being worked out; the report itself is for this visit only.
      if (completed.overallScore !== null) onCompleted?.(completed.jobId, completed.overallScore);
      if (visit !== visitRef.current) return null;
      setReport(completed);
      setReportFromLobby(false);
      return completed;
    } catch (reason) {
      if (visit !== visitRef.current) return null;
      setError(reason instanceof Error ? reason.message : "Couldn't score your interview.");
      return null;
    }
  };

  const wrapUp = async () => {
    setPhase("wrapping");
    recognition.abort();
    const outro = session?.script?.outro || "";
    // The review runs while the interviewer signs off; the report opens once
    // both are done, so the goodbye is never cut short.
    const [, completed] = await Promise.all([voice.speak("outro", outro), finish()]);
    if (completed) setPhase("report");
  };

  const submitAnswer = async (skipped = false) => {
    if (!session || stage !== "answering") return;
    const question = session.questions[index];
    setStage("saving");
    const text = skipped ? "" : (await recognition.stop()).trim();
    recordAnswer({
      questionId: question.id,
      answer: text,
      durationSec: Math.max(0, Math.round((Date.now() - answerStartedAt) / 1000)),
      skipped: skipped || !text,
    });
    setNotice("");
    if (index + 1 < session.questions.length) runQuestion(index + 1, session);
    else wrapUp();
  };

  const repeatQuestion = async () => {
    if (!session || stage === "saving") return;
    const wasListening = recognition.listening;
    const kept = wasListening ? await recognition.stop() : recognition.text;
    const wasAnswering = stage === "answering";
    setStage("speaking");
    const finished = await voice.speak(
      `question-${index}`,
      session.script?.questions[index] || session.questions[index].question
    );
    if (!finished) return;
    if (!wasAnswering) {
      beginAnswer();
      return;
    }
    setStage("answering");
    if (wasListening && answerModeRef.current === "voice") recognition.start(kept);
  };

  const toggleMic = async () => {
    if (recognition.listening) await recognition.stop();
    else {
      setNotice("");
      recognition.start(recognition.text);
    }
  };

  const switchAnswerMode = async (mode: AnswerMode) => {
    setAnswerMode(mode);
    setNotice("");
    if (stage !== "answering") return;
    if (mode === "type") {
      await recognition.stop();
      window.setTimeout(() => transcriptRef.current?.focus(), 50);
    } else {
      recognition.clearError();
      recognition.start(recognition.text);
    }
  };

  /** Ends early: scores what was answered, including an answer in progress. */
  const endWithFeedback = async () => {
    setConfirmEnd(false);
    voice.stop();
    if (session && stage === "answering") {
      const text = (await recognition.stop()).trim();
      if (text) {
        recordAnswer({
          questionId: session.questions[index].id,
          answer: text,
          durationSec: Math.max(0, Math.round((Date.now() - answerStartedAt) / 1000)),
          skipped: false,
        });
      }
    }
    recognition.abort();
    setPhase("wrapping");
    const completed = await finish();
    if (completed) setPhase("report");
  };

  const leave = () => {
    setConfirmEnd(false);
    teardown();
    onOpenChange(false);
  };

  /**
   * Opens an attempt's report. An unfinished one (a closed tab, a dropped
   * connection) is scored first from the answers it saved, so an interrupted
   * attempt still gives feedback rather than being lost.
   */
  const openReport = async (sessionId: string, unfinished = false) => {
    setLoadingReportId(sessionId);
    setError("");
    try {
      const result = await readJson(
        unfinished
          ? await authedFetch("/api/interview/mock/finish", {
              method: "POST",
              body: JSON.stringify({ sessionId }),
            })
          : await authedFetch(`/api/interview/mock?sessionId=${encodeURIComponent(sessionId)}`)
      );
      const opened = result.session as MockSession;
      if (unfinished && opened.overallScore !== null) {
        onCompleted?.(opened.jobId, opened.overallScore);
      }
      setReport(opened);
      setReportFromLobby(true);
      mic.release();
      setPhase("report");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't open that report.");
    } finally {
      setLoadingReportId(null);
    }
  };

  const backToLobby = () => {
    setReport(null);
    setSession(null);
    setError("");
    setPhase("lobby");
    loadOverview();
  };

  const handleOpenChange = (next: boolean) => {
    // Closing mid-interview asks first. While it is being set up or scored it
    // just closes: the setup is abandoned, and a score still lands in past
    // attempts and on the tracker.
    if (!next && phase === "call") {
      setConfirmEnd(true);
      return;
    }
    onOpenChange(next);
  };

  const answeredCount = answers.length;
  const attemptsLeft = overview
    ? Math.max(0, overview.attemptLimit - overview.attemptsUsed)
    : null;
  const answerText = recognition.text;
  const liveAnswerWords = wordCount(answerText);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-6">
          <Dialog.Content
            onOpenAutoFocus={(event) => event.preventDefault()}
            aria-describedby={undefined}
            className={cn(
              "pointer-events-auto relative flex h-[100dvh] w-full flex-col overflow-hidden shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:h-[min(92dvh,880px)] sm:max-w-5xl sm:rounded-3xl sm:data-[state=open]:zoom-in-95",
              phase === "report" ? "bg-slate-50" : "bg-[#0b0b12] text-white"
            )}
          >
            {phase === "lobby" ? (
              <Lobby
                job={job}
                overview={overview}
                overviewError={overviewError}
                onRetryOverview={loadOverview}
                error={error}
                experience={experience}
                onExperienceChange={setExperience}
                answerMode={answerMode}
                onAnswerModeChange={setAnswerMode}
                speechSupported={speechSupported}
                recorded={captureMode === "openai"}
                speechLocale={speechLocale}
                onSpeechLocaleChange={changeSpeechLocale}
                mic={mic}
                muted={voice.muted}
                onMutedChange={voice.setMuted}
                onStart={startInterview}
                onOpenReport={openReport}
                loadingReportId={loadingReportId}
                attemptsLeft={attemptsLeft}
              />
            ) : null}

            {phase === "starting" ? <Connecting job={job} interviewer={overview?.interviewer || "Maya"} /> : null}

            {phase === "call" && session ? (
              <CallScreen
                session={session}
                index={index}
                stage={stage}
                voiceStatus={voice.status}
                voiceBlocked={voice.blocked}
                muted={voice.muted}
                onToggleMute={() => voice.setMuted(!voice.muted)}
                onEnableSound={() => {
                  voice.unlock();
                  repeatQuestion();
                }}
                onSkipSpeech={voice.skip}
                elapsed={Math.max(0, Math.round((now - callStartedAt) / 1000))}
                answerElapsed={stage === "answering" ? Math.max(0, Math.round((now - answerStartedAt) / 1000)) : 0}
                answerMode={answerMode}
                speechSupported={speechSupported}
                listening={recognition.listening}
                heardRecently={now - recognition.heardAt < 1500}
                quietFor={recognition.heardAt ? now - recognition.heardAt : 0}
                answerText={answerText}
                answerWords={liveAnswerWords}
                hasAnswer={liveAnswerWords > 0 || recognition.hasSpeech}
                transcribing={recognition.pending}
                recorded={captureMode === "openai"}
                onAnswerChange={recognition.reset}
                transcriptRef={transcriptRef}
                notice={notice}
                onDismissNotice={() => setNotice("")}
                onToggleMic={toggleMic}
                onSwitchMode={switchAnswerMode}
                onRepeat={repeatQuestion}
                onSkip={() => submitAnswer(true)}
                onDone={() => submitAnswer(false)}
                onEnd={() => setConfirmEnd(true)}
              />
            ) : null}

            {phase === "wrapping" ? (
              <WrappingUp
                error={error}
                onRetry={async () => {
                  const completed = await finish();
                  if (completed) setPhase("report");
                }}
                onLeave={leave}
              />
            ) : null}

            {phase === "report" && report ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
                  {reportFromLobby ? (
                    <button
                      type="button"
                      onClick={backToLobby}
                      aria-label="Back"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 sm:h-9 sm:w-9"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  ) : null}
                  <div className={cn("min-w-0 flex-1", !reportFromLobby && "pl-1")}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                      Mock interview report
                    </p>
                    <Dialog.Title className="truncate text-base font-bold text-slate-900 sm:text-lg">
                      {job?.designation}
                    </Dialog.Title>
                    <p className="truncate text-xs text-slate-500">
                      {job?.organization}
                      {report.completedAt ? ` · ${formatDate(report.completedAt)}` : ""}
                    </p>
                  </div>
                  <Dialog.Close
                    aria-label="Close"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 sm:h-9 sm:w-9"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </header>
                <div className="touch-scroll min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
                    <MockInterviewReport session={report} />
                  </div>
                </div>
                <footer className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6">
                  <Button variant="outline" className="flex-1 rounded-full sm:flex-none" onClick={backToLobby}>
                    {attemptsLeft ? <RotateCcw /> : <History />}
                    {attemptsLeft
                      ? `Practice again (${attemptsLeft} left)`
                      : "All attempts"}
                  </Button>
                  <Dialog.Close asChild>
                    <Button className="flex-1 rounded-full sm:flex-none">Done</Button>
                  </Dialog.Close>
                </footer>
              </div>
            ) : null}

            {confirmEnd ? (
              <ConfirmEnd
                attemptLimit={overview?.attemptLimit || 3}
                answeredCount={
                  answeredCount +
                  (stage === "answering" && (liveAnswerWords || recognition.hasSpeech) ? 1 : 0)
                }
                total={session?.questions.length || 12}
                onKeepGoing={() => setConfirmEnd(false)}
                onFeedback={endWithFeedback}
                onLeave={leave}
              />
            ) : null}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** The interviewer's avatar: rings while speaking, a slow breath otherwise. */
const InterviewerOrb = ({ state, size = "lg" }: { state: "speaking" | "preparing" | "idle"; size?: "sm" | "lg" }) => (
  <div
    className={cn(
      "relative flex shrink-0 items-center justify-center",
      size === "lg" ? "h-20 w-20 md:h-32 md:w-32" : "h-14 w-14"
    )}
  >
    {state === "speaking" ? (
      <>
        <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/25 [animation-duration:1.8s]" />
        <span className="absolute -inset-3 animate-ping rounded-full bg-fuchsia-500/15 [animation-delay:0.5s] [animation-duration:2.4s]" />
      </>
    ) : null}
    <span
      className={cn(
        "absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-500 to-indigo-600 shadow-[0_0_80px_-12px_rgba(167,139,250,0.8)] transition duration-500",
        state === "speaking" ? "scale-105" : "animate-orb-breathe",
        state === "preparing" && "opacity-80"
      )}
    />
    <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-white/25 to-transparent" />
    {state === "speaking" ? (
      <span className="relative flex h-1/3 items-center gap-[3px] md:gap-1">
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className="h-full w-[3px] origin-center animate-voice-bar rounded-full bg-white md:w-1"
            style={{ animationDelay: `${bar * 0.12}s`, animationDuration: `${0.7 + (bar % 3) * 0.2}s` }}
          />
        ))}
      </span>
    ) : state === "preparing" ? (
      <Loader2 className="relative h-1/3 w-1/3 animate-spin text-white/90" />
    ) : (
      <span className={cn("relative font-bold text-white", size === "lg" ? "text-2xl md:text-4xl" : "text-xl")}>M</span>
    )}
  </div>
);

/** The candidate's level bars; they move only while words are coming in. */
const ListeningBars = ({ active }: { active: boolean }) => (
  <span className="flex h-4 items-center gap-[3px]" aria-hidden>
    {[0, 1, 2, 3].map((bar) => (
      <span
        key={bar}
        className={cn(
          "h-full w-[3px] origin-center rounded-full bg-emerald-400 transition-transform",
          active ? "animate-voice-bar" : "scale-y-[0.3]"
        )}
        style={active ? { animationDelay: `${bar * 0.15}s` } : undefined}
      />
    ))}
  </span>
);

const DarkPanel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("rounded-2xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10", className)}>{children}</div>
);

type LobbyProps = {
  job: InterviewJob | null;
  overview: MockOverview | null;
  overviewError: string;
  onRetryOverview: () => void;
  error: string;
  experience: string;
  onExperienceChange: (value: string) => void;
  answerMode: AnswerMode;
  onAnswerModeChange: (mode: AnswerMode) => void;
  speechSupported: boolean;
  /** Answers are recorded and transcribed by the server, not the browser. */
  recorded: boolean;
  speechLocale: string;
  onSpeechLocaleChange: (code: string) => void;
  mic: ReturnType<typeof useMicCheck>;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onStart: () => void;
  onOpenReport: (sessionId: string, unfinished?: boolean) => void;
  loadingReportId: string | null;
  /** Mock interviews still available for this job; null while loading. */
  attemptsLeft: number | null;
};

const Lobby = ({
  job,
  overview,
  overviewError,
  onRetryOverview,
  error,
  experience,
  onExperienceChange,
  answerMode,
  onAnswerModeChange,
  speechSupported,
  recorded,
  speechLocale,
  onSpeechLocaleChange,
  mic,
  muted,
  onMutedChange,
  onStart,
  onOpenReport,
  loadingReportId,
  attemptsLeft,
}: LobbyProps) => {
  const interviewer = overview?.interviewer || "Maya";
  const years = experience === "" ? null : Number(experience);
  const limit = overview?.attemptLimit || 3;
  const usedUp = attemptsLeft === 0;
  // Every start uses an attempt, so the button says what it costs, and once
  // they are gone it says so instead of offering a start the server refuses.
  const startButton = usedUp ? (
    <div className="rounded-2xl bg-white/[0.04] px-4 py-3.5 text-center ring-1 ring-inset ring-white/10">
      <p className="text-sm font-semibold">You&apos;ve used all {limit} mock interviews for this job</p>
      <p className="mt-0.5 text-xs text-white/50">Your reports from each attempt are below.</p>
    </div>
  ) : (
    <div>
      <Button
        size="lg"
        onClick={onStart}
        disabled={!overview}
        className="h-12 w-full rounded-full bg-white text-base font-semibold text-slate-900 shadow-[0_8px_30px_-6px_rgba(167,139,250,0.6)] hover:bg-violet-50 md:h-12"
      >
        Start interview
        <ArrowRight className="h-5 w-5" />
      </Button>
      {attemptsLeft !== null ? (
        <p className="mt-2 text-center text-xs text-white/50">
          {attemptsLeft === limit
            ? `You get ${limit} mock interviews for this job. Starting one uses one.`
            : `${attemptsLeft} of ${limit} attempts left for this job. Starting one uses one.`}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-light">Mock interview</p>
        <Dialog.Close
          aria-label="Close"
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
        >
          <X className="h-5 w-5" />
        </Dialog.Close>
      </header>

      <div className="touch-scroll relative min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl"
        />
        <div
          className={cn(
            "relative mx-auto grid w-full gap-6 px-4 pb-8 pt-2 sm:px-6 md:gap-8 md:pt-6",
            usedUp ? "max-w-2xl" : "max-w-4xl md:grid-cols-[1.15fr,1fr]"
          )}
        >
          <div className="flex flex-col">
            <Dialog.Title className="break-anywhere text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {job?.designation}
            </Dialog.Title>
            <p className="break-anywhere mt-1 text-sm text-white/60">{job?.organization}</p>

            <div className="mt-6 flex items-center gap-4">
              <InterviewerOrb state="idle" size="sm" />
              <div>
                <p className="font-semibold">{interviewer} will interview you</p>
                <p className="mt-0.5 text-sm text-white/60">
                  {overview?.questionCount || 12} questions · {overview?.sections.length || 4} sections · about 15–20 min
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-white/70">
              {interviewer} asks each question out loud and waits for your answer. Speak as you would in the real
              interview. At the end you get a score, your strengths and what to work on.
            </p>

            {overview ? (
              <ol className="mt-5 grid grid-cols-2 gap-2">
                {overview.sections.map((section, sectionIndex) => (
                  <li
                    key={section.name}
                    className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-200">
                      {sectionIndex + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{section.name}</span>
                      <span className="block text-xs text-white/50">
                        {section.count} question{section.count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : overviewError ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-rose-500/10 px-3 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <span className="flex-1">{overviewError}</span>
                <button type="button" onClick={onRetryOverview} className="font-semibold text-white underline-offset-2 hover:underline">
                  Retry
                </button>
              </div>
            ) : (
              <div className="mt-5 flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-white/40" />
              </div>
            )}

            {error ? (
              <p className="mt-4 flex gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <div className={cn("mt-6", !usedUp && "hidden md:block")}>{startButton}</div>

            {overview?.attempts.length ? (
              <div className="mt-8">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                  <History className="h-3.5 w-3.5" />
                  Your attempts
                  <span className="ml-auto normal-case tracking-normal">
                    {overview.attemptsUsed} of {limit} used
                  </span>
                </p>
                <ul className="mt-3 space-y-2">
                  {overview.attempts.map((attempt, attemptIndex) => {
                    // Newest first, numbered in the order they were taken.
                    const number = overview.attempts.length - attemptIndex;
                    const finished = attempt.status === "completed";
                    // An interrupted attempt keeps its answers and can still
                    // be scored; one abandoned before any answer has nothing
                    // to show, though it still counts.
                    const scorable = !finished && attempt.answeredCount > 0;
                    const detail = finished
                      ? levelLabel(attempt.experienceYears)
                      : scorable
                        ? `Unfinished · ${attempt.answeredCount} answered`
                        : "Left before answering";
                    const body = (
                      <>
                        <span
                          className={cn(
                            "flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums",
                            finished ? scoreTone(attempt.overallScore).chip : "bg-white/10 text-white/50"
                          )}
                        >
                          {finished ? attempt.overallScore ?? "—" : "—"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            Attempt {number}
                            <span className="font-normal text-white/50">
                              {" · "}
                              {formatDate(attempt.completedAt || attempt.createdAt)}
                            </span>
                          </span>
                          <span className="block text-xs text-white/50">{detail}</span>
                        </span>
                      </>
                    );
                    if (!finished && !scorable) {
                      return (
                        <li
                          key={attempt.id}
                          className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset ring-white/5"
                        >
                          {body}
                        </li>
                      );
                    }
                    return (
                      <li key={attempt.id}>
                        <button
                          type="button"
                          onClick={() => onOpenReport(attempt.id, scorable)}
                          disabled={loadingReportId !== null}
                          className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] disabled:opacity-60"
                        >
                          {body}
                          {loadingReportId === attempt.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-200">
                              {scorable ? "Get feedback" : "Report"}
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <div className={cn("space-y-3", usedUp && "hidden")}>
            <DarkPanel>
              <label htmlFor="mock-experience" className="text-sm font-semibold">
                Your experience
              </label>
              <p className="mt-0.5 text-xs text-white/50">
                {overview?.candidate.experienceYears !== null && overview?.candidate.experienceYears !== undefined
                  ? "From your base resume. Questions are pitched to match."
                  : "Not on your base resume yet. Pick it so the questions match your level."}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <select
                  id="mock-experience"
                  value={experience}
                  onChange={(event) => onExperienceChange(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 md:h-10"
                >
                  <option value="" className="text-slate-900">
                    Not set
                  </option>
                  {EXPERIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="text-slate-900">
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="shrink-0 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200">
                  {levelLabel(years)}
                </span>
              </div>
            </DarkPanel>

            <DarkPanel>
              <p className="text-sm font-semibold">How you&apos;ll answer</p>
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
                {(["voice", "type"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={mode === "voice" && !speechSupported}
                    onClick={() => onAnswerModeChange(mode)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:opacity-40",
                      answerMode === mode ? "bg-white text-slate-900 shadow" : "text-white/70 hover:text-white"
                    )}
                  >
                    {mode === "voice" ? <Mic className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
                    {mode === "voice" ? "Speak" : "Type"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                {speechSupported
                  ? answerMode === "voice"
                    ? recorded
                      ? "Recommended. Your answer is transcribed a moment after each sentence, and you can edit it before moving on. Your voice is sent to OpenAI to be transcribed; SynCV doesn't keep the recording."
                      : "Recommended. Your answer is transcribed as you speak, and you can edit it before moving on."
                    : "You'll type each answer. Speaking out loud is closer to the real thing."
                  : "Voice answers aren't supported in this browser. You can type your answers here."}
              </p>
              {/* The server's transcriber hears every accent; only the
                  browser's recognizer has to be told which to listen for. */}
              {answerMode === "voice" && speechSupported && !recorded ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <label htmlFor="mock-accent" className="text-sm font-semibold">
                    Your accent
                  </label>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                    Set from your location, so your words are recognised correctly. Change it if
                    it&apos;s wrong.
                  </p>
                  <select
                    id="mock-accent"
                    value={speechLocale}
                    onChange={(event) => onSpeechLocaleChange(event.target.value)}
                    className="mt-3 h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 md:h-10"
                  >
                    {SPEECH_LOCALES.map((locale) => (
                      <option key={locale.code} value={locale.code} className="text-slate-900">
                        {locale.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </DarkPanel>

            {answerMode === "voice" && speechSupported ? (
              <DarkPanel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Microphone</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      {mic.state === "heard"
                        ? "We can hear you clearly."
                        : mic.state === "checking"
                          ? "Say something to test it…"
                          : mic.state === "blocked"
                            ? "Blocked. Allow the microphone in your browser's site settings."
                            : mic.state === "unavailable"
                              ? "No microphone available here. You can type instead."
                              : "Check it works before you start."}
                    </p>
                  </div>
                  {mic.state === "heard" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={mic.start}
                      disabled={mic.state === "checking"}
                      className="shrink-0 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    >
                      <Mic />
                      {mic.state === "blocked" || mic.state === "unavailable" ? "Try again" : "Test"}
                    </Button>
                  )}
                </div>
                {mic.state === "checking" || mic.state === "heard" ? (
                  <div className="mt-3 flex h-6 items-end gap-1" aria-hidden>
                    {Array.from({ length: 24 }, (_, bar) => (
                      <span
                        key={bar}
                        className={cn(
                          "flex-1 rounded-sm transition-all duration-75",
                          bar / 24 < mic.level ? "bg-emerald-400" : "bg-white/10"
                        )}
                        style={{ height: `${30 + ((bar * 37) % 70)}%` }}
                      />
                    ))}
                  </div>
                ) : null}
              </DarkPanel>
            ) : null}

            <DarkPanel className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold">Interviewer&apos;s voice</p>
                  <p className="text-xs text-white/50">
                    {muted ? "Off. Questions appear as text only." : `${interviewer} reads every question aloud.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!muted}
                aria-label="Interviewer's voice"
                onClick={() => onMutedChange(!muted)}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition",
                  muted ? "bg-white/15" : "bg-violet-500"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                    muted ? "left-1" : "left-6"
                  )}
                />
              </button>
            </DarkPanel>

            <ul className="space-y-2 px-1 pt-1 text-xs leading-relaxed text-white/50">
              <li className="flex gap-2">
                <Headphones className="mt-px h-3.5 w-3.5 shrink-0" />
                A quiet room and headphones help the transcript keep up with you.
              </li>
              <li className="flex gap-2">
                <Check className="mt-px h-3.5 w-3.5 shrink-0" />
                Pausing to think is fine. Aim for one to two minutes per answer.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {usedUp ? null : (
        <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          {startButton}
        </div>
      )}
    </div>
  );
};

const Connecting = ({ job, interviewer }: { job: InterviewJob | null; interviewer: string }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
    <Dialog.Title className="sr-only">Starting your mock interview</Dialog.Title>
    <InterviewerOrb state="preparing" />
    <p className="mt-8 text-lg font-semibold">Connecting you with {interviewer}…</p>
    <p className="mt-1.5 max-w-sm text-sm text-white/60">
      Preparing questions for {job?.designation || "this role"}
      {job?.organization ? ` at ${job.organization}` : ""}, pitched to your experience.
    </p>
  </div>
);

const WRAP_UP_STEPS = ["Reading your answers", "Scoring each one", "Writing your feedback"];

const WrappingUp = ({ error, onRetry, onLeave }: { error: string; onRetry: () => void; onLeave: () => void }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, WRAP_UP_STEPS.length - 1)), 4000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <Dialog.Title className="sr-only">Reviewing your interview</Dialog.Title>
      {error ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
            <CircleAlert className="h-7 w-7" />
          </span>
          <p className="mt-5 text-lg font-semibold">We couldn&apos;t score it just now</p>
          <p className="mt-1.5 max-w-sm text-sm text-white/60">
            {error} Your answers are saved, so trying again won&apos;t lose anything.
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={onLeave} className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Leave
            </Button>
            <Button onClick={onRetry} className="rounded-full bg-white text-slate-900 hover:bg-violet-50">
              <RotateCcw />
              Try again
            </Button>
          </div>
        </>
      ) : (
        <>
          <InterviewerOrb state="idle" />
          <p className="mt-8 text-lg font-semibold">Reviewing your interview</p>
          <ol className="mt-5 space-y-2 text-left text-sm">
            {WRAP_UP_STEPS.map((label, stepIndex) => (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2.5 transition",
                  stepIndex <= step ? "text-white" : "text-white/35"
                )}
              >
                {stepIndex < step ? (
                  <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                ) : stepIndex === step ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-white/25" />
                )}
                {label}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

type CallScreenProps = {
  session: MockSession;
  index: number;
  stage: Stage;
  voiceStatus: "idle" | "preparing" | "speaking";
  voiceBlocked: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onEnableSound: () => void;
  onSkipSpeech: () => void;
  elapsed: number;
  answerElapsed: number;
  answerMode: AnswerMode;
  speechSupported: boolean;
  listening: boolean;
  heardRecently: boolean;
  quietFor: number;
  answerText: string;
  answerWords: number;
  /** Something has been said or typed, even if its text hasn't arrived yet. */
  hasAnswer: boolean;
  /** A clip of the answer is still being transcribed. */
  transcribing: boolean;
  /** Answers are recorded and transcribed by the server. */
  recorded: boolean;
  onAnswerChange: (value: string) => void;
  transcriptRef: React.RefObject<HTMLTextAreaElement | null>;
  notice: string;
  onDismissNotice: () => void;
  onToggleMic: () => void;
  onSwitchMode: (mode: AnswerMode) => void;
  onRepeat: () => void;
  onSkip: () => void;
  onDone: () => void;
  onEnd: () => void;
};

const CallScreen = ({
  session,
  index,
  stage,
  voiceStatus,
  voiceBlocked,
  muted,
  onToggleMute,
  onEnableSound,
  onSkipSpeech,
  elapsed,
  answerElapsed,
  answerMode,
  speechSupported,
  listening,
  heardRecently,
  quietFor,
  answerText,
  answerWords,
  hasAnswer,
  transcribing,
  recorded,
  onAnswerChange,
  transcriptRef,
  notice,
  onDismissNotice,
  onToggleMic,
  onSwitchMode,
  onRepeat,
  onSkip,
  onDone,
  onEnd,
}: CallScreenProps) => {
  const question = session.questions[index];
  const total = session.questions.length;
  const speaking = stage === "speaking";
  const answering = stage === "answering";
  const orbState = speaking ? (voiceStatus === "preparing" ? "preparing" : "speaking") : "idle";
  // A gentle prompt once the candidate has said something and gone quiet.
  const nudgeDone = answering && listening && answerWords >= 12 && quietFor > 6000;
  const longAnswer = answering && answerElapsed >= 180;

  const status = speaking
    ? voiceStatus === "preparing"
      ? `${session.interviewer} is about to ask…`
      : `${session.interviewer} is speaking`
    : stage === "saving"
      ? "Noting your answer…"
      : answerMode === "voice"
        ? listening
          ? "Listening to you"
          : "Microphone paused"
        : "Waiting for your answer";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Dialog.Title className="sr-only">
        Mock interview, question {index + 1} of {total}
      </Dialog.Title>

      <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4">
        <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          Live
        </span>
        <span className="font-mono text-sm tabular-nums text-white/60">{formatClock(elapsed)}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Turn the interviewer's voice on" : "Mute the interviewer"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white sm:h-9 sm:w-9"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="flex h-10 items-center gap-2 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 active:scale-95 sm:h-9"
          >
            <PhoneOff className="h-4 w-4" />
            End
          </button>
        </div>
      </div>

      <div className="shrink-0 px-4 sm:px-6">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-violet-200">{question.section}</span>
          <span className="tabular-nums text-white/50">
            Question {index + 1} of {total}
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {session.questions.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                itemIndex < index ? "bg-violet-400" : itemIndex === index ? "bg-white" : "bg-white/15",
                itemIndex > 0 && session.questions[itemIndex - 1].section !== item.section && "ml-1.5"
              )}
            />
          ))}
        </div>
      </div>

      <div className="touch-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr),minmax(300px,380px)] md:gap-4 md:py-4">
        <div className="relative flex shrink-0 flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] ring-1 ring-inset ring-white/10 md:min-h-0">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/30 blur-3xl transition-opacity duration-700",
              speaking ? "opacity-100" : "opacity-40"
            )}
          />
          <div className="relative flex items-center gap-4 px-4 py-4 md:flex-1 md:flex-col md:justify-center md:gap-5 md:py-8">
            <InterviewerOrb state={orbState} />
            <div className="min-w-0 md:text-center">
              <p className="font-semibold">{session.interviewer}</p>
              <p className="text-xs text-white/50">Interviewer</p>
              <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-white/80 md:justify-center">
                {answering && answerMode === "voice" && listening ? <ListeningBars active={heardRecently} /> : null}
                {status}
              </p>
            </div>
          </div>
          <div className="relative border-t border-white/10 bg-black/20 px-4 py-4 md:px-6 md:py-5">
            <p aria-live="polite" className="break-anywhere text-[17px] font-medium leading-snug text-white md:text-xl">
              {question.question}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {speaking && voiceStatus === "speaking" ? (
                <button
                  type="button"
                  onClick={onSkipSpeech}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Answer now
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRepeat}
                  disabled={stage === "saving"}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-40"
                >
                  <Repeat2 className="h-3.5 w-3.5" />
                  Repeat question
                </button>
              )}
              {voiceBlocked ? (
                <button
                  type="button"
                  onClick={onEnableSound}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-400/15 px-3 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/25"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Sound was blocked. Tap to hear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-h-[200px] flex-1 flex-col rounded-3xl bg-white/[0.04] ring-1 ring-inset ring-white/10 md:min-h-0">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                You
              </span>
              Your answer
            </p>
            <span className="text-xs tabular-nums text-white/50">
              {transcribing ? (
                <span className="inline-flex items-center gap-1.5 text-violet-200">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Transcribing
                </span>
              ) : answering || answerWords ? (
                `${formatClock(answerElapsed)} · ${answerWords} words`
              ) : (
                ""
              )}
            </span>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col px-4 py-3">
            {speaking && !answerText ? (
              <p className="m-auto max-w-[16rem] text-center text-sm text-white/40">
                Listen to the question. You&apos;ll answer as soon as {session.interviewer} finishes.
              </p>
            ) : (
              <textarea
                ref={transcriptRef}
                value={answerText}
                onChange={(event) => onAnswerChange(event.target.value)}
                readOnly={listening || stage !== "answering"}
                placeholder={
                  answerMode === "voice"
                    ? listening
                      ? recorded
                        ? "Start speaking. Your words appear here a moment after each sentence…"
                        : "Start speaking. Your words appear here…"
                      : "Resume the microphone, or type to edit your answer."
                    : "Type your answer…"
                }
                aria-label="Your answer"
                className="min-h-[120px] w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
              />
            )}
          </div>
          {notice ? (
            <div className="mx-4 mb-3 flex gap-2 rounded-xl bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100 ring-1 ring-inset ring-amber-300/20">
              <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={onDismissNotice} aria-label="Dismiss" className="shrink-0 text-amber-200/70 hover:text-amber-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : longAnswer ? (
            <p className="mx-4 mb-3 text-xs text-amber-200/80">Over three minutes. Try to wrap this one up.</p>
          ) : null}
          {speechSupported && answering ? (
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-xs text-white/50">
              {answerMode === "voice" ? (
                <button type="button" onClick={() => onSwitchMode("type")} className="flex items-center gap-1.5 hover:text-white">
                  <Keyboard className="h-3.5 w-3.5" />
                  Type instead
                </button>
              ) : (
                <button type="button" onClick={() => onSwitchMode("voice")} className="flex items-center gap-1.5 hover:text-white">
                  <Mic className="h-3.5 w-3.5" />
                  Answer by voice
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          {answerMode === "voice" ? (
            <button
              type="button"
              onClick={onToggleMic}
              disabled={!answering}
              aria-label={listening ? "Pause the microphone" : "Resume the microphone"}
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40",
                // Amber only for a microphone the candidate paused; while the
                // interviewer talks it is simply not on yet.
                listening || !answering
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "bg-amber-400 text-slate-900 hover:bg-amber-300"
              )}
            >
              {listening || !answering ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
          ) : null}
          {answering && !hasAnswer ? (
            <button
              type="button"
              onClick={onSkip}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDone}
            disabled={!answering || !hasAnswer}
            className={cn(
              "ml-auto flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-900 transition hover:bg-violet-50 active:scale-[0.98] disabled:bg-white/15 disabled:text-white/40 sm:max-w-xs sm:flex-none",
              nudgeDone && "animate-tour-pulse"
            )}
          >
            {stage === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {index + 1 === total ? "Finish interview" : "Done, next question"}
            {stage !== "saving" ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
        {nudgeDone ? (
          <p className="mt-2 text-center text-xs text-white/50">Finished? Press Done to move on.</p>
        ) : null}
      </div>
    </div>
  );
};

const ConfirmEnd = ({
  attemptLimit,
  answeredCount,
  total,
  onKeepGoing,
  onFeedback,
  onLeave,
}: {
  attemptLimit: number;
  answeredCount: number;
  total: number;
  onKeepGoing: () => void;
  onFeedback: () => void;
  onLeave: () => void;
}) => (
  <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center">
    <div
      role="alertdialog"
      aria-label="End the interview?"
      className="w-full max-w-sm rounded-3xl bg-white p-5 text-slate-900 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 sm:zoom-in-95"
    >
      <p className="text-lg font-bold">End the interview?</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        {answeredCount
          ? `You've answered ${answeredCount} of ${total} questions. You can still get a score and feedback on those.`
          : "You haven't answered anything yet, so there's nothing to score."}{" "}
        Either way, this counts as one of your {attemptLimit} attempts for this job.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {answeredCount ? (
          <Button onClick={onFeedback} className="h-11 rounded-full">
            Get feedback on {answeredCount} answer{answeredCount === 1 ? "" : "s"}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onKeepGoing} className="h-11 rounded-full">
          Keep going
        </Button>
        <button
          type="button"
          onClick={onLeave}
          className="h-10 rounded-full text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          Leave without feedback
        </button>
      </div>
    </div>
  </div>
);
