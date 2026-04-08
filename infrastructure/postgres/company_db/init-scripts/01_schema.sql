-- =============================================================================
-- Company Database — SQL Schema
-- Bounded context: корпоративная структура, сотрудники, компетенции, KPI
-- Соответствует ER-диаграмме (рис. 4 ВКР) и требованиям NFR-16, NFR-18, NFR-19
-- =============================================================================

-- Расширения
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('employee', 'hr', 'director');

-- Статус назначения теста (UC-09)
CREATE TYPE assignment_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');

-- Грейды компетенций K1–K5 (модель компетенций SAP BW)
CREATE TYPE competency_grade AS ENUM ('K1', 'K2', 'K3', 'K4', 'K5');

-- Статус заявки на внешний сертификат (UC-06)
CREATE TYPE certificate_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================================================
-- DEPARTMENT — иерархия подразделений компании
-- =============================================================================

CREATE TABLE department (
    department_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    -- Самосвязь для иерархии (головной офис → отдел → группа)
    parent_id       UUID        REFERENCES department(department_id) ON DELETE SET NULL,
    -- Руководитель подразделения (FK на employee, добавляется через ALTER ниже)
    head_employee_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- EMPLOYEE — сотрудник, центральная сущность (UC-01..UC-15)
-- employee_id используется как внешний ключ в других БД через события/API
-- =============================================================================

CREATE TABLE employee (
    employee_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Персональные данные (NFR-06: хранятся в зашифрованном виде на уровне приложения)
    full_name       VARCHAR(300) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    -- Роль для RBAC (NFR-08)
    role            user_role   NOT NULL DEFAULT 'employee',
    -- Организационная привязка
    department_id   UUID        REFERENCES department(department_id) ON DELETE SET NULL,
    position        VARCHAR(200),
    -- Флаг активности (мягкое удаление)
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    -- JWT: refresh-токен не хранится — только хэш для инвалидации
    password_hash   TEXT        NOT NULL,
    -- NFR-19: один активный профиль на сотрудника гарантируется через уникальность email
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_employee_email UNIQUE (email)
);

-- Теперь можно проставить FK руководителя отдела
ALTER TABLE department
    ADD CONSTRAINT fk_department_head
    FOREIGN KEY (head_employee_id) REFERENCES employee(employee_id) ON DELETE SET NULL;

-- =============================================================================
-- COMPETENCY_PROFILE — фактический уровень компетенций сотрудника
-- Поддерживает историю изменений (valid_from/valid_to) для UC-02, NFR-18
-- =============================================================================

CREATE TABLE competency_profile (
    profile_id      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID            NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    -- ID компетенции из certification_db (не FK — разные БД, связь через API)
    competency_id   UUID            NOT NULL,
    -- Название компетенции дублируется для денормализации (воспроизводимость истории)
    competency_name VARCHAR(300)    NOT NULL,
    grade           competency_grade NOT NULL,
    score           NUMERIC(5, 2),              -- балл 0..100 при желании
    -- Поля версионирования (NFR-18): valid_to = NULL означает текущую запись
    valid_from      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    valid_to        TIMESTAMPTZ,
    assessed_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    -- Ссылка на источник оценки (attempt_id из certification_db — не FK)
    source_attempt_id UUID,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Среди всех записей по сотруднику + компетенции может быть только одна активная
    CONSTRAINT uq_active_profile UNIQUE NULLS NOT DISTINCT (employee_id, competency_id, valid_to)
);

CREATE INDEX idx_competency_profile_employee ON competency_profile(employee_id);
CREATE INDEX idx_competency_profile_active   ON competency_profile(employee_id, competency_id) WHERE valid_to IS NULL;

-- =============================================================================
-- TARGET_KPI — целевые показатели компетенций для подразделений/ролей (UC-15)
-- =============================================================================

CREATE TABLE target_kpi (
    kpi_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Привязка к подразделению ИЛИ к роли (хотя бы одно должно быть заполнено)
    department_id   UUID            REFERENCES department(department_id) ON DELETE CASCADE,
    target_role     user_role,
    -- ID компетенции из certification_db (не FK)
    competency_id   UUID            NOT NULL,
    competency_name VARCHAR(300)    NOT NULL,
    target_grade    competency_grade NOT NULL,
    -- Порог достижения: «N% сотрудников должны иметь уровень >= target_grade»
    target_percent  NUMERIC(5, 2)   NOT NULL DEFAULT 80.0
        CHECK (target_percent BETWEEN 0 AND 100),
    -- Кто установил KPI (директор)
    set_by          UUID            NOT NULL REFERENCES employee(employee_id),
    -- Период действия
    period_start    DATE            NOT NULL,
    period_end      DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT chk_kpi_target_scope CHECK (department_id IS NOT NULL OR target_role IS NOT NULL)
);

CREATE INDEX idx_target_kpi_department ON target_kpi(department_id);

-- =============================================================================
-- TEST_ASSIGNMENT — назначение теста сотруднику (UC-08, UC-09)
-- test_id ссылается на Test в certification_db (не FK — другая БД)
-- =============================================================================

CREATE TABLE test_assignment (
    assignment_id   UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID                NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    -- test_id из certification_db
    test_id         UUID                NOT NULL,
    -- Кто назначил (HR)
    assigned_by     UUID                NOT NULL REFERENCES employee(employee_id),
    status          assignment_status   NOT NULL DEFAULT 'pending',
    deadline        TIMESTAMPTZ,
    -- Ссылка на попытку при завершении (attempt_id из certification_db — не FK)
    completed_attempt_id UUID,
    assigned_at     TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),

    -- NFR-19: один активный тест не может быть назначен дважды
    CONSTRAINT uq_assignment UNIQUE (employee_id, test_id, status)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_assignment_employee ON test_assignment(employee_id);
CREATE INDEX idx_assignment_status   ON test_assignment(employee_id, status);

-- =============================================================================
-- EXTERNAL_CERTIFICATE — внешние сертификаты, загруженные сотрудником (UC-06)
-- =============================================================================

CREATE TABLE external_certificate (
    certificate_id  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID                NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    title           VARCHAR(300)        NOT NULL,
    provider        VARCHAR(200)        NOT NULL,
    issued_at       DATE                NOT NULL,
    -- Ключ файла в объектном хранилище (S3-совместимом)
    file_key        TEXT,
    -- Привязка к компетенциям (массив ID из certification_db)
    competency_ids  UUID[]              NOT NULL DEFAULT '{}',
    status          certificate_status  NOT NULL DEFAULT 'pending',
    reviewed_by     UUID                REFERENCES employee(employee_id),
    review_comment  TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_ext_cert_employee ON external_certificate(employee_id);

-- =============================================================================
-- AUDIT_LOG — журнал изменений (NFR-09)
-- Только INSERT, изменение записей запрещено (immutable log)
-- =============================================================================

CREATE TABLE audit_log (
    log_id          BIGSERIAL   PRIMARY KEY,
    -- actor_id = NULL означает системное событие
    actor_id        UUID        REFERENCES employee(employee_id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,   -- например: 'employee.created', 'kpi.updated'
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID,
    -- Diff: что изменилось (old → new)
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Только append: запретить UPDATE/DELETE через политику RLS или в приложении
CREATE INDEX idx_audit_entity   ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor    ON audit_log(actor_id);
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at DESC);

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

CREATE TRIGGER trg_employee_updated_at
    BEFORE UPDATE ON employee
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_department_updated_at
    BEFORE UPDATE ON department
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_target_kpi_updated_at
    BEFORE UPDATE ON target_kpi
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assignment_updated_at
    BEFORE UPDATE ON test_assignment
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ext_cert_updated_at
    BEFORE UPDATE ON external_certificate
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
