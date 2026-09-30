// Shapes returned by app/api/interview/*. The server builds them in
// lib/server/interview.js; keep the two in step.

export type InterviewJob = {
  id: string;
  organization: string;
  designation: string;
  has_interview_prep?: boolean;
  matched_keywords?: string[];
  missing_keywords?: string[];
  keyword_universe?: string[];
};

export type PrepQuestion = {
  id: string;
  category: "Core skills" | "Scenario" | "Behavioral" | "Motivation & fit";
  question: string;
  whyTheyAsk: string;
  answer: string;
  keyPoints: string[];
  keywords: string[];
};

export type PrepStudyTopic = {
  id: string;
  topic: string;
  priority: "high" | "medium";
  why: string;
  concepts: string[];
  practice: string;
};

export type InterviewPrep = {
  version: number;
  basis: {
    keywordCount: number;
    matchedCount: number;
    missingCount: number;
    experienceYears: number | null;
    level: string;
  };
  overview: { summary: string; focusAreas: string[] };
  questions: PrepQuestion[];
  studyGuide: PrepStudyTopic[];
  gaps: { keyword: string; howToAddress: string; quickPrep: string }[];
  strengths: { keyword: string; howToShowcase: string }[];
  pitch: { outline: string[]; tip: string };
  questionsToAsk: string[];
  checklist: string[];
};

export type MockQuestion = {
  id: string;
  section: string;
  question: string;
  /** Only once the interview is over. */
  assesses?: string;
  idealPoints?: string[];
};

export type MockAnswer = {
  questionId: string;
  answer: string;
  durationSec: number;
  skipped: boolean;
  answeredAt?: string;
};

export type MockEvaluation = {
  overallScore: number;
  readiness: string;
  summary: string;
  scoredCount: number;
  totalQuestions: number;
  sectionScores: { section: string; score: number | null; answered: number }[];
  communication: {
    clarity: number | null;
    structure: number | null;
    relevance: number | null;
    depth: number | null;
  };
  stats: {
    answered: number;
    skipped: number;
    averageSeconds: number;
    averageWords: number;
    wordsPerMinute: number;
  };
  strengths: { title: string; detail: string }[];
  improvements: { title: string; detail: string; action: string }[];
  questions: {
    id: string;
    status: "answered" | "skipped" | "not_reached";
    score: number | null;
    feedback: string;
    betterAnswer: string;
  }[];
};

export type MockScript = { lines: string[]; questions: string[]; outro: string };

export type MockSession = {
  id: string;
  jobId: string;
  status: "in_progress" | "completed";
  experienceYears: number | null;
  level: string;
  createdAt: string;
  completedAt: string | null;
  questions: MockQuestion[];
  script: MockScript | null;
  answers: MockAnswer[];
  evaluation: MockEvaluation | null;
  overallScore: number | null;
  interviewer: string;
};

export type MockAttempt = {
  id: string;
  status: "in_progress" | "completed";
  overallScore: number | null;
  experienceYears: number | null;
  /** Answers saved so far; an unfinished attempt with any can still be scored. */
  answeredCount: number;
  createdAt: string;
  completedAt: string | null;
};

export type MockOverview = {
  job: { id: string; organization: string; designation: string };
  candidate: { firstName: string; title: string; experienceYears: number | null };
  attempts: MockAttempt[];
  /**
   * Mock interviews allowed and started: per job on a paid plan, for the whole
   * account on the free plan's trial (`trial`).
   */
  attemptLimit: number;
  attemptsUsed: number;
  trial: boolean;
  sections: { name: string; count: number }[];
  questionCount: number;
  interviewer: string;
  voice: "openai" | "browser";
  /** Whether answers are transcribed by the server or the browser's recognizer. */
  transcription: "openai" | "browser";
  /** The visitor's country code from the hosting edge; null on a local server. */
  country: string | null;
};
