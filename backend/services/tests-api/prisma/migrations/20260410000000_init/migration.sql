-- CreateEnum
CREATE TYPE "competency_area" AS ENUM ('data_modeling', 'abap', 'administration', 'bw4hana', 'business_analytics');

-- CreateEnum
CREATE TYPE "competency_grade" AS ENUM ('K1', 'K2', 'K3', 'K4', 'K5');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('single_choice', 'multiple_choice', 'short_answer', 'open_text');

-- CreateEnum
CREATE TYPE "difficulty_level" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('in_progress', 'completed', 'timed_out', 'cancelled');

-- CreateEnum
CREATE TYPE "recommendation_status" AS ENUM ('new', 'viewed', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "competency" (
    "competencyId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "area" "competency_area" NOT NULL,
    "minGrade" "competency_grade" NOT NULL DEFAULT 'K1',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competency_pkey" PRIMARY KEY ("competencyId")
);

-- CreateTable
CREATE TABLE "question" (
    "questionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rootId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "competencyId" UUID NOT NULL,
    "type" "question_type" NOT NULL,
    "difficulty" "difficulty_level" NOT NULL DEFAULT 'medium',
    "text" TEXT NOT NULL,
    "explanation" TEXT,
    "maxScore" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "isLlmGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "answer_option" (
    "optionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "questionId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "answer_option_pkey" PRIMARY KEY ("optionId")
);

-- CreateTable
CREATE TABLE "test" (
    "testId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "timeLimitSec" INTEGER,
    "passingScore" DECIMAL(5,2) NOT NULL DEFAULT 70.0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_pkey" PRIMARY KEY ("testId")
);

-- CreateTable
CREATE TABLE "test_question" (
    "testId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(5,2),

    CONSTRAINT "test_question_pkey" PRIMARY KEY ("testId","questionId")
);

-- CreateTable
CREATE TABLE "test_attempt" (
    "attemptId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "assignmentId" UUID,
    "status" "attempt_status" NOT NULL DEFAULT 'in_progress',
    "isSelfAssessment" BOOLEAN NOT NULL DEFAULT false,
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "timeLeftSec" INTEGER,
    "totalScore" DECIMAL(8,2),
    "maxScore" DECIMAL(8,2),
    "gradeAchieved" "competency_grade",
    "ipAddress" INET,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_attempt_pkey" PRIMARY KEY ("attemptId")
);

-- CreateTable
CREATE TABLE "answer_log" (
    "logId" BIGSERIAL NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "selectedOptionIds" TEXT[],
    "answerText" TEXT,
    "isCorrect" BOOLEAN,
    "score" DECIMAL(5,2),
    "llmScore" DECIMAL(5,2),
    "llmExplanation" TEXT,
    "needsHrReview" BOOLEAN NOT NULL DEFAULT false,
    "hrScore" DECIMAL(5,2),
    "hrComment" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "answeredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_log_pkey" PRIMARY KEY ("logId")
);

-- CreateTable
CREATE TABLE "competency_result" (
    "resultId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attemptId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,
    "gradeAchieved" "competency_grade" NOT NULL,
    "calculatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_result_pkey" PRIMARY KEY ("resultId")
);

-- CreateTable
CREATE TABLE "competency_gap" (
    "gapId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attemptId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "actualGrade" "competency_grade" NOT NULL,
    "targetGrade" "competency_grade" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_gap_pkey" PRIMARY KEY ("gapId")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "recommendationId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gapId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "courseTitle" VARCHAR(300) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "status" "recommendation_status" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("recommendationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_name_key" ON "competency"("name");

-- CreateIndex
CREATE INDEX "question_competencyId_idx" ON "question"("competencyId");

-- CreateIndex
CREATE INDEX "question_rootId_idx" ON "question"("rootId");

-- CreateIndex
CREATE UNIQUE INDEX "question_rootId_versionNumber_key" ON "question"("rootId", "versionNumber");

-- CreateIndex
CREATE INDEX "answer_option_questionId_idx" ON "answer_option"("questionId");

-- CreateIndex
CREATE INDEX "test_question_testId_idx" ON "test_question"("testId");

-- CreateIndex
CREATE INDEX "test_attempt_employeeId_idx" ON "test_attempt"("employeeId");

-- CreateIndex
CREATE INDEX "test_attempt_testId_idx" ON "test_attempt"("testId");

-- CreateIndex
CREATE INDEX "answer_log_attemptId_idx" ON "answer_log"("attemptId");

-- CreateIndex
CREATE INDEX "competency_result_attemptId_idx" ON "competency_result"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_result_attemptId_competencyId_key" ON "competency_result"("attemptId", "competencyId");

-- CreateIndex
CREATE INDEX "competency_gap_attemptId_idx" ON "competency_gap"("attemptId");

-- CreateIndex
CREATE INDEX "competency_gap_competencyId_idx" ON "competency_gap"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_gap_attemptId_competencyId_key" ON "competency_gap"("attemptId", "competencyId");

-- CreateIndex
CREATE INDEX "recommendation_employeeId_idx" ON "recommendation"("employeeId");

-- CreateIndex
CREATE INDEX "recommendation_gapId_idx" ON "recommendation"("gapId");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_gapId_courseId_key" ON "recommendation"("gapId", "courseId");

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("competencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_option" ADD CONSTRAINT "answer_option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("questionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question" ADD CONSTRAINT "test_question_testId_fkey" FOREIGN KEY ("testId") REFERENCES "test"("testId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question" ADD CONSTRAINT "test_question_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("questionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "test"("testId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_log" ADD CONSTRAINT "answer_log_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "test_attempt"("attemptId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_log" ADD CONSTRAINT "answer_log_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("questionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_result" ADD CONSTRAINT "competency_result_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "test_attempt"("attemptId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_result" ADD CONSTRAINT "competency_result_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("competencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_gap" ADD CONSTRAINT "competency_gap_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "test_attempt"("attemptId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_gap" ADD CONSTRAINT "competency_gap_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("competencyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "competency_gap"("gapId") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- custom_additions.sql — PostgreSQL-специфика (partial indexes, triggers, generated columns)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Partial unique index: одна активная версия вопроса на root_id (NFR-18)
CREATE UNIQUE INDEX uq_question_current_version
    ON question (root_id)
    WHERE is_current = TRUE;

-- Partial index: активные попытки
CREATE INDEX idx_attempt_active
    ON test_attempt (employee_id, status)
    WHERE status = 'in_progress';

-- Partial index: ответы, ожидающие проверки HR
CREATE INDEX idx_answer_pending_review
    ON answer_log (attempt_id)
    WHERE needs_hr_review = TRUE AND hr_score IS NULL;

-- Partial index: новые рекомендации
CREATE INDEX idx_recommendation_new
    ON recommendation (employee_id, status)
    WHERE status = 'new';

-- GENERATED ALWAYS: числовой размер пробела компетенции
ALTER TABLE competency_gap
    ADD COLUMN gap_size INT GENERATED ALWAYS AS (
        (CASE target_grade
            WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3
            WHEN 'K4' THEN 4 WHEN 'K5' THEN 5
        END)
        -
        (CASE actual_grade
            WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3
            WHEN 'K4' THEN 4 WHEN 'K5' THEN 5
        END)
    ) STORED;

ALTER TABLE competency_gap
    ADD CONSTRAINT chk_gap_exists CHECK (
        (CASE target_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
        >
        (CASE actual_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
    );

-- Триггер: деактивация старых версий вопроса при вставке новой (NFR-18)
CREATE OR REPLACE FUNCTION deactivate_old_question_versions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE question
           SET is_current = FALSE
         WHERE root_id = NEW.root_id
           AND question_id <> NEW.question_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_question_version
    AFTER INSERT ON question
    FOR EACH ROW EXECUTE FUNCTION deactivate_old_question_versions();

-- updated_at триггеры
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_competency_updated_at
    BEFORE UPDATE ON competency
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_test_updated_at
    BEFORE UPDATE ON test
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recommendation_updated_at
    BEFORE UPDATE ON recommendation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
