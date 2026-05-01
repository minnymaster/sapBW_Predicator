export type QuestionType = 'single_choice' | 'multiple_choice' | 'short_answer' | 'open_text';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface AnswerOption {
  optionId: string;
  text: string;
  isCorrect: boolean;
  orderNumber: number;
}

export interface QuestionItem {
  questionId: string;
  rootId: string;
  versionNumber: number;
  competencyId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  text: string;
  explanation: string | null;
  maxScore: number;
  isCurrent: boolean;
  isLlmGenerated: boolean;
  createdBy: string | null;
  createdAt: string;
  answerOptions: AnswerOption[];
}

export interface PaginatedQuestions {
  data: QuestionItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAnswerOptionDto {
  text: string;
  isCorrect: boolean;
  orderNumber: number;
}

export interface CreateQuestionDto {
  competencyId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  text: string;
  explanation?: string;
  maxScore?: number;
  answerOptions?: CreateAnswerOptionDto[];
}

export type UpdateQuestionDto = Partial<CreateQuestionDto>;

// GET /v1/competencies
export interface Competency {
  competencyId: string;
  name: string;
  area: string;
  minGrade: string;
  isActive: boolean;
}

// POST /v1/competencies/:id/generate-questions
export interface GenerateQuestionsDto {
  difficulty: DifficultyLevel;
  count: number;
}
