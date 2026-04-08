-- =============================================================================
-- company_db — дополнения к сгенерированной Prisma миграции
-- Вставить в конец migration.sql после `prisma migrate dev --create-only`
-- =============================================================================

-- Расширение (Prisma не генерирует CREATE EXTENSION)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Partial unique index: один активный профиль компетенции на сотрудника
-- Prisma не поддерживает WHERE в @@index / @@unique
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_active_competency_profile
    ON competency_profile (employee_id, competency_id)
    WHERE valid_to IS NULL;

-- ---------------------------------------------------------------------------
-- CHECK: scope для target_kpi (хотя бы department или role)
-- ---------------------------------------------------------------------------
ALTER TABLE target_kpi
    ADD CONSTRAINT chk_kpi_target_scope
    CHECK (department_id IS NOT NULL OR target_role IS NOT NULL);

-- ---------------------------------------------------------------------------
-- CHECK: допустимый диапазон target_percent
-- ---------------------------------------------------------------------------
ALTER TABLE target_kpi
    ADD CONSTRAINT chk_kpi_target_percent
    CHECK (target_percent BETWEEN 0 AND 100);

-- ---------------------------------------------------------------------------
-- Функция и триггеры updated_at
-- Prisma генерирует @updatedAt на уровне приложения, но для прямых SQL-запросов
-- и возможных внешних вставок нужен DB-триггер
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_department_updated_at
    BEFORE UPDATE ON department
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employee_updated_at
    BEFORE UPDATE ON employee
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
