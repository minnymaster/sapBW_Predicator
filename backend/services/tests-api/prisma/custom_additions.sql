-- =============================================================================
-- certification_db — дополнения к сгенерированной Prisma миграции
-- Вставить в конец migration.sql после `prisma migrate dev --create-only`
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Partial unique index: одна активная версия вопроса на root_id (NFR-18)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_question_current_version
    ON question (root_id)
    WHERE is_current = TRUE;

-- ---------------------------------------------------------------------------
-- Partial index: активные попытки (для быстрой выборки незавершённых)
-- ---------------------------------------------------------------------------
CREATE INDEX idx_attempt_active
    ON test_attempt (employee_id, status)
    WHERE status = 'in_progress';

-- ---------------------------------------------------------------------------
-- Partial index: ответы, ожидающие проверки HR
-- ---------------------------------------------------------------------------
CREATE INDEX idx_answer_pending_review
    ON answer_log (attempt_id)
    WHERE needs_hr_review = TRUE AND hr_score IS NULL;

-- ---------------------------------------------------------------------------
-- Partial index: новые рекомендации сотрудника
-- ---------------------------------------------------------------------------
CREATE INDEX idx_recommendation_new
    ON recommendation (employee_id, status)
    WHERE status = 'new';

-- ---------------------------------------------------------------------------
-- GENERATED ALWAYS: числовой размер пробела (target - actual в ступенях)
-- Prisma не поддерживает GENERATED ALWAYS AS — добавляем вручную.
-- Читается через $queryRaw когда нужна сортировка по gap_size.
-- ---------------------------------------------------------------------------
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

-- CHECK: пробел должен быть положительным (иначе нет смысла в записи)
ALTER TABLE competency_gap
    ADD CONSTRAINT chk_gap_exists CHECK (
        (CASE target_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
        >
        (CASE actual_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
    );

-- ---------------------------------------------------------------------------
-- Триггер: деактивация старых версий вопроса при вставке новой (NFR-18)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Функция и триггеры updated_at (для таблиц без @updatedAt в Prisma)
-- ---------------------------------------------------------------------------
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
