-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "material_type" AS ENUM ('video', 'document', 'article', 'link', 'interactive');

-- CreateTable
CREATE TABLE "course" (
    "courseId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" "course_status" NOT NULL DEFAULT 'draft',
    "competencyIds" TEXT[],
    "createdBy" UUID,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("courseId")
);

-- CreateTable
CREATE TABLE "module" (
    "moduleId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "courseId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "module_pkey" PRIMARY KEY ("moduleId")
);

-- CreateTable
CREATE TABLE "material" (
    "materialId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "moduleId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "type" "material_type" NOT NULL,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "fileKey" TEXT,
    "url" TEXT,
    "durationMin" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "material_pkey" PRIMARY KEY ("materialId")
);

-- CreateTable
CREATE TABLE "material_version" (
    "versionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "materialId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "fileKey" TEXT,
    "url" TEXT,
    "changeNote" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_version_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "progressId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "materialVersionId" UUID NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "progressSec" INTEGER NOT NULL DEFAULT 0,
    "firstViewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("progressId")
);

-- CreateIndex
CREATE INDEX "course_status_idx" ON "course"("status");

-- CreateIndex
CREATE INDEX "module_courseId_idx" ON "module"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "module_courseId_orderNumber_key" ON "module"("courseId", "orderNumber");

-- CreateIndex
CREATE INDEX "material_moduleId_idx" ON "material"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "material_moduleId_orderNumber_key" ON "material"("moduleId", "orderNumber");

-- CreateIndex
CREATE INDEX "material_version_materialId_idx" ON "material_version"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "material_version_materialId_versionNumber_key" ON "material_version"("materialId", "versionNumber");

-- CreateIndex
CREATE INDEX "course_progress_employeeId_idx" ON "course_progress"("employeeId");

-- CreateIndex
CREATE INDEX "course_progress_materialId_idx" ON "course_progress"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_employeeId_materialId_key" ON "course_progress"("employeeId", "materialId");

-- AddForeignKey
ALTER TABLE "module" ADD CONSTRAINT "module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "module"("moduleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_version" ADD CONSTRAINT "material_version_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "material"("materialId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "material"("materialId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_materialVersionId_fkey" FOREIGN KEY ("materialVersionId") REFERENCES "material_version"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- custom_additions.sql — PostgreSQL-специфика
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- GIN-индекс по competency_ids для движка рекомендаций (UC-03)
CREATE INDEX idx_course_competencies ON course USING GIN (competency_ids);

-- Partial unique index: одна активная версия материала (NFR-18)
CREATE UNIQUE INDEX uq_material_current_version
    ON material_version (material_id)
    WHERE is_current = TRUE;

-- CHECK: у материала должен быть либо file_key, либо url
ALTER TABLE material
    ADD CONSTRAINT chk_material_source
    CHECK (file_key IS NOT NULL OR url IS NOT NULL);

-- Триггер: деактивация старых версий материала при вставке новой (NFR-18)
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

-- updated_at триггеры
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
