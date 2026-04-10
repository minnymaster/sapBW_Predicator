-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('employee', 'hr', 'director');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "competency_grade" AS ENUM ('K1', 'K2', 'K3', 'K4', 'K5');

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "department" (
    "departmentId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "parentId" UUID,
    "headEmployeeId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("departmentId")
);

-- CreateTable
CREATE TABLE "employee" (
    "employeeId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fullName" VARCHAR(300) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'employee',
    "departmentId" UUID,
    "position" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "competency_profile" (
    "profileId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "competencyName" VARCHAR(300) NOT NULL,
    "grade" "competency_grade" NOT NULL,
    "score" DECIMAL(5,2),
    "validFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMPTZ(6),
    "assessedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceAttemptId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_profile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "target_kpi" (
    "kpiId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "departmentId" UUID,
    "targetRole" "user_role",
    "competencyId" UUID NOT NULL,
    "competencyName" VARCHAR(300) NOT NULL,
    "targetGrade" "competency_grade" NOT NULL,
    "targetPercent" DECIMAL(5,2) NOT NULL DEFAULT 80.0,
    "setBy" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "target_kpi_pkey" PRIMARY KEY ("kpiId")
);

-- CreateTable
CREATE TABLE "test_assignment" (
    "assignmentId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "assignedBy" UUID NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'pending',
    "deadline" TIMESTAMPTZ(6),
    "completedAttemptId" UUID,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_assignment_pkey" PRIMARY KEY ("assignmentId")
);

-- CreateTable
CREATE TABLE "external_certificate" (
    "certificateId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "provider" VARCHAR(200) NOT NULL,
    "issuedAt" DATE NOT NULL,
    "fileKey" TEXT,
    "competencyIds" TEXT[],
    "status" "certificate_status" NOT NULL DEFAULT 'pending',
    "reviewedBy" UUID,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_certificate_pkey" PRIMARY KEY ("certificateId")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "logId" BIGSERIAL NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" INET,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("logId")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_email_key" ON "employee"("email");

-- CreateIndex
CREATE INDEX "competency_profile_employeeId_idx" ON "competency_profile"("employeeId");

-- CreateIndex
CREATE INDEX "competency_profile_employeeId_competencyId_idx" ON "competency_profile"("employeeId", "competencyId");

-- CreateIndex
CREATE INDEX "target_kpi_departmentId_idx" ON "target_kpi"("departmentId");

-- CreateIndex
CREATE INDEX "test_assignment_employeeId_idx" ON "test_assignment"("employeeId");

-- CreateIndex
CREATE INDEX "test_assignment_employeeId_status_idx" ON "test_assignment"("employeeId", "status");

-- CreateIndex
CREATE INDEX "external_certificate_employeeId_idx" ON "external_certificate"("employeeId");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_occurredAt_idx" ON "audit_log"("occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "department"("departmentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "employee"("employeeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("departmentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_profile" ADD CONSTRAINT "competency_profile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_kpi" ADD CONSTRAINT "target_kpi_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("departmentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_kpi" ADD CONSTRAINT "target_kpi_setBy_fkey" FOREIGN KEY ("setBy") REFERENCES "employee"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_assignment" ADD CONSTRAINT "test_assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_assignment" ADD CONSTRAINT "test_assignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "employee"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_certificate" ADD CONSTRAINT "external_certificate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_certificate" ADD CONSTRAINT "external_certificate_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "employee"("employeeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "employee"("employeeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- custom_additions.sql — PostgreSQL-специфика
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Partial unique index: один активный профиль компетенции на сотрудника
CREATE UNIQUE INDEX uq_active_competency_profile
    ON competency_profile (employee_id, competency_id)
    WHERE valid_to IS NULL;

-- CHECK: scope для target_kpi
ALTER TABLE target_kpi
    ADD CONSTRAINT chk_kpi_target_scope
    CHECK (department_id IS NOT NULL OR target_role IS NOT NULL);

-- CHECK: допустимый диапазон target_percent
ALTER TABLE target_kpi
    ADD CONSTRAINT chk_kpi_target_percent
    CHECK (target_percent BETWEEN 0 AND 100);

-- updated_at триггеры
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
