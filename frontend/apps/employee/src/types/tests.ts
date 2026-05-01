import type { Grade } from './dashboard';

export type { Grade };
export type QuestionType = 'single_choice' | 'multiple_choice' | 'short_answer' | 'open_text';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type AttemptStatus = 'in_progress' | 'completed' | 'timed_out' | 'cancelled';

// ─── GET /v1/tests ────────────────────────────────────────────────────────────

export interface TestListItem {
  testId: string;
  title: string;
  description: string | null;
  timeLimitSec: number | null;
  passingScore: number;
  maxAttempts: number;
  isActive: boolean;
  createdAt: string;
  _count: {
    testQuestions: number;
  };
}

// ─── POST /v1/tests/:id/start ─────────────────────────────────────────────────

export interface StartAttemptResponse {
  attempt_id: string;
  time_left_sec: number | null;
}

// ─── GET /v1/attempts/:id/next-question ──────────────────────────────────────

export interface AnswerOption {
  optionId: string;
  text: string;
  orderNumber: number;
}

export interface QuestionPayload {
  question_id: string;
  text: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  max_score: number;
  answer_options: AnswerOption[];
}

export type NextQuestionResponse =
  | { done: true; current_index: number; total_questions: number }
  | {
      done: false;
      attempt_id: string;
      current_index: number;
      total_questions: number;
      question: QuestionPayload;
    };

// ─── POST /v1/attempts/:id/answer ────────────────────────────────────────────

export interface SubmitAnswerRequest {
  questionId: string;
  selectedOptionIds?: string[];
  answerText?: string;
}

export interface SubmitAnswerResponse {
  logId: string;
  is_correct: boolean | null;
  explanation: string | null;
}

// ─── POST /v1/attempts/:id/finish ────────────────────────────────────────────

export interface CompetencyResultItem {
  attemptId: string;
  competencyId: string;
  score: number;
  maxScore: number;
  gradeAchieved: Grade;
}

export interface CompetencyGapItem {
  attemptId: string;
  competencyId: string;
  actualGrade: Grade;
  targetGrade: Grade;
}

export interface FinishAttemptResponse {
  attemptId: string;
  status: AttemptStatus;
  gradeAchieved: Grade | null;
  totalScore: number;
  maxScore: number;
  finishedAt: string | null;
  competencyResultsCount: number;
  competencyGapsCount: number;
  competencyResults: CompetencyResultItem[];
  competencyGaps: CompetencyGapItem[];
}

// ─── GET /v1/competencies ────────────────────────────────────────────────────

export interface Competency {
  competencyId: string;
  name: string;
  area: string;
  minGrade: Grade;
  isActive: boolean;
}
