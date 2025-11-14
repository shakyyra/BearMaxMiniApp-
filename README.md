# BearMax Mini App Platform

- **API** – FastAPI-сервис c PostgreSQL/Redis, репозиториями и сервисами для справочников, форм и каталога фондов.
- **Bot** – Go-бот на основе официального клиента MAX (`max-bot-api-client-go`), который приветствует пользователя и отправляет ссылку на мини‑приложение.
- **Web** – готовое React/Vite мини-приложение с онбордингом, баннерами, каталогом фондов и формами подачи заявок на мастер-класс и наставничество.

## Структура репозитория

```
apps/
  api/        # FastAPI сервис + FastAPI-Admin
  bot/        # Go-бот MAX
  web/        # React/Vite мини-приложение
deploy/       # Caddy и инфраструктурные шаблоны
docker-compose.yml
Makefile
pyproject.toml / requirements.txt
```

## Подготовка окружения

1. Скопируйте переменные окружения и заполните секреты:
   ```bash
   cp .env.example .env
   ```
   Обязательно заполните `MAX_BOT_TOKEN` (токен MAX-бота).
   При необходимости скорректируйте `DATABASE_URL` и `REDIS_URL`.
   Чтобы автоматически создать учётную запись администратора, задайте `ADMIN_DEFAULT_USERNAME` и `ADMIN_DEFAULT_PASSWORD` (иначе их можно ввести вручную на `/admin/init`).

2. Убедитесь, что установлены Python 3.11+, Go 1.24+, Node.js 18+ (лучше 20) и Docker/Docker Compose v2.

## Локальный запуск (Docker + CLI)

### 1. Docker Compose (весь стек)

```bash
# из корня репозитория
docker compose pull              # (опционально) подтянуть базовые образы
docker compose build             # пересобрать api/bot/web
docker compose up -d             # поднять api, bot, web, postgres, redis
docker compose ps                # убедиться, что все сервисы в состоянии running
```

После запуска:
- API доступен на `http://localhost:${API_PORT:-8000}` (Swagger на `/docs`).
- Веб-мини-приложение доступно на `http://localhost:${WEB_PORT:-3000}`.
- Бот использует токен из `.env` и подключается к MAX автоматически.

Для остановки стека выполните `docker compose down --remove-orphans`.

### 2. Makefile-обёртки

Те же команды доступны через `make`, что удобно для CLI-сценариев:

```bash
make up-build      # пересобрать и запустить весь стек (эквивалент docker compose up --build -d)
make logs SERVICE=api   # посмотреть логи конкретного сервиса
make down          # остановить и очистить ресурсы
```

### 3. Ручная сборка/запуск контейнера

Если нужно проверить только API без Compose, соберите и запустите образ напрямую:

```bash
docker build -t backmax-api -f apps/api/Dockerfile .
docker run --rm --env-file .env -p 8000:8000 backmax-api
```

Пример тестового вызова из командной строки (после старта контейнера):

```bash
curl http://localhost:8000/api/v1/common/cities
```

Команда должна вернуть JSON-список городов из базы. Аналогичным образом можно собрать и запустить `apps/bot/Dockerfile` или `apps/web/Dockerfile`, указав нужный `dockerfile`.

## API: локальный запуск

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd apps/api
export PYTHONPATH=$(pwd)
uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 --reload
```

## Go-бот

Бот реагирует на `/start` и отправляет фразу «Привет, запускай скорее мини приложение ниже». Запуск мини-приложения происходит через системный интерфейс MAX.

### Переменные

| Переменная | Назначение |
| --- | --- |
| `MAX_BOT_TOKEN` | **Обязательно.** Токен бота из кабинета MAX. |
| `MAX_BOT_GREETING` | Текст приветствия (по умолчанию русская фраза). |

### Запуск

```bash
cd apps/bot
export MAX_BOT_TOKEN=xxxxx
go run ./cmd/maxbot
```

## Docker / Docker Compose

Всё решение поднимается одной командой:

```bash
docker compose up --build
```

Сервисы:
- `api` – FastAPI (порт `${API_PORT}`) с подключением к PostgreSQL и Swagger (`/docs`).
- `bot` – Go-бот, использует те же переменные `MAX_*`.
- `web` – Vite dev-сервер фронтенда (порт `${WEB_PORT}`) с доступом к тем же `VITE_*`.
- `postgres` – штатная база данных.
- `redis` – кэш/хранилище сессий для FastAPI-Admin.

## Веб-мини-приложение

Каталог `apps/web` содержит production-ready клиент на React 18 + Vite 6: онбординг, баннеры, вкладки «Фонды / Мастер-классы / Наставничество», пошаговые формы и модальные окна. Приложение вызывает API `GET /common/*`, `GET /funds*`, `POST /masterclass/*` и `POST /mentorship/*`.

```bash
cd apps/web
npm install
npm run dev -- --host 0.0.0.0 --port ${WEB_PORT:-3000}
```

Продакшен-сборка:

```bash
cd apps/web
npm run build
npm run preview -- --host 0.0.0.0 --port 4173   # быстрый smoke-тест статики
```

## Архитектура API

- `app/core/config.py` загружает `.env` и предоставляет настройки (`APP_*`, `DATABASE_URL`).
- `app/db/session.py` создаёт асинхронный `AsyncSession` SQLAlchemy поверх PostgreSQL.
- `app/repositories/base.py` задаёт базовый репозиторий с методами `add/commit/rollback`.
- `app/models/` хранит Pydantic-схемы для доменов (common, masterclass, mentorship, funds).
- `app/api/routes/` содержит HTTP-слой.
- `app/main.py` регистрирует все маршруты под префиксом `/api` и включает Swagger.

Рабочие эндпоинты (все доступны под префиксом `/api/v1`):

- `GET /common/cities` — города из таблицы `cities`.
- `GET /common/education` — уровни образования из `education_levels`.
- `POST /masterclass/request` — создать заявку на мастер-класс (хранится в `masterclass_requests`).
- `GET /masterclass/requests/{account_id}` — получить заявки пользователя.
- `DELETE /masterclass/request/{request_id}` — удалить заявку.
- `POST /mentorship/request` — создать заявку наставника.
- `GET /mentorship/requests/{account_id}` — список заявок по аккаунту.
- `DELETE /mentorship/request/{request_id}` — удалить заявку.
- `GET /funds` и `GET /funds/{slug}/donate-url` — получают перечень фондов и ссылки на пожертвования из таблицы `funds`.

## Админ-панель

- По адресу `http://localhost:${API_PORT:-8000}/admin/init` можно создать первого администратора (логин/пароль задаёте сами). После инициализации переходите на `/admin` для входа.
- Если заданы `ADMIN_DEFAULT_USERNAME`/`ADMIN_DEFAULT_PASSWORD`, учётная запись создаётся автоматически при старте API, а маршрут `/admin/init` можно пропустить.
- Админ-панель построена на FastAPI-Admin и позволяет управлять городами, уровнями образования и заявками на мастер-классы/наставничество через UI.
- Формы заявок теперь используют выпадающие списки для городов и уровней образования, поэтому нет необходимости вводить числовые идентификаторы вручную.
- Для авторизации и хранения сессий используется Redis (`REDIS_URL`), поэтому сервис `redis` в `docker-compose.yml` должен быть запущен.
