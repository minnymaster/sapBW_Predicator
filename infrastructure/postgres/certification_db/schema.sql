-- =============================================================================
-- Certification Database — SQL Schema
-- Bounded context: банк вопросов, тестирование, результаты, рекомендации
-- Соответствует ER-диаграмме (рис. 6 ВКР) и требованиям NFR-16, NFR-17, NFR-18, NFR-19
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Грейды K1–K5 (модель компетенций SAP BW)
CREATE TYPE competency_grade AS ENUM ('K1', 'K2', 'K3', 'K4', 'K5');

-- Тематические области SAP BW (таблица 1 ВКР)
CREATE TYPE competency_area AS ENUM (
    'data_modeling',        -- моделирование данных
    'abap',                 -- разработка на ABAP
    'administration',       -- администрирование
    'bw4hana',              -- BW/4HANA
    'business_analytics'    -- бизнес-аналитика
);

-- Тип вопроса: закрытый (single/multi), открытый, короткий ответ
CREATE TYPE question_type AS ENUM ('single_choice', 'multiple_choice', 'short_answer', 'open_text');

-- Уровень сложности вопроса
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Статус попытки прохождения теста
CREATE TYPE attempt_status AS ENUM ('in_progress', 'completed', 'timed_out', 'cancelled');

-- Статус рекомендации
CREATE TYPE recommendation_status AS ENUM ('new', 'viewed', 'in_progress', 'completed');

-- =============================================================================
-- COMPETENCY — справочник компетенций (общий для всех трёх БД через API)
-- competency_id экспортируется в company_db и courses_db через события
-- =============================================================================

CREATE TABLE competency (
    competency_id   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(300)    NOT NULL,
    description     TEXT,
    area            competency_area NOT NULL,
    -- Минимальный грейд для данной компетенции (обычно K1)
    min_grade       competency_grade NOT NULL DEFAULT 'K1',
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_competency_name UNIQUE (name)
);

-- =============================================================================
-- QUESTION — вопрос с версионированием (NFR-18)
--
-- Версионирование реализовано через root_id + version_number:
--   - root_id = question_id первой версии (неизменяем)
--   - при редактировании создаётся новая строка с тем же root_id и version+1
--   - question_id (физический) уникален для каждой версии
-- Попытки и test_question ссылаются на конкретный question_id (версию),
-- что гарантирует воспроизводимость истории тестов.
-- =============================================================================

CREATE TABLE question (
    question_id     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Логический идентификатор вопроса, общий для всех его версий
    root_id         UUID            NOT NULL,
    version_number  INT             NOT NULL DEFAULT 1,
    competency_id   UUID            NOT NULL REFERENCES competency(competency_id),
    type            question_type   NOT NULL,
    difficulty      difficulty_level NOT NULL DEFAULT 'medium',
    text            TEXT            NOT NULL,
    -- Объяснение правильного ответа (показывается после завершения теста)
    explanation     TEXT,
    max_score       NUMERIC(5, 2)   NOT NULL DEFAULT 1.0,
    -- Флаг «текущая версия» — только одна версия на root_id может быть активной
    is_current      BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Создан ли вопрос через LLM (CLAUDE.md: все LLM-промпты документируются в коде)
    is_llm_generated BOOLEAN        NOT NULL DEFAULT FALSE,
    -- created_by — ID сотрудника (HR) из company_db, не FK
    created_by      UUID,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_question_version UNIQUE (root_id, version_number),
    -- Только одна текущая версия на root_id (partial unique index ниже)
    CONSTRAINT chk_score_positive CHECK (max_score > 0)
);

-- Только одна активная версия на root_id
CREATE UNIQUE INDEX uq_question_current_version
    ON question (root_id)
    WHERE is_current = TRUE;

CREATE INDEX idx_question_competency ON question(competency_id) WHERE is_current = TRUE;
CREATE INDEX idx_question_root       ON question(root_id);

-- =============================================================================
-- ANSWER_OPTION — варианты ответов для закрытых вопросов (single/multiple choice)
-- =============================================================================

CREATE TABLE answer_option (
    option_id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Привязка к конкретной версии вопроса
    question_id     UUID    NOT NULL REFERENCES question(question_id) ON DELETE CASCADE,
    text            TEXT    NOT NULL,
    is_correct      BOOLEAN NOT NULL DEFAULT FALSE,
    order_number    INT     NOT NULL DEFAULT 0,

    CONSTRAINT chk_option_order_positive CHECK (order_number >= 0)
);

CREATE INDEX idx_answer_option_question ON answer_option(question_id);

-- =============================================================================
-- TEST — тест (коллекция вопросов с параметрами прохождения)
-- =============================================================================

CREATE TABLE test (
    test_id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    -- Ограничение времени в секундах, NULL = без ограничения
    time_limit_sec  INT,
    -- Проходной порог в процентах (0..100)
    passing_score   NUMERIC(5, 2) NOT NULL DEFAULT 70.0
        CHECK (passing_score BETWEEN 0 AND 100),
    max_attempts    INT     NOT NULL DEFAULT 1
        CHECK (max_attempts > 0),
    -- Доступен ли тест для прохождения / самооценки (UC-05)
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    -- created_by — HR из company_db, не FK
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TEST_QUESTION — вопросы теста (M:N)
-- Ссылается на конкретную версию question_id для воспроизводимости (NFR-18)
-- =============================================================================

CREATE TABLE test_question (
    test_id         UUID            NOT NULL REFERENCES test(test_id) ON DELETE CASCADE,
    question_id     UUID            NOT NULL REFERENCES question(question_id),
    order_number    INT             NOT NULL DEFAULT 0,
    -- Вес вопроса внутри теста (по умолчанию равен max_score вопроса)
    weight          NUMERIC(5, 2),

    PRIMARY KEY (test_id, question_id)
);

CREATE INDEX idx_test_question_test ON test_question(test_id);

-- =============================================================================
-- TEST_ATTEMPT — попытка прохождения теста сотрудником (UC-01, UC-05)
-- employee_id и assignment_id — ссылки на company_db (не FK)
-- =============================================================================

CREATE TABLE test_attempt (
    attempt_id      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id         UUID            NOT NULL REFERENCES test(test_id),
    -- Из company_db — не FK
    employee_id     UUID            NOT NULL,
    -- NULL для самооценки (UC-05) — нет назначения
    assignment_id   UUID,
    status          attempt_status  NOT NULL DEFAULT 'in_progress',
    -- UC-05: самооценка не влияет на официальную статистику
    is_self_assessment BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Прогресс: индекс текущего вопроса (для возобновления, UC-01 alt.3)
    current_question_index INT      NOT NULL DEFAULT 0,
    -- Оставшееся время при паузе (секунды)
    time_left_sec   INT,
    total_score     NUMERIC(8, 2),
    max_score       NUMERIC(8, 2),
    -- Достигнутый грейд (заполняется при finish)
    grade_achieved  competency_grade,
    -- NFR-09: IP для аудита
    ip_address      INET,
    started_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempt_employee ON test_attempt(employee_id);
CREATE INDEX idx_attempt_test     ON test_attempt(test_id);
CREATE INDEX idx_attempt_active   ON test_attempt(employee_id, status)
    WHERE status = 'in_progress';

-- =============================================================================
-- ANSWER_LOG — детальный лог каждого ответа в попытке (NFR-09, UC-02)
-- Поддерживает как закрытые ответы (option_ids), так и открытые (answer_text)
-- LLM-поля заполняются асинхронно для open_text / short_answer вопросов
-- =============================================================================

CREATE TABLE answer_log (
    log_id              BIGSERIAL       PRIMARY KEY,
    attempt_id          UUID            NOT NULL REFERENCES test_attempt(attempt_id) ON DELETE CASCADE,
    -- Ссылка на конкретную версию вопроса (NFR-18)
    question_id         UUID            NOT NULL REFERENCES question(question_id),
    -- Для закрытых вопросов: массив выбранных option_id
    selected_option_ids UUID[]          NOT NULL DEFAULT '{}',
    -- Для открытых / коротких ответов
    answer_text         TEXT,
    -- Автоматическая проверка (закрытые вопросы — сразу, открытые — после LLM)
    is_correct          BOOLEAN,
    score               NUMERIC(5, 2),
    -- LLM-оценка открытых ответов (заполняется асинхронно)
    llm_score           NUMERIC(5, 2),
    llm_explanation     TEXT,
    -- Ручная проверка HR для открытых вопросов (UC-01, alt.2)
    needs_hr_review     BOOLEAN         NOT NULL DEFAULT FALSE,
    hr_score            NUMERIC(5, 2),
    hr_comment          TEXT,
    -- reviewed_by — HR из company_db, не FK
    reviewed_by         UUID,
    reviewed_at         TIMESTAMPTZ,
    answered_at         TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_answer_log_attempt  ON answer_log(attempt_id);
CREATE INDEX idx_answer_log_pending  ON answer_log(attempt_id) WHERE needs_hr_review = TRUE AND hr_score IS NULL;

-- =============================================================================
-- COMPETENCY_RESULT — итоговый балл по каждой компетенции после попытки
-- Рассчитывается при /v1/attempts/{id}/finish и публикуется как событие в company_db
-- =============================================================================

CREATE TABLE competency_result (
    result_id       UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID            NOT NULL REFERENCES test_attempt(attempt_id) ON DELETE CASCADE,
    competency_id   UUID            NOT NULL REFERENCES competency(competency_id),
    score           NUMERIC(5, 2)   NOT NULL,
    max_score       NUMERIC(5, 2)   NOT NULL,
    grade_achieved  competency_grade NOT NULL,
    calculated_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_result_per_attempt UNIQUE (attempt_id, competency_id)
);

CREATE INDEX idx_comp_result_attempt ON competency_result(attempt_id);

-- =============================================================================
-- COMPETENCY_GAP — выявленный пробел после завершения теста (UC-03)
-- Сравнивает фактический грейд с целевым (target берётся из company_db.target_kpi через API)
-- =============================================================================

CREATE TABLE competency_gap (
    gap_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID            NOT NULL REFERENCES test_attempt(attempt_id) ON DELETE CASCADE,
    competency_id   UUID            NOT NULL REFERENCES competency(competency_id),
    actual_grade    competency_grade NOT NULL,
    -- Целевой грейд, полученный из company_db на момент расчёта (денормализован)
    target_grade    competency_grade NOT NULL,
    -- Числовой разрыв (target - actual в «ступенях»): для сортировки по приоритету
    gap_size        INT             NOT NULL
        GENERATED ALWAYS AS (
            (CASE target_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
            -
            (CASE actual_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
        ) STORED,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_gap_per_attempt UNIQUE (attempt_id, competency_id),
    CONSTRAINT chk_gap_exists CHECK (
        (CASE target_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
        >
        (CASE actual_grade WHEN 'K1' THEN 1 WHEN 'K2' THEN 2 WHEN 'K3' THEN 3 WHEN 'K4' THEN 4 WHEN 'K5' THEN 5 END)
    )
);

CREATE INDEX idx_gap_attempt     ON competency_gap(attempt_id);
CREATE INDEX idx_gap_competency  ON competency_gap(competency_id);

-- =============================================================================
-- RECOMMENDATION — рекомендация по устранению пробела (UC-03, UC-04)
-- course_id и course_title ссылаются на courses_db (не FK — другая БД)
-- Объяснение генерируется LLM асинхронно
-- =============================================================================

CREATE TABLE recommendation (
    recommendation_id   UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id              UUID                    NOT NULL REFERENCES competency_gap(gap_id) ON DELETE CASCADE,
    -- employee_id из company_db (не FK) — нужен для быстрой выборки рекомендаций сотрудника
    employee_id         UUID                    NOT NULL,
    -- Ссылка на курс из courses_db (не FK — другая БД)
    course_id           UUID                    NOT NULL,
    -- Денормализованное название курса для воспроизводимости (NFR-18)
    course_title        VARCHAR(300)            NOT NULL,
    -- Приоритет: 1 = наивысший (определяется размером gap_size)
    priority            INT                     NOT NULL DEFAULT 1
        CHECK (priority > 0),
    -- LLM-объяснение, почему рекомендован именно этот курс
    explanation         TEXT,
    status              recommendation_status   NOT NULL DEFAULT 'new',
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT now(),

    -- Один курс не должен рекомендоваться дважды по одному и тому же пробелу
    CONSTRAINT uq_recommendation UNIQUE (gap_id, course_id)
);

CREATE INDEX idx_recommendation_employee ON recommendation(employee_id);
CREATE INDEX idx_recommendation_gap      ON recommendation(gap_id);
CREATE INDEX idx_recommendation_new      ON recommendation(employee_id, status) WHERE status = 'new';

-- =============================================================================
-- TRIGGERS — автообновление updated_at
-- =============================================================================

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

-- =============================================================================
-- ФУНКЦИЯ: деактивация старых версий вопроса при добавлении новой
-- Вызывается вручную из приложения через транзакцию (NFR-17)
-- =============================================================================

CREATE OR REPLACE FUNCTION deactivate_old_question_versions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- При вставке новой версии — снимаем флаг is_current со всех предыдущих
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
