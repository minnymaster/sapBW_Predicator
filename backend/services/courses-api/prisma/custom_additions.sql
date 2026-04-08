-- =============================================================================
-- courses_db — дополнения к сгенерированной Prisma миграции
-- Вставить в конец migration.sql после `prisma migrate dev --create-only`
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- GIN-индекс по competency_ids (UUID[] → text[])
-- Позволяет движку рекомендаций (UC-03) быстро искать курсы по competency_id
-- Prisma не поддерживает GIN — добавляем вручную
-- ---------------------------------------------------------------------------
CREATE INDEX idx_course_competencies ON course USING GIN (competency_ids);

-- ---------------------------------------------------------------------------
-- Partial unique index: одна активная версия материала (NFR-18)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_material_current_version
    ON material_version (material_id)
    WHERE is_current = TRUE;

-- ---------------------------------------------------------------------------
-- CHECK: у материала должен быть либо file_key, либо url
-- ---------------------------------------------------------------------------
ALTER TABLE material
    ADD CONSTRAINT chk_material_source
    CHECK (file_key IS NOT NULL OR url IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Триггер: деактивация старых версий материала при вставке новой (NFR-18)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Функция и триггеры updated_at
-- ---------------------------------------------------------------------------
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
