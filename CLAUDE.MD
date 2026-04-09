# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Общая информация
- **Проект**: Цифровой сервис для оценки компетенций SAP BW
- **Тип**: ВКР бакалавра, направление 09.03.04 Программная инженерия, НИУ ВШЭ — Пермь, 2026
- **Источник истины**: `docs/vkr/ВКР_полный_текст.md` (и `.docx`) — все архитектурные решения должны соответствовать главе 2 ВКР

## Технологический стек (обязательно соблюдать)

| Слой | Технология |
|------|-----------|
| Backend | Node.js + TypeScript, NestJS |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query |
| БД | 3 отдельные PostgreSQL: `company_db`, `courses_db`, `certification_db` |
| ORM | Prisma (предпочтительно) или TypeORM |
| API Gateway | Traefik (или Nginx) — три отдельных шлюза |
| LLM | Llama-3.1-70B + LoRA-адаптер (или Groq/LM Studio локально) |
| Auth | JWT RS256 |
| Инфраструктура | Docker + Docker Compose |
| API-спецификация | REST + OpenAPI 3.0 |

## Команды разработки

```bash
# tests-api (backend/services/tests-api)
npm run dev                     # NestJS watch mode
npm run build                   # сборка TypeScript → dist/
npm run lint                    # ESLint
npm run test                    # Jest unit-тесты
npm run test:e2e                # e2e тесты
npm run prisma:generate         # генерация Prisma Client
npm run prisma:migrate          # применить миграции (deploy)

# Инфраструктура (infrastructure/)
docker compose up -d                    # поднять всё
docker compose up -d certification_db   # только БД Tests API
docker compose up -d tests-api          # только Tests API
```

## Архитектура (строго по ВКР, глава 2)

### C4 Level 1 — Системный контекст
Три актора: **Employee**, **HR**, **Director**. Внешние системы — будущие точки интеграции.
Диаграммы: `architecture/c4_level1_context.png`, `architecture/c4_level2_containers.png`.

### C4 Level 2 — Контейнеры

```
[Employee SPA] [HR SPA] [Director SPA]
       ↓            ↓           ↓
[Learning GW]  [Manage GW]  [Analytics GW]   ← три Traefik/Nginx шлюза
       ↓            ↓           ↓
  [Tests API]  [Manage API]  [Reports API]
  [Courses API]              [Dashboard API]
       ↓            ↓           ↓
[certification_db] [courses_db] [company_db]  ← Database-per-Service
```

### Три домена и их шлюзы

| Gateway | Микросервисы | БД | Характер нагрузки |
|---------|-------------|-----|-------------------|
| `Learning API GW` | Tests API, Courses API | `certification_db`, `courses_db` | Высокое чтение |
| `Manage API GW` | Manage API | `company_db`, `courses_db` | Частые записи |
| `Analytics API GW` | Reports API, Dashboard API | `company_db` | Тяжёлые агрегации |

### Структура папок (целевая)
```
backend/
  services/
    tests-api/        # UC-01–UC-03, интеграция LLM
    courses-api/      # UC-04, UC-10
    manage-api/       # UC-07, UC-08, UC-11, UC-15
    reports-api/      # UC-13, UC-14
    dashboard-api/    # UC-13
  gateways/
    learning/
    manage/
    analytics/
frontend/
  apps/
    employee/
    hr/
    director/
infrastructure/
  docker-compose.yml
  postgres/           # init SQL для 3 БД
```

## Модель данных (рис. 4–6 ВКР)

Три независимые PostgreSQL БД — строгий Database-per-Service (NFR-11, NFR-12):
- **`company_db`** — сотрудники, результаты аттестаций, KPI, назначения
- **`courses_db`** — каталог курсов, модули, материалы, версии (NFR-18)
- **`certification_db`** — банк вопросов, логи попыток, расчётные грейды, рекомендации

Межсервисная согласованность — через события (eventual consistency), без распределённых транзакций.

## Модель компетенций
Грейды К1 (Junior) → К5 (Architect/PM) по тематическим областям: моделирование данных, ABAP, администрирование, BW/4HANA, бизнес-аналитика.

## Роли и RBAC (NFR-08)
- **Employee** — тестирование, результаты, рекомендации (UC-01–UC-06)
- **HR** — управление тестами/курсами/вопросами/отчёты (UC-07–UC-11, UC-13–UC-14)
- **Director** — дашборды, KPI, агрегированная аналитика (UC-13–UC-15)

## LLM-интеграция
Tests API вызывает LLM для генерации вопросов и персонализированных рекомендаций. При любом обращении к LLM промпт должен быть явно задокументирован в коде (комментарий или константа `PROMPT_*`).

## Приоритет реализации
1. Docker Compose + 3 БД + миграции Prisma
2. Tests API (UC-01–UC-03) + интеграция LLM
3. Learning API Gateway + Employee SPA
4. Manage API + HR SPA
5. Reports/Dashboard API + Director SPA

## Запрещено
- Общая БД для нескольких сервисов
- Монолитная архитектура
- Один API Gateway для всех доменов
- jQuery, class components React
- Прямые SQL-запросы в обход ORM (кроме сложных аналитических запросов в Reports API)

## Ссылки на требования
- Use Cases (UC-01–UC-15): `docs/requirements/functional-requirements.md`
- NFR (NFR-01–NFR-19): `docs/requirements/non-functional-requirements.md`
- Бизнес-требования (BR-01–BR-06): `docs/requirements/business-requirements.md`
- Модель компетенций: `docs/requirements/competency-model.md`
- API-таблицы 17–20: глава 2 ВКР (`docs/vkr/ВКР_полный_текст.md`)
