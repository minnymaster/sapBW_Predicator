-- =============================================================================
-- Courses Database — SQL Schema
-- Bounded context: библиотека обучающих материалов, курсы, версионирование контента
-- Соответствует ER-диаграмме (рис. 5 ВКР) и требованиям NFR-16, NFR-18
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Статус публикации курса
CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');

-- Тип учебного объекта (Material)
CREATE TYPE material_type AS ENUM ('video', 'document', 'article', 'link', 'interactive');

-- =============================================================================
-- COURSE — обучающая программа (UC-10, UC-04)
-- course_id экспортируется в certification_db.recommendation (через API, не FK)
-- =============================================================================

CREATE TABLE course (
    course_id       UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(300)    NOT NULL,
    description     TEXT,
    status          course_status   NOT NULL DEFAULT 'draft',
    -- Теги компетенций: массив competency_id из certification_db (не FK — другая БД).
    -- Используется движком рекомендаций для подбора курсов по пробелам (UC-03).
    competency_ids  UUID[]          NOT NULL DEFAULT '{}',
    -- created_by — ID сотрудника (HR) из company_db (не FK)
    created_by      UUID,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_status      ON course(status);
-- GIN-индекс для быстрого поиска курсов по competency_id (UC-03: подбор рекомендаций)
CREATE INDEX idx_course_competencies ON course USING GIN (competency_ids);

-- =============================================================================
-- MODULE — логический раздел курса
-- order_number определяет последовательность прохождения (ВКР: рис. 5)
-- =============================================================================

CREATE TABLE module (
    module_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID        NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    order_number    INT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_module_order UNIQUE (course_id, order_number),
    CONSTRAINT chk_module_order_positive CHECK (order_number >= 0)
);

CREATE INDEX idx_module_course ON module(course_id);

-- =============================================================================
-- MATERIAL — конкретный учебный объект внутри модуля (видео, документ, ссылка)
-- file_key — ключ объекта в S3-совместимом хранилище (для video, document)
-- url — внешняя ссылка (для link, article)
-- =============================================================================

CREATE TABLE material (
    material_id     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID            NOT NULL REFERENCES module(module_id) ON DELETE CASCADE,
    title           VARCHAR(300)    NOT NULL,
    type            material_type   NOT NULL,
    order_number    INT             NOT NULL DEFAULT 0,
    -- Для хранимых файлов (video, document, interactive)
    file_key        TEXT,
    -- Для внешних ресурсов (link, article)
    url             TEXT,
    -- Примерное время изучения в минутах (для отображения в интерфейсе)
    duration_min    INT,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    -- created_by — HR из company_db, не FK
    created_by      UUID,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_material_order   UNIQUE (module_id, order_number),
    CONSTRAINT chk_material_order  CHECK (order_number >= 0),
    -- Либо file_key, либо url — хотя бы одно должно быть заполнено
    CONSTRAINT chk_material_source CHECK (file_key IS NOT NULL OR url IS NOT NULL)
);

CREATE INDEX idx_material_module ON material(module_id);

-- =============================================================================
-- MATERIAL_VERSION — версионирование материалов (NFR-18)
--
-- При каждом изменении содержимого создаётся новая версия.
-- content_hash — SHA-256 файла или URL: позволяет определить, изменилось ли
-- содержимое, и восстановить точную версию, по которой сотрудник обучался.
-- certification_db.recommendation ссылается на material_version_id (не FK).
-- =============================================================================

CREATE TABLE material_version (
    version_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     UUID        NOT NULL REFERENCES material(material_id) ON DELETE CASCADE,
    version_number  INT         NOT NULL DEFAULT 1,
    -- Хэш содержимого файла или URL для отслеживания изменений
    content_hash    TEXT        NOT NULL,
    -- Фактическое расположение версии в хранилище (может отличаться от material.file_key)
    file_key        TEXT,
    url             TEXT,
    -- Комментарий HR об изменениях в версии
    change_note     TEXT,
    is_current      BOOLEAN     NOT NULL DEFAULT TRUE,
    -- created_by — HR из company_db, не FK
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_material_version UNIQUE (material_id, version_number)
);

-- Только одна текущая версия на материал
CREATE UNIQUE INDEX uq_material_current_version
    ON material_version(material_id)
    WHERE is_current = TRUE;

CREATE INDEX idx_material_version_material ON material_version(material_id);

-- =============================================================================
-- COURSE_PROGRESS — прогресс сотрудника по материалам курса (UC-04)
-- employee_id из company_db (не FK — другая БД)
-- Хранит, по какой версии материала сотрудник обучался (NFR-18)
-- =============================================================================

CREATE TABLE course_progress (
    progress_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Из company_db, не FK
    employee_id         UUID        NOT NULL,
    material_id         UUID        NOT NULL REFERENCES material(material_id) ON DELETE CASCADE,
    -- Версия, которую сотрудник просматривал (для воспроизводимости)
    material_version_id UUID        NOT NULL REFERENCES material_version(version_id),
    is_completed        BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Позиция просмотра видео в секундах (для возобновления)
    progress_sec        INT         NOT NULL DEFAULT 0,
    first_viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_viewed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,

    CONSTRAINT uq_progress UNIQUE (employee_id, material_id)
);

CREATE INDEX idx_progress_employee ON course_progress(employee_id);
CREATE INDEX idx_progress_material ON course_progress(material_id);

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

CREATE TRIGGER trg_course_updated_at
    BEFORE UPDATE ON course
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_module_updated_at
    BEFORE UPDATE ON module
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_material_updated_at
    BEFORE UPDATE ON material
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ФУНКЦИЯ: деактивация старых версий материала при добавлении новой (NFR-18)
-- Аналогично question в certification_db
-- =============================================================================

CREATE OR REPLACE FUNCTION deactivate_old_material_versions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE material_version
           SET is_current = FALSE
         WHERE material_id = NEW.material_id
           AND version_id <> NEW.version_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_material_version
    AFTER INSERT ON material_version
    FOR EACH ROW EXECUTE FUNCTION deactivate_old_material_versions();
