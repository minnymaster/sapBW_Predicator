# Цифровой сервис оценки компетенций SAP BW

ВКР бакалавра · 09.03.04 Программная инженерия · НИУ ВШЭ — Пермь · 2026  
Болотов Даниил, РИС-22-1

---

## Архитектура

```
               ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
               │  Employee    │    │      HR      │    │   Director   │
               │    SPA       │    │     SPA      │    │     SPA      │
               │ React + Vite │    │ React + Vite │    │ React + Vite │
               └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
                      │                   │                   │
               :8080/:8443         :8180/:8543         :8280/:8643
                      │                   │                   │
                      ▼                   ▼                   ▼
            ┌──────────────────┐ ┌────────────────┐ ┌────────────────────┐
            │  Learning API GW │ │  Manage API GW │ │  Analytics API GW  │
            │  Traefik v3.1    │ │  Traefik v3.1  │ │  Traefik v3.1      │
            │  JWT forwardAuth │ │  JWT forwardAuth│ │  + Nginx cache     │
            └────────┬─────────┘ │  Audit NFR-09  │ │  dashboard 5 min   │
                     │           └───────┬────────┘ │  reports  30 min   │
                     │                   │           └─────────┬──────────┘
              ┌──────┴──────┐            │                ┌────┴────┐
              ▼             ▼            ▼                ▼         ▼
        ┌──────────┐  ┌──────────┐ ┌──────────┐   ┌──────────┐ ┌──────────┐
        │ Tests    │  │ Courses  │ │ Manage   │   │ Reports  │ │Dashboard │
        │ API      │  │ API      │ │ API      │   │ API      │ │ API      │
        │ :3001    │  │ :3003    │ │ :3002    │   │ :3004    │ │ :3005    │
        │ UC-01–05 │  │UC-04, 10 │ │ UC-07–15 │   │UC-13, 14 │ │  UC-13   │
        └────┬─────┘  └────┬─────┘ └────┬─────┘   └────┬─────┘ └────┬─────┘
             │             │            │               └──────┬──────┘
             ▼             ▼            ▼                      ▼
        ┌─────────┐  ┌──────────┐ ┌──────────┐          ┌──────────┐
        │certif_db│  │courses_db│ │company_db│◄─────────│company_db│
        │  :5434  │  │  :5433   │ │  :5432   │          │  :5432   │
        └────┬────┘  └──────────┘ └────┬─────┘          └──────────┘
             │                         │
             └────────────┬────────────┘
                          ▼
                    ┌──────────┐      ┌──────────────────────────┐
                    │  Redis   │      │     Groq API (external)  │
                    │  :6379   │      │  llama-3.1-70b-versatile │
                    └──────────┘      └──────────────────────────┘
              Bull queue · pub/sub · dashboard cache
```

**Три домена, три шлюза** (Database-per-Service, NFR-11, NFR-12):

| Домен | Gateway (порты хоста) | Микросервисы | БД |
|---|---|---|---|
| Learning | `:8080` (HTTP→HTTPS), `:8443` (HTTPS) | Tests API, Courses API | `certification_db`, `courses_db` |
| Manage | `:8180` / `:8543` | Manage API | `company_db`, `courses_db`, `certification_db` |
| Analytics | `:8280` / `:8643` | Reports API, Dashboard API | `company_db` |

---

## Сервисы

### Tests API · `localhost:3001`

Ядро системы аттестации. Реализует полный цикл тестирования — от создания попытки до расчёта грейда К1–К5 и генерации персонализированных рекомендаций.

- **UC-01** — старт теста, навигация по вопросам
- **UC-02** — сохранение ответов; автопроверка закрытых вопросов, асинхронная LLM-оценка открытых через Bull-очередь
- **UC-03** — завершение теста: агрегация баллов по компетенциям, расчёт грейда, запись `CompetencyGap` в единой транзакции (NFR-17)
- **UC-04** — рекомендации по пробелам компетенций через LLM
- **UC-05** — режим самооценки
- Версионирование вопросов: `rootId` + `versionNumber` (NFR-18)
- LLM: `Llama-3.1-70b-versatile` через Groq SDK, 3 retry + exponential backoff

### Courses API · `localhost:3003`

Библиотека учебных материалов. Каталог курсов с модулями и файловыми материалами.

- **UC-04** — просмотр рекомендованных курсов
- **UC-10** — управление каталогом курсов, загрузка файлов до 200 МБ (HR)
- Версионирование материалов с SHA-256 чексуммой (NFR-18)

### Manage API · `localhost:3002`

Административный бэкенд для HR. Управляет контентом и организационной структурой.

- **UC-07** — CRUD банка вопросов с версионированием
- **UC-08** — создание и назначение тестов сотрудникам/отделам
- **UC-09** — мониторинг прохождения (статусы назначений)
- **UC-11** — целевые профили компетенций
- **UC-13** — список сотрудников и отделов для HR-отчётов
- **UC-15** — установка KPI (совместно с Director)
- Публикует события назначений в Redis (pub/sub)
- Аутентификация: `POST /v1/auth/login` → JWT RS256

### Reports API · `localhost:3004`

Аналитический сервис для тяжёлых агрегаций по `company_db`.

- **UC-13** — распределение грейдов, KPI-прогресс, тепловые карты
- **UC-14** — экспорт в Excel (XLSX)
- Прямые `$queryRaw` для сложных аналитических запросов

### Dashboard API · `localhost:3005`

Агрегированные данные для дашборда директора с двухуровневым кэшем через Redis (5 минут) и Nginx-прокси (настраивается).

- **UC-13** — сводная аналитика, асинхронные задачи агрегации

---

## Быстрый старт (5 команд)

> **Предварительные требования:** Docker 24+, Docker Compose v2, OpenSSL

```bash
# 1. Клонировать репозиторий
git clone https://github.com/your-org/sapbw-predictor.git && cd sapbw-predictor

# 2. Создать файл переменных окружения
cp infrastructure/.env.example infrastructure/.env
# Обязательно заполнить: JWT_PUBLIC_KEY и LLM_API_KEY (см. раздел «Переменные» ниже)

# 3. Собрать образы и запустить все контейнеры
docker compose -f infrastructure/docker-compose.yml up -d --build

# 4. Применить миграции Prisma (подождать ~60 с, пока БД станут healthy)
docker compose -f infrastructure/docker-compose.yml exec tests-api  npx prisma migrate deploy
docker compose -f infrastructure/docker-compose.yml exec manage-api npx prisma migrate deploy
docker compose -f infrastructure/docker-compose.yml exec courses-api npx prisma migrate deploy

# 5. Проверить состояние — все должны быть healthy
docker compose -f infrastructure/docker-compose.yml ps
```

### Генерация JWT-ключей (RS256)

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# Значение для JWT_PUBLIC_KEY — содержимое public.pem с заменой переносов строк на \n
```

### Минимальный `infrastructure/.env`

```dotenv
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----\n"
LLM_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx   # Groq API key
LLM_MODEL=llama-3.1-70b-versatile          # опционально
```

---

## API эндпоинты

### Learning API Gateway · Tests API

**Swagger UI:** http://localhost:3001/api/docs

| Метод | Путь | Описание | Роли |
|---|---|---|---|
| `POST` | `/v1/attempts` | UC-01: Начать тест | employee |
| `GET` | `/v1/attempts` | Мои попытки | employee |
| `GET` | `/v1/attempts/:id` | Детали попытки | employee |
| `GET` | `/v1/attempts/:id/next-question` | Следующий вопрос | employee |
| `POST` | `/v1/attempts/:id/answer` | UC-02: Сохранить ответ | employee |
| `POST` | `/v1/attempts/:id/finish` | UC-03: Завершить тест, расчёт грейда К1–К5 | employee |
| `GET` | `/v1/attempts/:id/recommendations` | UC-04: Рекомендации по результатам | employee |
| `GET` | `/v1/tests` | Список тестов | employee, hr |
| `GET` | `/v1/tests/:id` | Тест по ID | employee, hr |
| `POST` | `/v1/tests` | Создать тест | hr |
| `POST` | `/v1/tests/:id/questions` | Добавить вопрос в тест | hr |
| `DELETE` | `/v1/tests/:id/questions/:qId` | Убрать вопрос из теста | hr |
| `PATCH` | `/v1/tests/:id/activate` | Активировать тест | hr |
| `GET` | `/v1/competencies` | Список компетенций | all |
| `GET` | `/v1/competencies/:id` | Компетенция по ID | all |
| `POST` | `/v1/competencies/:id/generate-questions` | UC-08: Генерация вопросов LLM | hr |
| `GET` | `/v1/questions` | Список вопросов | hr |
| `GET` | `/v1/questions/:id` | Вопрос по ID | hr |
| `POST` | `/v1/questions` | Создать вопрос | hr |
| `POST` | `/v1/questions/generate` | Генерация вопроса через LLM | hr |
| `POST` | `/v1/questions/:id/versions` | Новая версия вопроса (NFR-18) | hr |
| `GET` | `/v1/recommendations/me` | Мои рекомендации | employee |
| `PATCH` | `/v1/recommendations/:id/status` | Обновить статус рекомендации | employee |
| `GET` | `/v1/auth/validate` | Проверка JWT (Traefik forwardAuth) | — |
| `GET` | `/v1/dashboard/summary` | Сводка компетенций сотрудника | employee |

### Learning API Gateway · Courses API

**Swagger UI:** http://localhost:3003/api/docs

| Метод | Путь | Описание | Роли |
|---|---|---|---|
| `GET` | `/v1/courses` | Список курсов (пагинация, фильтр status) | all |
| `GET` | `/v1/courses/:id` | Курс с модулями и материалами | all |
| `POST` | `/v1/courses` | Создать курс | hr |
| `PUT` | `/v1/courses/:id` | Обновить курс | hr |
| `DELETE` | `/v1/courses/:id` | Архивировать курс | hr |
| `GET` | `/v1/materials/:id` | Материал с текущей версией (NFR-18) | all |
| `POST` | `/v1/materials` | Создать материал + версия v1 с SHA-256 | hr |
| `PUT` | `/v1/materials/:id` | Новая версия материала (транзакция) | hr |
| `DELETE` | `/v1/materials/:id` | Мягкое удаление материала | hr |
| `POST` | `/v1/upload` | Загрузить файл материала (max 200 МБ) | hr |

### Manage API Gateway · Manage API

**Swagger UI:** http://localhost:3002/api/docs

| Метод | Путь | Описание | Роли |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Аутентификация → JWT RS256 | — |
| `GET` | `/v1/auth/validate` | Проверка JWT (Traefik forwardAuth) | — |
| `GET` | `/v1/questions` | Список вопросов (фильтры, пагинация) | hr |
| `POST` | `/v1/questions` | Создать вопрос (version=1) | hr |
| `PUT` | `/v1/questions/:id` | Новая версия вопроса (NFR-18) | hr |
| `DELETE` | `/v1/questions/:id` | Мягкое удаление | hr |
| `GET` | `/v1/tests` | Список тестов | hr |
| `GET` | `/v1/tests/:id` | Тест по ID | hr |
| `POST` | `/v1/tests` | Создать тест | hr |
| `PUT` | `/v1/tests/:id` | Обновить тест | hr |
| `DELETE` | `/v1/tests/:id` | Мягкое удаление | hr |
| `POST` | `/v1/assignments` | Назначить тест сотруднику / отделу | hr |
| `DELETE` | `/v1/assignments/:id` | Отменить назначение | hr |
| `GET` | `/v1/employees` | Список сотрудников (поиск, фильтр) | hr, director |
| `GET` | `/v1/departments` | Список подразделений | hr, director |
| `GET` | `/v1/kpi` | Целевые KPI | hr, director |
| `POST` | `/v1/kpi` | Создать KPI | hr, director |
| `PUT` | `/v1/kpi/:id` | Обновить KPI | hr, director |
| `DELETE` | `/v1/kpi/:id` | Удалить KPI | hr, director |

### Analytics API Gateway · Reports API

**Swagger UI:** http://localhost:3004/api/docs

| Метод | Путь | Описание | Роли |
|---|---|---|---|
| `GET` | `/v1/auth/validate` | Проверка JWT (Traefik forwardAuth) | — |
| `GET` | `/v1/competency-coverage` | Распределение грейдов по компетенциям | hr, director |
| `GET` | `/v1/kpi-progress` | Прогресс KPI подразделения | hr, director |
| `GET` | `/v1/assignment-stats` | % просроченных назначений | hr, director |
| `GET` | `/v1/department-heatmap` | Тепловая карта: отдел × компетенция | hr, director |
| `GET` | `/v1/grade-trend` | Динамика грейдов по месяцам | hr, director |
| `GET` | `/v1/alerts` | Критические события: просрочки, K1, KPI | hr, director |
| `GET` | `/v1/export` | UC-14: Экспорт отчётов в Excel (XLSX) | hr, director |

### Analytics API Gateway · Dashboard API

**Swagger UI:** http://localhost:3005/api/docs

| Метод | Путь | Описание | Роли |
|---|---|---|---|
| `GET` | `/v1/summary` | UC-13: Сводная аналитика (Redis cache 5 мин) | hr, director |
| `POST` | `/v1/tasks` | Создать задачу агрегации (async) | hr, director |
| `GET` | `/v1/tasks/:id` | Статус и результат задачи | hr, director |

---

## Роли и права доступа (RBAC, NFR-08)

### Employee — Сотрудник

Доступ через **Learning API Gateway** (`:8080/:8443`).

| Что может делать | Use Case |
|---|---|
| Проходить назначенные тесты | UC-01 |
| Отвечать на вопросы (авто-проверка + LLM) | UC-02 |
| Завершать тест, видеть грейд К1–К5 и пробелы | UC-03 |
| Просматривать персонализированные рекомендации | UC-04 |
| Запускать самооценку без назначения | UC-05 |
| Просматривать свои предыдущие попытки | UC-02 |
| Обновлять статус рекомендаций (in\_progress / completed) | UC-04 |

### HR — HR-специалист

Полный доступ через **Learning API Gateway** и **Manage API Gateway** (`:8180/:8543`).

| Что может делать | Use Case |
|---|---|
| Создавать и версионировать вопросы (банк вопросов) | UC-07 |
| Генерировать вопросы через LLM по компетенции и грейду | UC-08 |
| Создавать тесты и добавлять вопросы | UC-08 |
| Назначать тесты сотрудникам или целым отделам | UC-08 |
| Отслеживать статусы назначений | UC-09 |
| Управлять каталогом курсов и материалов | UC-10 |
| Загружать учебные материалы (до 200 МБ) | UC-10 |
| Настраивать целевые профили компетенций | UC-11 |
| Просматривать аналитику и отчёты | UC-13 |
| Экспортировать отчёты в Excel | UC-14 |
| Управлять KPI | UC-15 |

### Director — Директор

Доступ через **Analytics API Gateway** (`:8280/:8643`) и частично через Manage.

| Что может делать | Use Case |
|---|---|
| Просматривать агрегированные дашборды (кэш 5 мин) | UC-13 |
| Видеть тепловые карты грейдов по отделам | UC-13 |
| Получать алерты о критических событиях | UC-13 |
| Запрашивать детализированные отчёты | UC-14 |
| Экспортировать отчёты в Excel | UC-14 |
| Устанавливать и обновлять KPI | UC-15 |
| Просматривать список сотрудников и подразделений | — |

---

## Модель компетенций SAP BW

Грейды рассчитываются по процентному порогу ответов в каждой тематической области:

| Грейд | Уровень | Порог | Описание |
|---|---|---|---|
| **К1** | Junior | 0–20 % | Базовые понятия и терминология SAP BW |
| **К2** | Middle | 21–40 % | Стандартные задачи под руководством |
| **К3** | Senior | 41–60 % | Самостоятельное решение типовых задач |
| **К4** | Expert | 61–80 % | Сложные сценарии и оптимизация |
| **К5** | Architect/PM | 81–100 % | Архитектурные решения, экспертный уровень |

**Тематические области:** моделирование данных · ABAP · администрирование · BW/4HANA · бизнес-аналитика

При завершении теста `CompetencyGap` создаётся для каждой области, где `actualGrade < minGrade` компетенции — это служит основой для LLM-рекомендаций.

---

## Технологический стек

| Слой | Технология |
|---|---|
| Backend | Node.js 20 + TypeScript, NestJS 10 |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query |
| БД | PostgreSQL 16 (3 независимые: `company_db`, `courses_db`, `certification_db`) |
| ORM | Prisma 5 |
| API Gateway | Traefik v3.1 (Learning, Manage) · Nginx 1.27 (Analytics cache) |
| Очереди | Bull (Redis-backed) для асинхронных LLM-задач |
| LLM | Llama-3.1-70b-versatile через Groq API |
| Auth | JWT RS256; Traefik `forwardAuth` на каждом шлюзе |
| Инфраструктура | Docker + Docker Compose (все сервисы с `restart: always` и healthcheck) |
| Тесты | Jest + ts-jest; `@nestjs/testing` + Supertest |

---

## Структура репозитория

```
sapBW_Predictor/
├── architecture/          # C4-диаграммы (PNG) + описание
├── backend/
│   ├── gateways/
│   │   ├── learning/      # Traefik config для Learning GW
│   │   ├── manage/        # Traefik config для Manage GW + audit log
│   │   └── analytics/     # Traefik config + Nginx cache config
│   └── services/
│       ├── tests-api/     # UC-01–05, LLM, Bull queue
│       ├── courses-api/   # UC-04, UC-10, файловые материалы
│       ├── manage-api/    # UC-07–11, UC-13–15, аутентификация
│       ├── reports-api/   # UC-13–14, аналитика, экспорт
│       └── dashboard-api/ # UC-13, Redis-кэш, async tasks
├── docs/
│   ├── requirements/      # UC, NFR, BR, модель компетенций
│   └── vkr/               # Полный текст ВКР (.md и .docx)
├── frontend/
│   └── apps/
│       ├── employee/      # SPA сотрудника
│       ├── hr/            # SPA HR-специалиста
│       └── director/      # SPA директора
└── infrastructure/
    ├── docker-compose.yml # Prod-конфигурация (restart:always, healthcheck)
    └── postgres/          # Init SQL для 3 баз данных
```

---

## Полезные команды

```bash
# Логи конкретного сервиса
docker compose -f infrastructure/docker-compose.yml logs -f tests-api

# Перезапустить один сервис после пересборки
docker compose -f infrastructure/docker-compose.yml up -d --build tests-api

# Подключиться к certification_db
docker exec -it sapbw_certification_db psql -U certification_user -d certification_db

# Запустить unit-тесты (Tests API)
cd backend/services/tests-api && npm test

# Запустить интеграционные тесты (Tests API, требует БД)
cd backend/services/tests-api && npm run test:e2e
```

---

## Требования

- [Функциональные (UC-01–UC-15)](docs/requirements/functional-requirements.md)
- [Нефункциональные (NFR-01–NFR-19)](docs/requirements/non-functional-requirements.md)
- [Бизнес-требования (BR-01–BR-06)](docs/requirements/business-requirements.md)
- [Модель компетенций](docs/requirements/competency-model.md)
- [Полный текст ВКР](docs/vkr/ВКР_полный_текст.md)
