"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { DEFAULT_SPEECH_LOCALE } from "@/lib/speech-locales";

// Everything the mock interview does with sound: the interviewer's voice, the
// live transcript of the candidate's answer, and the lobby's microphone check.
// All of it has to survive browsers that support only part of it, so each
// piece degrades on its own — no server voice falls back to the device's
// voice, no speech recognition falls back to typing.

/** The English the device's own voice speaks in: the browser's, else US. */
export const speechLanguage = () => {
  if (typeof navigator === "undefined") return "en-US";
  const lang = navigator.language || "en-US";
  return /^en\b/i.test(lang) ? lang : "en-US";
};

const joinText = (...parts: string[]) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

// ---------------------------------------------------------------------------
// The interviewer's voice
// ---------------------------------------------------------------------------

// A tenth of a second of silence as a WAV, built here rather than shipped as
// a base64 literal. Played inside the click that starts the interview, it
// unlocks the audio element, which is what lets iOS Safari play the lines that
// arrive later from the network, outside any user gesture.
let silentWavUrl: string | null = null;
const silentWav = () => {
  if (silentWavUrl) return silentWavUrl;
  const sampleRate = 8000;
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate: 8-bit mono
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i += 1) view.setUint8(44 + i, 128); // 8-bit silence
  silentWavUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silentWavUrl;
};

// macOS ships joke and retro voices alongside the real ones; never pick those.
const NOVELTY_VOICES =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|eddy|flo|fred|good news|grandma|grandpa|hysterical|jester|junior|kathy|organ|pipe|ralph|reed|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox/i;

/**
 * The most natural English voice the device has. Edge's online "Natural"
 * voices and Apple's downloaded "Enhanced"/"Premium" ones are close to human;
 * Chrome's "Google" voices come next; the named system voices after that.
 */
const pickDeviceVoice = (lang: string) => {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const score = (voice: SpeechSynthesisVoice) => {
    if (!/^en(\b|[-_])/i.test(voice.lang)) return -100;
    let value = 0;
    if (NOVELTY_VOICES.test(voice.name)) value -= 50;
    if (/natural|neural/i.test(voice.name)) value += 12;
    if (/premium|enhanced/i.test(voice.name)) value += 10;
    if (/google/i.test(voice.name)) value += 8;
    if (/samantha|ava|allison|susan|zoe|serena|karen|moira|tessa|aria|jenny|sonia|libby|neerja|daniel/i.test(voice.name)) {
      value += 4;
    }
    if (voice.lang.toLowerCase() === lang.toLowerCase()) value += 3;
    else if (/^en[-_]us$/i.test(voice.lang)) value += 1;
    return value;
  };
  const voices = window.speechSynthesis.getVoices();
  let best: SpeechSynthesisVoice | null = null;
  for (const voice of voices) {
    if (score(voice) > (best ? score(best) : -1)) best = voice;
  }
  return best;
};

/** Sentence-sized pieces: long utterances get cut off in some engines. */
const splitForSpeech = (text: string) =>
  (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text])
    .map((part) => part.trim())
    .filter(Boolean);

export type VoiceStatus = "idle" | "preparing" | "speaking";

/**
 * Speaks the interviewer's lines. With the server voice on, each line is
 * fetched as MP3 by its key and cached for the session, so a prefetched line
 * plays instantly and "repeat" costs nothing. If the server voice fails twice
 * in a row, the rest of the interview uses the device's voice.
 *
 * `speak` resolves true once the line is over (finished, skipped or muted) and
 * false if `stop` superseded it, so the caller knows whether to carry on.
 */
export const useInterviewVoice = ({
  sessionId,
  mode,
}: {
  sessionId: string | null;
  mode: "openai" | "browser";
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef(new Map<string, Promise<string | null>>());
  const failuresRef = useRef(0);
  const tokenRef = useRef(0);
  const cancelRef = useRef<() => void>(() => {});
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const deviceVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const mutedRef = useRef(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMutedState] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const lang = speechLanguage();
    const pick = () => {
      deviceVoiceRef.current = pickDeviceVoice(lang);
    };
    pick();
    synth.addEventListener?.("voiceschanged", pick);
    return () => synth.removeEventListener?.("voiceschanged", pick);
  }, []);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  const load = useCallback(
    (key: string): Promise<string | null> => {
      if (mode !== "openai" || !sessionId || failuresRef.current >= 2) {
        return Promise.resolve(null);
      }
      const cache = cacheRef.current;
      const cached = cache.get(key);
      if (cached) return cached;
      const request = authedFetch("/api/interview/mock/voice", {
        method: "POST",
        body: JSON.stringify({ sessionId, key }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Voice request failed: ${response.status}`);
          const blob = await response.blob();
          if (!blob.size) throw new Error("Voice request returned no audio.");
          failuresRef.current = 0;
          return URL.createObjectURL(blob);
        })
        .catch(() => {
          failuresRef.current += 1;
          cache.delete(key);
          return null;
        });
      cache.set(key, request);
      return request;
    },
    [mode, sessionId]
  );

  // A new interview starts a new cache; the old one's audio is released.
  useEffect(() => {
    const cache = cacheRef.current;
    failuresRef.current = 0;
    return () => {
      cache.forEach((request) => request.then((url) => url && URL.revokeObjectURL(url)));
      cache.clear();
    };
  }, [sessionId]);

  const playUrl = (url: string) =>
    new Promise<"done" | "blocked" | "failed">((resolve) => {
      const audio = ensureAudio();
      let settled = false;
      let timer = 0;
      const finish = (result: "done" | "blocked" | "failed") => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        resolve(result);
      };
      cancelRef.current = () => {
        audio.pause();
        finish("done");
      };
      audio.onended = () => finish("done");
      audio.onerror = () => finish("failed");
      // A safety net for an `ended` event that never comes; tightened to the
      // clip's real length once it is known.
      timer = window.setTimeout(() => finish("done"), 90_000);
      audio.onloadedmetadata = () => {
        if (!Number.isFinite(audio.duration)) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => finish("done"), (audio.duration + 3) * 1000);
      };
      audio.src = url;
      audio.play().catch((error: unknown) => {
        finish(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "failed");
      });
    });

  const speakOnDevice = (text: string) =>
    new Promise<void>((resolve) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) return resolve();
      synth.cancel();
      const pieces = splitForSpeech(text);
      let index = 0;
      let settled = false;
      let timer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        utteranceRef.current = null;
        resolve();
      };
      cancelRef.current = () => {
        synth.cancel();
        finish();
      };
      const next = () => {
        if (settled) return;
        if (index >= pieces.length) return finish();
        const utterance = new SpeechSynthesisUtterance(pieces[index]);
        index += 1;
        const voice = deviceVoiceRef.current;
        if (voice) utterance.voice = voice;
        utterance.lang = voice?.lang || speechLanguage();
        utterance.rate = 0.95;
        // Each piece moves on once, whichever of its end, its error or the
        // timeout comes first; some engines never fire `end` at all.
        const advance = () => {
          if (utteranceRef.current !== utterance) return;
          window.clearTimeout(timer);
          next();
        };
        utterance.onend = advance;
        utterance.onerror = advance;
        window.clearTimeout(timer);
        timer = window.setTimeout(advance, utterance.text.length * 90 + 4000);
        // Held in a ref because Chrome drops the callbacks of an utterance
        // that gets garbage-collected while it is still speaking.
        utteranceRef.current = utterance;
        synth.speak(utterance);
      };
      next();
    });

  /** Supersedes whatever is playing; its `speak` resolves false. */
  const stop = useCallback(() => {
    tokenRef.current += 1;
    cancelRef.current();
    cancelRef.current = () => {};
    setStatus("idle");
  }, []);

  /** Ends the current line early; its `speak` resolves true and the flow carries on. */
  const skip = useCallback(() => {
    cancelRef.current();
  }, []);

  const speak = useCallback(
    async (key: string, text: string) => {
      stop();
      const token = tokenRef.current;
      if (mutedRef.current || !text) return true;
      setStatus("preparing");
      const url = await load(key);
      if (token !== tokenRef.current) return false;
      setStatus("speaking");
      const result = url ? await playUrl(url) : "failed";
      if (token !== tokenRef.current) return false;
      if (result === "blocked") setBlocked(true);
      if (result === "failed" && !mutedRef.current) await speakOnDevice(text);
      if (token !== tokenRef.current) return false;
      setStatus("idle");
      return true;
    },
    // playUrl and speakOnDevice only touch refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, stop]
  );

  const prefetch = useCallback((key: string) => void load(key), [load]);

  const setMuted = useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      setMutedState(value);
      if (value) skip();
    },
    [skip]
  );

  /**
   * Call synchronously inside the click that starts the interview (see
   * silentWav). Also primes speech synthesis, which iOS gates the same way.
   */
  const unlock = useCallback(() => {
    try {
      const audio = ensureAudio();
      audio.src = silentWav();
      audio.play().catch(() => {});
    } catch {
      // Nothing to unlock on this browser.
    }
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        const primer = new SpeechSynthesisUtterance(" ");
        primer.volume = 0;
        synth.speak(primer);
      }
    } catch {
      // No speech synthesis here; the server voice or captions carry on.
    }
    setBlocked(false);
  }, []);

  useEffect(
    () => () => {
      tokenRef.current += 1;
      cancelRef.current();
      audioRef.current?.pause();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Already gone.
      }
    },
    []
  );

  return { speak, prefetch, stop, skip, unlock, status, muted, setMuted, blocked };
};

// ---------------------------------------------------------------------------
// The candidate's answer, transcribed live
// ---------------------------------------------------------------------------

type RecognitionResultEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognizerConstructor = new () => Recognizer;

const getRecognizer = (): RecognizerConstructor | null => {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognizerConstructor;
    webkitSpeechRecognition?: RecognizerConstructor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
};

export const speechRecognitionSupported = () => Boolean(getRecognizer());

export type RecognitionError = "blocked" | "no-mic" | "network" | "unavailable" | "transcription";

/**
 * Live speech-to-text through the browser's own recognizer (Chrome, Edge,
 * Safari). `text` is everything heard so far, still-changing words included.
 * Recognizers stop by themselves after a pause or a time limit, so while the
 * candidate is answering it is restarted whenever it ends — unless it keeps
 * dying straight away, which is reported as unavailable.
 *
 * `locale` is the regional English to listen for (lib/speech-locales.js).
 * Not every browser has every one; when the chosen one is refused the
 * recognizer carries on in US English and `localeFallback` says so.
 */
export const useSpeechRecognition = (locale: string = DEFAULT_SPEECH_LOCALE) => {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<RecognitionError | null>(null);
  const [heardAt, setHeardAt] = useState(0);
  const [localeFallback, setLocaleFallback] = useState(false);
  const localeRef = useRef(locale);
  // Set once the chosen locale has been refused; cleared when it changes.
  const refusedRef = useRef(false);
  useEffect(() => {
    localeRef.current = locale;
    refusedRef.current = false;
    setLocaleFallback(false);
  }, [locale]);
  const recognizerRef = useRef<Recognizer | null>(null);
  const wantRef = useRef(false);
  const committedRef = useRef("");
  const interimRef = useRef("");
  const restartsRef = useRef<number[]>([]);
  const waitersRef = useRef<(() => void)[]>([]);
  const launchRef = useRef<() => void>(() => {});

  // Joined (and so trimmed) only while there are interim words to add: a
  // hand-edited answer is shown exactly as typed, trailing space included, or
  // the space bar would do nothing at the end of it.
  const publish = () =>
    setText(
      interimRef.current ? joinText(committedRef.current, interimRef.current) : committedRef.current
    );

  const settle = () => {
    recognizerRef.current = null;
    setListening(false);
    waitersRef.current.splice(0).forEach((resolve) => resolve());
  };

  const launch = () => {
    const Recognizer = getRecognizer();
    if (!Recognizer) {
      wantRef.current = false;
      setError("unavailable");
      return;
    }
    const recognizer = new Recognizer();
    recognizer.lang = refusedRef.current ? DEFAULT_SPEECH_LOCALE : localeRef.current;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    // Android's continuous mode repeats earlier phrases in later results;
    // one phrase per session, restarted on end, avoids that.
    recognizer.continuous = !/Android/i.test(navigator.userAgent);

    recognizer.onstart = () => {
      if (recognizerRef.current === recognizer) setListening(true);
    };
    recognizer.onresult = (event) => {
      if (recognizerRef.current !== recognizer) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) committedRef.current = joinText(committedRef.current, transcript);
        else interim += transcript;
      }
      interimRef.current = interim;
      publish();
      setHeardAt(Date.now());
    };
    recognizer.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      // The browser has no model for this regional English. Chrome says so
      // outright; Safari reports the same thing as the service being refused.
      // Either way, try once more in US English before giving up on voice.
      if (
        (event.error === "language-not-supported" || event.error === "service-not-allowed") &&
        !refusedRef.current &&
        recognizer.lang !== DEFAULT_SPEECH_LOCALE
      ) {
        refusedRef.current = true;
        setLocaleFallback(true);
        if (recognizerRef.current === recognizer) {
          recognizerRef.current = null;
          try {
            recognizer.abort();
          } catch {
            // Already stopped.
          }
          if (wantRef.current) launchRef.current();
        }
        return;
      }
      const mapped: RecognitionError | null =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "blocked"
          : event.error === "audio-capture"
            ? "no-mic"
            : event.error === "network"
              ? "network"
              : null;
      if (mapped) {
        // Fatal: stop here rather than waiting on an `end` that not every
        // engine sends after an error, which would leave the answer locked
        // as if still listening.
        wantRef.current = false;
        if (recognizerRef.current === recognizer) {
          if (interimRef.current) {
            committedRef.current = joinText(committedRef.current, interimRef.current);
            interimRef.current = "";
            publish();
          }
          settle();
          try {
            recognizer.abort();
          } catch {
            // Already stopped.
          }
        }
        setError(mapped);
      }
    };
    recognizer.onend = () => {
      if (recognizerRef.current !== recognizer) return;
      // Words still marked interim when the engine stopped were said all the
      // same; keep them.
      if (interimRef.current) {
        committedRef.current = joinText(committedRef.current, interimRef.current);
        interimRef.current = "";
        publish();
      }
      if (wantRef.current) {
        const now = Date.now();
        restartsRef.current = [...restartsRef.current.filter((at) => now - at < 10_000), now];
        if (restartsRef.current.length <= 8) {
          recognizerRef.current = null;
          launchRef.current();
          return;
        }
        wantRef.current = false;
        setError("unavailable");
      }
      settle();
    };

    recognizerRef.current = recognizer;
    try {
      recognizer.start();
    } catch {
      wantRef.current = false;
      setError("unavailable");
      settle();
    }
  };
  launchRef.current = launch;

  /** Starts listening, continuing from `initialText` (an edited answer). */
  const start = useCallback((initialText = "") => {
    committedRef.current = initialText.trim();
    interimRef.current = "";
    publish();
    setError(null);
    wantRef.current = true;
    restartsRef.current = [];
    if (!recognizerRef.current) launchRef.current();
  }, []);

  /** Stops listening and resolves with the full answer, final words included. */
  const stop = useCallback(
    () =>
      new Promise<string>((resolve) => {
        wantRef.current = false;
        const done = () => resolve(joinText(committedRef.current, interimRef.current));
        const recognizer = recognizerRef.current;
        if (!recognizer) return done();
        // The last words arrive as a final result just before `end`; wait for
        // it, but not forever.
        const timer = window.setTimeout(() => {
          if (interimRef.current) {
            committedRef.current = joinText(committedRef.current, interimRef.current);
            interimRef.current = "";
            publish();
          }
          settle();
        }, 1500);
        waitersRef.current.push(() => {
          window.clearTimeout(timer);
          done();
        });
        try {
          recognizer.stop();
        } catch {
          window.clearTimeout(timer);
          settle();
        }
      }),
    []
  );

  /** Stops without waiting for anything still being recognised. */
  const abort = useCallback(() => {
    wantRef.current = false;
    const recognizer = recognizerRef.current;
    settle();
    try {
      recognizer?.abort();
    } catch {
      // Already stopped.
    }
  }, []);

  /** Replaces the answer, as when the candidate edits it by hand. */
  const reset = useCallback((value = "") => {
    committedRef.current = value;
    interimRef.current = "";
    publish();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        recognizerRef.current?.abort();
      } catch {
        // Already stopped.
      }
    },
    []
  );

  return {
    listening,
    text,
    error,
    heardAt,
    localeFallback,
    // Only the recorded kind (below) has clips still being transcribed, or
    // speech that has been heard but not yet turned into text.
    pending: false,
    hasSpeech: text.trim().length > 0,
    start,
    stop,
    abort,
    reset,
    clearError,
    prime: noop,
  };
};

const noop = () => {};

// ---------------------------------------------------------------------------
// The candidate's answer, recorded and transcribed by the server
// ---------------------------------------------------------------------------

export const recordingSupported = () =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

// Opus in WebM everywhere but Safari, which records AAC in MP4. The
// transcriber takes both.
const recordingType = () =>
  ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported?.(type)
  ) || "";

// How the recording is cut into clips. A clip ends at the first pause once it
// holds a few seconds of speech, so it is a sentence or two and its text shows
// up a moment after it is said. The limits keep clips from growing unbounded:
// one that never pauses is cut anyway, and a stretch with no speech in it is
// dropped rather than sent (silence is what speech models invent words for).
const VAD_INTERVAL_MS = 50;
const MIN_SPEECH_MS = 250;
const PAUSE_MS = 700;
const MIN_CLIP_MS = 3000;
const MAX_CLIP_MS = 28_000;
const SILENT_CLIP_MS = 8000;
// When the audio level can't be read (a suspended audio context), clips are
// cut on a timer instead.
const TIMED_CLIP_MS = 12_000;

type Clip = { text: string; done: boolean };

/**
 * Speech-to-text by recording the answer and having the server transcribe
 * it, primed with the job's vocabulary (app/api/interview/mock/transcribe).
 * Far more accurate on names and jargon than the browser's recognizer, which
 * this replaces while server transcription is on; the two share a shape so
 * the interview can fall back from one to the other mid-answer.
 */
export const useServerTranscription = ({ sessionId }: { sessionId: string | null }) => {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<RecognitionError | null>(null);
  const [heardAt, setHeardAt] = useState(0);
  const [pending, setPending] = useState(false);
  const [hasSpeech, setHasSpeech] = useState(false);

  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  // What was already there when recording (re)started: a typed or edited
  // answer. The clips' text is appended to it.
  const baseRef = useRef("");
  const clipsRef = useRef<Clip[]>([]);
  const uploadsRef = useRef<Promise<void>[]>([]);
  // Bumped whenever the answer is replaced or recording restarts, so a clip
  // that comes back late can't write into an answer it no longer belongs to.
  const takeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef(0);
  const vadRef = useRef({ clipStartedAt: 0, speechMs: 0, lastSpeechAt: 0, noise: 0.004, publishedAt: 0 });

  const compose = () => joinText(baseRef.current, ...clipsRef.current.map((clip) => clip.text));
  const publish = () => {
    // With no clips the answer is shown exactly as typed (see the recognizer
    // above: a trailing space must survive).
    setText(clipsRef.current.length ? compose() : baseRef.current);
    setPending(clipsRef.current.some((clip) => !clip.done));
  };

  const release = () => {
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setListening(false);
  };

  const fail = (kind: RecognitionError) => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    release();
    setError(kind);
  };

  const transcribe = (blob: Blob, take: number) => {
    const clip: Clip = { text: "", done: false };
    clipsRef.current.push(clip);
    publish();
    const send = async () => {
      const form = new FormData();
      form.append("audio", blob, "answer");
      form.append("sessionId", sessionRef.current || "");
      form.append("previous", compose().slice(-200));
      const response = await authedFetch("/api/interview/mock/transcribe", {
        method: "POST",
        body: form,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error("Transcription failed.");
      return String(result.text || "");
    };
    const upload = send()
      // One retry: a clip is a sentence the candidate can't be asked to repeat.
      .catch(() => send())
      .then((transcript) => {
        clip.text = transcript;
      })
      .catch(() => {
        if (take === takeRef.current) fail("transcription");
      })
      .finally(() => {
        clip.done = true;
        if (take === takeRef.current) publish();
      });
    uploadsRef.current.push(upload);
  };

  const startRecorder = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const type = recordingType();
    const recorder = new MediaRecorder(stream, {
      ...(type ? { mimeType: type } : {}),
      audioBitsPerSecond: 32_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    // Set per clip by whoever ends it: send it, or let it go.
    (recorder as MediaRecorder & { finish?: (keep: boolean) => Promise<void> }).finish = (keep) =>
      new Promise<void>((resolve) => {
        const take = takeRef.current;
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" });
          if (keep && blob.size) transcribe(blob, take);
          resolve();
        };
        if (recorder.state === "inactive") resolve();
        else recorder.stop();
      });
    recorder.start();
    recorderRef.current = recorder;
    const now = performance.now();
    vadRef.current = { ...vadRef.current, clipStartedAt: now, speechMs: 0, lastSpeechAt: now };
  };

  const endClip = (keep: boolean) => {
    const recorder = recorderRef.current as
      | (MediaRecorder & { finish?: (keep: boolean) => Promise<void> })
      | null;
    recorderRef.current = null;
    return recorder?.finish ? recorder.finish(keep) : Promise.resolve();
  };

  /**
   * Call inside the click that starts the interview: an audio context made
   * outside a user gesture can stay suspended (Safari), and then the level
   * that finds the pauses can't be read.
   */
  const prime = useCallback(() => {
    try {
      if (!contextRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) contextRef.current = new AudioContextClass();
      }
      contextRef.current?.resume().catch(() => {});
    } catch {
      // No audio context here; clips are cut on a timer instead.
    }
  }, []);

  /** Starts recording, continuing from `initialText` (an edited answer). */
  const start = useCallback((initialText = "") => {
    takeRef.current += 1;
    const take = takeRef.current;
    baseRef.current = initialText.trim();
    clipsRef.current = [];
    uploadsRef.current = [];
    setError(null);
    setHasSpeech(false);
    // A fresh answer; only the learnt noise floor carries over.
    vadRef.current = { clipStartedAt: 0, speechMs: 0, lastSpeechAt: 0, noise: vadRef.current.noise, publishedAt: 0 };
    publish();

    const begin = async () => {
      if (!recordingSupported()) return fail("unavailable");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (reason) {
        if (take !== takeRef.current) return;
        return fail(
          reason instanceof DOMException &&
            (reason.name === "NotAllowedError" || reason.name === "SecurityError")
            ? "blocked"
            : "no-mic"
        );
      }
      // Stopped or restarted while the permission prompt was open.
      if (take !== takeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      prime();
      const context = contextRef.current;
      let analyser: AnalyserNode | null = null;
      if (context) {
        // Safari can leave this pending until the next tap; don't wait on it.
        await Promise.race([
          context.resume().catch(() => {}),
          new Promise((resolve) => window.setTimeout(resolve, 400)),
        ]);
        if (context.state === "running") {
          analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          context.createMediaStreamSource(stream).connect(analyser);
        }
      }
      if (take !== takeRef.current) return;

      try {
        startRecorder();
      } catch {
        return fail("unavailable");
      }
      setListening(true);

      const samples = analyser ? new Uint8Array(analyser.fftSize) : null;
      timerRef.current = window.setInterval(() => {
        const vad = vadRef.current;
        const now = performance.now();
        const age = now - vad.clipStartedAt;
        if (!analyser || !samples) {
          // No level to read: assume speech and cut on the clock.
          if (age >= 1000 && !vad.publishedAt) {
            vad.publishedAt = now;
            setHasSpeech(true);
          }
          if (age >= TIMED_CLIP_MS) {
            endClip(true);
            startRecorder();
          }
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / samples.length);
        // The floor follows the room's noise, so a fan doesn't count as talking.
        if (rms > Math.max(0.015, vad.noise * 3)) {
          vad.speechMs += VAD_INTERVAL_MS;
          vad.lastSpeechAt = now;
          if (vad.speechMs >= MIN_SPEECH_MS && now - vad.publishedAt > 300) {
            vad.publishedAt = now;
            setHeardAt(Date.now());
            setHasSpeech(true);
          }
        } else {
          vad.noise = vad.noise * 0.95 + rms * 0.05;
        }
        const voiced = vad.speechMs >= MIN_SPEECH_MS;
        const quietFor = now - vad.lastSpeechAt;
        if (voiced && ((quietFor >= PAUSE_MS && age >= MIN_CLIP_MS) || age >= MAX_CLIP_MS)) {
          endClip(true);
          startRecorder();
        } else if (!voiced && age >= SILENT_CLIP_MS && quietFor >= 500) {
          endClip(false);
          startRecorder();
        }
      }, VAD_INTERVAL_MS);
    };
    begin();
    // Everything here works through refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Stops recording and resolves with the full answer once every clip is back. */
  const stop = useCallback(async () => {
    window.clearInterval(timerRef.current);
    const vad = vadRef.current;
    // Without a level reading every clip is assumed to hold speech.
    const voiced = vad.speechMs >= MIN_SPEECH_MS || !contextRef.current || contextRef.current.state !== "running";
    await endClip(voiced);
    release();
    await Promise.race([
      Promise.allSettled(uploadsRef.current),
      new Promise((resolve) => window.setTimeout(resolve, 15_000)),
    ]);
    publish();
    return compose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Stops without sending what is being recorded or waiting for what was sent. */
  const abort = useCallback(() => {
    takeRef.current += 1;
    endClip(false);
    release();
    setPending(false);
  }, []);

  /** Replaces the answer, as when the candidate edits it by hand. */
  const reset = useCallback((value = "") => {
    takeRef.current += 1;
    baseRef.current = value;
    clipsRef.current = [];
    uploadsRef.current = [];
    if (!value) setHasSpeech(false);
    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(
    () => () => {
      takeRef.current += 1;
      window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      contextRef.current?.close().catch(() => {});
    },
    []
  );

  return {
    listening,
    text,
    error,
    heardAt,
    localeFallback: false,
    pending,
    hasSpeech: hasSpeech || text.trim().length > 0,
    start,
    stop,
    abort,
    reset,
    clearError,
    prime,
  };
};

// ---------------------------------------------------------------------------
// The lobby's microphone check
// ---------------------------------------------------------------------------

export type MicCheckState = "idle" | "checking" | "heard" | "blocked" | "unavailable";

/**
 * Opens the microphone just long enough to show a level meter and ask for
 * permission up front, rather than mid-question. Always released before the
 * interview starts: on phones a held microphone can starve speech recognition.
 */
export const useMicCheck = () => {
  const [state, setState] = useState<MicCheckState>("idle");
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);

  const release = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    release();
    setState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        setState("heard");
        return;
      }
      const context = new AudioContextClass();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastPaint = 0;
      const tick = (now: number) => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / samples.length);
        const value = Math.min(1, rms * 6);
        if (now - lastPaint > 60) {
          lastPaint = now;
          setLevel(value);
          if (value > 0.18) setState("heard");
        }
        frameRef.current = window.requestAnimationFrame(tick);
      };
      frameRef.current = window.requestAnimationFrame(tick);
    } catch (error) {
      release();
      setState(
        error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")
          ? "blocked"
          : "unavailable"
      );
    }
  }, [release]);

  useEffect(() => release, [release]);

  return { state, level, start, release };
};
