# ТЗ: система адаптивного чтения иврита

Документ нужен как постоянная точка опоры по проекту: здесь хранится техническое задание, архитектура, критерии приемки и чеклист выполненных работ.

Последнее обновление: 2026-07-27.

## Статус работ

Обновляй чекбоксы по мере реализации.

### База проекта

- [x] Выбран и зафиксирован стек backend: NestJS + Fastify
- [x] Настроен TypeScript
- [x] Настроены переменные окружения
- [x] Подключен Supabase / PostgreSQL
- [x] Подключен OpenAI API
- [ ] Добавлен общий логгер и обработка ошибок

### Приватность и доступ

- [x] Добавлен `ALLOWED_TELEGRAM_IDS`
- [x] Реализована middleware-проверка Telegram ID в боте
- [x] Неавторизованные пользователи получают отказ или игнорируются
- [x] Реализована валидация `x-telegram-init-data` для Mini App
- [x] После валидации initData проверяется whitelist пользователя
- [ ] В BotFather отключено добавление бота в группы

### Telegram Bot

- [x] Настроен бот на grammY
- [x] Добавлен production webhook endpoint для Telegram
- [x] Добавлен скрипт регистрации Telegram webhook
- [x] Бот принимает прямые ссылки на новости и ставит их в очередь
- [x] Бот принимает сырой текст на иврите
- [x] Бот запускает адаптацию сырого ивритского текста
- [x] Бот отправляет article id или ссылку для открытия будущего Mini App route
- [x] Добавлен backend API для чтения и изменения уровня пользователя

### Очередь и защита от нагрузки

- [x] Добавлен rate limit перед постановкой Telegram-сообщений в обработку
- [x] Подготовлена SQL-миграция `jobs` для Postgres-backed очереди
- [x] Добавлен `JobsModule` с портом очереди и Supabase adapter
- [x] Реализован worker обработки jobs
- [ ] Добавлены дневные бюджетные лимиты LLM jobs на пользователя

### Инжест источников

- [ ] Реализован парсинг обычных URL через Cheerio / RSS
- [ ] Реализован парсинг публичных Telegram-постов или принято решение отложить
- [ ] Добавлены дефолтные RSS-источники
- [ ] Настроена cron-задача для автоматического сбора новостей
- [ ] Сырой текст нормализуется перед отправкой в LLM

### Адаптация текста через LLM

- [x] Реализован Prompt этапа адаптации
- [x] OpenAI вызывается с JSON-ответом
- [x] Ответ адаптации валидируется по схеме
- [x] Реализован Validator Prompt
- [x] При `is_valid = true` статья сохраняется
- [x] При `is_valid = false` выполняется повторная генерация до 2 попыток
- [ ] Реализован fallback, если адаптация не прошла проверку
- [x] В адаптацию подмешиваются сложные слова пользователя

### Telegram Mini App

- [x] Добавлен backend auth guard для Mini App initData
- [x] Добавлен backend endpoint `GET /api/me`
- [x] Добавлен backend endpoint `PATCH /api/me/level`
- [x] Добавлен backend endpoint `GET /api/articles/:id`
- [x] Создан React / Vite frontend
- [x] Подключен Tailwind CSS
- [x] Подключен Telegram Mini App initData bootstrap
- [x] Экран чтения отображает текст справа налево
- [x] Каждое слово рендерится интерактивным элементом
- [x] Клик по слову открывает Bottom Sheet
- [x] Bottom Sheet показывает перевод, транскрипцию, лемму и альтернативы
- [ ] Кнопка завершения чтения отправляет статистику без учета времени чтения

### Словарь и прогресс

- [x] При клике слово добавляется в `user_words`
- [x] Слово получает статус `learning`
- [x] Сохраняется `last_seen_at`
- [ ] После чтения считается `DifficultyRatio`
- [ ] `current_level_score` пользователя пересчитывается по метрикам чтения
- [ ] Добавлена логика перехода слов в `mastered`

### База данных

- [x] Создана таблица `users`
- [x] Создана таблица `user_words`
- [x] Создан enum статуса слова: `learning`, `mastered`
- [x] Создана таблица `articles`
- [x] Добавлены индексы на `telegram_id` и внешние ключи
- [x] Подготовлены миграции / SQL-скрипты

### Definition of Done

- [x] Чужой Telegram ID не получает доступ к боту
- [x] Mini App не принимает невалидный `initData`
- [ ] Бот принимает ссылку на новость и запускает адаптацию
- [x] Бот принимает сырой ивритский текст и запускает адаптацию
- [x] Адаптированный текст проходит авто-проверку
- [x] Статья сохраняется в БД
- [x] Mini App показывает адаптированный текст
- [x] Клик по слову возвращает контекстный перевод и транскрипцию
- [x] Незнакомые слова сохраняются в БД
- [ ] Уровень пользователя пересчитывается после чтения

## Текущее состояние реализации

На 2026-07-27 backend реализован как NestJS + Fastify приложение с глобальным prefix `/api`.

Готово:

- `AccessModule`: whitelist по `ALLOWED_TELEGRAM_IDS` и rate limit для Telegram user messages.
- `BotModule`: grammY bot в polling/webhook режимах, webhook endpoint, source classification, постановка jobs в очередь.
- `JobsModule`: Postgres-backed queue через Supabase, RPC claim/complete/fail, worker обработки jobs.
- `SourcesModule`: классификация raw Hebrew text, URL, public Telegram channel refs; URL/Telegram extraction adapters пока являются портами без реализации.
- `UsersModule`: создание/поиск пользователя, чтение learning words, счётчик learning words, обновление `current_level_score`.
- `AdaptationModule`: OpenAI adapter, JSON response mode, prompt адаптации, validator prompt, retry до 2 повторных генераций.
- `ArticlesModule`: сохранение адаптированных статей в таблицу `articles`, защищённое чтение статьи по `id` для текущего пользователя.
- `TelegramAuthModule`: проверка Telegram Mini App `initData` через HMAC, извлечение текущего Telegram user, whitelist check.
- `MeModule`: защищённые `GET /api/me` и `PATCH /api/me/level`.
- `TranslationModule`: защищённый `POST /api/translate-word`, word analysis через OpenAI adapter, upsert `user_words`, возврат `learningWordsCount`.
- `mini-app/`: Vite / React / Tailwind frontend skeleton, Telegram initData header, client API для `GET /api/me` и `GET /api/articles/:id`, RTL экран чтения.

Ограничения текущей реализации:

- URL и Telegram channel jobs пока ставятся в очередь, но extraction не подключен.
- Bot пока отправляет plain URL или article id, а не Telegram Mini App keyboard button.
- Mini App пока не реализует finish-reading flow и word mastery logic.
- Static runtime strings в `src` должны оставаться English-only; русский язык допустим в документации и AI translation fields.

## Следующий шаг

Следующий выбранный шаг: реализовать finish-reading flow без учета времени чтения.

Цель шага:

- добавить backend endpoint завершения чтения под Mini App auth;
- считать `DifficultyRatio = translationRequestsCount / generatedWordsCount`;
- обновлять `current_level_score` без использования времени чтения;
- подготовить frontend кнопку завершения чтения и отправку статистики.

## 1. Общие сведения и архитектура

### 1.1. Назначение системы

Приложение предназначено для изучения иврита методом Comprehensible Input: понятный входящий сигнал через реальные новости и тексты.

Система берет реальные новости или произвольные тексты, адаптирует их под уровень пользователя через LLM и предоставляет удобный интерфейс чтения с отслеживанием незнакомых слов, контекстным переводом и транскрипцией.

### 1.2. Общая схема системы

- **Telegram Bot**: Node.js + grammY или telegraf. Точка входа, управление настройками и ссылками.
- **Telegram Mini App**: React / Vite / Tailwind SPA внутри Telegram. Отвечает за процесс чтения и интерактивное взаимодействие со словами.
- **Backend API**: Node.js + NestJS с Fastify adapter. Бизнес-логика, OpenAI API, валидация, работа с БД.
- **База данных**: Supabase / PostgreSQL. Хранение пользователей, словаря, истории адаптаций и whitelist.

### 1.3. Архитектурный принцип: модули, порты и заменяемые адаптеры

Backend должен строиться модульно, с явным разделением бизнес-логики и внешних провайдеров. Решения по базе данных, очереди, Telegram transport и LLM-провайдеру не должны протекать во все приложение напрямую.

Основной принцип:

```text
Use cases / services -> ports -> adapters -> external providers
```

Требования:

- бизнес-логика работает через локальные интерфейсы/порты, а не напрямую через SDK внешних сервисов;
- Supabase, будущая промышленная БД, Redis/BullMQ, OpenAI или другой LLM-провайдер подключаются как адаптеры;
- замена адаптера не должна требовать переписывания use case-логики;
- Nest-модули должны иметь четкие границы ответственности: `BotModule`, `AccessModule`, `DatabaseModule`, `JobsModule`, `AdaptationModule`, `ArticlesModule`, `UsersModule`, `TelegramAuthModule`, `MeModule`;
- SDK внешних сервисов должны быть инкапсулированы внутри инфраструктурных сервисов, например `SupabaseService`, `TelegramBotService`, `OpenAiAdapter`;
- для MVP допустимы простые реализации адаптеров, но публичные методы модулей должны проектироваться так, чтобы их можно было заменить без изменения потребителей.

Примеры заменяемых частей:

- **Database port**: сейчас Supabase/PostgreSQL, позже можно заменить на другой managed PostgreSQL или отдельный database layer;
- **Queue port**: сейчас Postgres-backed jobs table, позже можно заменить на Redis/BullMQ, SQS или другой managed queue;
- **LLM port**: сейчас OpenAI, позже можно заменить или дополнить Anthropic, Gemini или локальной моделью;
- **Telegram transport**: локально polling, в production webhook.

## 2. Безопасность и ограничение доступа

Система строго приватная: закрытый бот и закрытый backend.

### 2.1. Доступ на уровне Telegram-бота

В конфигурации backend задается массив:

```env
ALLOWED_TELEGRAM_IDS=123456789,987654321
```

При каждом запросе или сообщении middleware бота проверяет `ctx.from.id`.

Если ID отсутствует в whitelist, бот игнорирует запрос или возвращает:

```http
403 Forbidden
```

Текст отказа:

```text
Доступ ограничен
```

В BotFather нужно отключить возможность добавления бота в группы:

```text
Allow Groups? -> Turn groups off
```

### 2.2. Авторизация Telegram Mini App

При запросе из Mini App клиент передает заголовок:

```http
x-telegram-init-data: <Telegram WebApp initData>
```

Backend валидирует HMAC-подпись `initData` через `BOT_TOKEN`.

После успешной валидации backend проверяет, входит ли `user.id` из `initData` в `ALLOWED_TELEGRAM_IDS`.

Неавторизованные web-запросы отклоняются.

## 3. Функциональные требования

### 3.1. Управление источниками чтения

Бот не является универсальным чат-ботом. Его единственная задача — принять источник для чтения, проверить его, поставить задачу адаптации и вернуть пользователю адаптированный материал или ссылку / кнопку открытия Mini App.

Static UI и bot messages пишутся на английском. AI-перевод слова и транскрипция возвращаются на русском языке.

Система принимает источники из трех каналов.

#### Прямая ссылка от пользователя в чат

Пользователь отправляет боту URL на израильский сайт, например Ynet или Walla, либо ссылку на публичный Telegram-пост.

Backend извлекает текст через Cheerio / RSS / другой adapter, проверяет, что извлеченный контент написан на иврите, и только после этого ставит задачу адаптации.

#### Произвольный текст в чат

Пользователь копирует и отправляет сырой текст на иврите прямо в сообщения боту.

Backend проверяет, что текст написан на иврите. Если текст не на иврите, бот отвечает отказом на английском и не создает job.

#### Публичный Telegram-канал или Telegram-ссылка

Пользователь отправляет публичный `t.me/...` link или username канала. Backend должен получить последние 5 постов через Telegram adapter, проверить, что посты достаточно ивритские, и только после этого разрешить использовать канал как источник.

Если последние 5 постов не на иврите или канал недоступен, бот отвечает отказом на английском.

Когда пользователь выбирает Telegram-канал как источник, в Mini App или боте должна быть доступна команда / кнопка `Send news`. После нажатия система берет свежую новость из источника, адаптирует ее под текущий уровень пользователя и возвращает материал для чтения.

#### Автоматический парсинг

Cron-задача на backend собирает свежие новости из дефолтных RSS-фидов:

- Google News Israel
- Ynet RSS
- дополнительные заданные Telegram-каналы

### 3.2. Настройка уровня сложности

Пользователь настраивает уровень сложности в Mini App. Бот может давать ссылку / кнопку открытия Mini App, но управление настройками происходит в Mini App.

Mini App home/settings показывает:

- текущий уровень сложности текстов;
- количество слов в статусе `learning`;
- возможность изменить уровень сложности.

Шкала сложности:

- MMR от `100` до `1000`
- или пресеты `A1`, `A2`, `B1`, `B2`

Данные сохраняются в таблице `users` в поле `current_level_score`.

Впоследствии система динамически корректирует уровень на основе метрик чтения:

- количество кликов на перевод
- доля незнакомых слов
- количество сгенерированных слов без запросов перевода

Если пользователю было сгенерировано `1000` слов и за это время он ни разу не запросил перевод, система повышает `current_level_score`.

### 3.3. LLM pipeline адаптации и контроля качества

Чтобы не получать галлюцинации, адаптация выполняется в два этапа:

```text
Сырой текст -> Этап 1: Адаптация -> Этап 2: Валидатор -> Успех / Отказ
```

#### Этап 1: генерация

Backend передает сырой текст в OpenAI `gpt-4o` с JSON-ответом.

Инструкция для промпта:

```text
Перепиши новость под уровень MMR=${user.level_score}.
Сохрани 100% фактический смысл события.
Не выдумывай факты.
Напиши текст без огласовок (בלי ניקוד).
Подмешай слова из списка сложных слов пользователя: ${struggling_words}.
```

Ожидаемый JSON:

```json
{
  "original_summary": "string",
  "adapted_title": "string",
  "adapted_text": "string",
  "vocabulary_used": ["string"]
}
```

#### Этап 2: валидатор

Сгенерированный текст отправляется на отдельную проверку.

Validator Prompt:

```text
Сравни оригинальную новость X и адаптированную Y.
Сохранились ли главные факты: кто, что, где?
Нет ли галлюцинаций и бреда?
Является ли иврит грамматически корректным?
Ответь JSON: { "is_valid": boolean, "reason": "string" }
```

Ожидаемый JSON:

```json
{
  "is_valid": true,
  "reason": "string"
}
```

Backend logic:

- если `is_valid === true`, сохранить статью и вернуть пользователю;
- если `is_valid === false`, повторить генерацию до 2 попыток;
- если все попытки провалились, отдать fallback с сообщением: `Не удалось адаптировать с сохранением смысла`.

### 3.4. Telegram Mini App: интерфейс чтения

#### Экран чтения

- Текст рендерится с выравниванием справа налево: `dir="rtl"`.
- Каждое слово оборачивается в интерактивный `<span>`.
- Время чтения не считается: тексты отличаются по размеру, поэтому эта метрика не используется для прогресса.

#### Клик по слову

При тапе на слово Mini App показывает действие / кнопку `Show translation`. Если пользователь нажимает кнопку, frontend отправляет запрос:

```http
POST /api/translate-word
```

Тело запроса:

```json
{
  "articleId": "string",
  "word": "string",
  "sentenceContext": "string"
}
```

Backend вызывает LLM и возвращает:

```json
{
  "contextTranslationRu": "string",
  "transcriptionRu": "string",
  "lemma": "string",
  "partOfSpeech": "string",
  "baseFormReason": "string",
  "alternatives": ["string"],
  "learningWordsCount": 12
}
```

В Mini App снизу выезжает Bottom Sheet с этими данными. Перевод и транскрипция показываются на русском языке.

Backend нормализует слово до базовой формы перед сохранением:

- существительные сохраняются в базовой / словарной форме, где возможно;
- глаголы сохраняются как инфинитив / лемма, где возможно;
- местоимения, частицы и другие части речи сохраняются по решению word-analysis adapter;
- не нужно сохранять каждый вариант склонения или спряжения как отдельное изучаемое слово.

Нормализованное слово добавляется в `user_words` конкретного пользователя со статусом `learning`.

#### Подмешивание изучаемых слов

При адаптации новых текстов backend подмешивает слова пользователя из `user_words.status = learning`, если они подходят по смыслу и не ломают факты текста.

Для каждого подмешанного слова:

- если пользователь не запросил перевод, увеличивается `successful_exposures`;
- если пользователь запросил перевод, `successful_exposures` не увеличивается;
- после `10` успешных exposures слово считается изученным и получает статус `mastered`.

#### Завершение чтения

По кнопке `Завершить` считается:

```text
DifficultyRatio = clicks_on_translation / total_words
```

После этого backend обновляет `current_level_score` пользователя.

## 4. Схема базы данных

### `users`

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `telegram_id` | `bigint` | Unique, indexed |
| `current_level_score` | `int` | Default `300` |
| `generated_words_without_translation` | `int` | Счетчик слов для авто-повышения уровня |
| `last_level_up_at` | `timestamp` | Последнее автоматическое повышение уровня |
| `created_at` | `timestamp` | Дата создания |
| `updated_at` | `timestamp` | Дата обновления |

### `user_words`

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK -> `users.id` |
| `lemma` | `string` | Начальная форма слова |
| `original_word` | `string` | Исходная форма, по которой пользователь запросил перевод |
| `part_of_speech` | `string` | Часть речи, если определена |
| `status` | `enum` | `learning` или `mastered` |
| `successful_exposures` | `int` | Сколько раз слово было подмешано без запроса перевода |
| `translation_requests` | `int` | Сколько раз пользователь запросил перевод |
| `last_seen_at` | `timestamp` | Когда слово встречалось последний раз |
| `created_at` | `timestamp` | Дата создания |
| `updated_at` | `timestamp` | Дата обновления |

Уникальность: `unique(user_id, lemma)`.

### `reading_stats`

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK -> `users.id` |
| `article_id` | `uuid` | FK -> `articles.id`, nullable |
| `generated_words_count` | `int` | Сколько слов было сгенерировано для чтения |
| `translation_requests_count` | `int` | Сколько переводов запросил пользователь |
| `created_at` | `timestamp` | Дата создания |

### `articles`

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `source_url` | `string` | Nullable |
| `original_text` | `text` | Исходный текст |
| `adapted_text` | `text` | Адаптированный текст |
| `difficulty_score` | `int` | Уровень сложности |
| `is_validated` | `boolean` | Прошла ли статья validator |

## 5. Технологический стек

- **Backend**: NestJS, TypeScript, Fastify adapter
- **Telegram Bot**: grammY или telegraf
- **Mini App Frontend**: React, Vite, Tailwind CSS, `@telegram-apps/sdk`
- **Database & Auth**: Supabase / PostgreSQL
- **AI Provider**: OpenAI API, `gpt-4o`, `gpt-4o-mini`
- **Parser**: `rss-parser`, `cheerio`, `gramjs`

## 6. API draft

Черновой набор endpoint'ов для backend.

Mini App endpoints должны принимать заголовок:

```http
x-telegram-init-data: <Telegram WebApp initData>
```

### `POST /api/articles/adapt`

Запускает адаптацию текста или статьи.

```json
{
  "source_url": "string | null",
  "raw_text": "string"
}
```

### `GET /api/articles/:id`

Возвращает адаптированную статью для чтения.

Response:

```json
{
  "id": "string",
  "title": "string",
  "adaptedText": "string",
  "difficultyScore": 300
}
```

### `POST /api/translate-word`

Возвращает контекстный перевод слова.

```json
{
  "word": "string",
  "sentenceContext": "string",
  "articleId": "string"
}
```

### `POST /api/reading-sessions/finish`

Завершает чтение и обновляет уровень пользователя.

```json
{
  "articleId": "string",
  "generatedWordsCount": 100,
  "translationRequestsCount": 12
}
```

### `GET /api/me`

Возвращает профиль текущего пользователя.

Response:

```json
{
  "telegramId": 123456789,
  "currentLevelScore": 300,
  "learningWordsCount": 0
}
```

### `PATCH /api/me/level`

Обновляет базовый уровень пользователя.

```json
{
  "currentLevelScore": 300
}
```

## 7. Definition of Done

Проект считается рабочим MVP, когда:

- чужой Telegram ID при попытке отправить команду боту получает отказ или игнорируется;
- bot успешно принимает ссылку на новость;
- bot успешно принимает сырой текст на иврите;
- backend адаптирует текст через OpenAI;
- адаптация проходит автоматическую проверку validator;
- статья сохраняется в PostgreSQL;
- Mini App открывает адаптированный текст;
- текст отображается справа налево;
- клик по слову вызывает контекстный перевод и транскрипцию;
- незнакомые слова фиксируются в БД;
- после завершения чтения пересчитывается уровень пользователя.

## 8. Возможный порядок реализации MVP

1. Создать backend API, конфиг и подключение к Supabase.
2. Реализовать whitelist Telegram ID.
3. Создать таблицы `users`, `articles`, `user_words`.
4. Поднять Telegram bot и команду `/start`.
5. Добавить прием сырого текста в боте.
6. Реализовать OpenAI adaptation pipeline.
7. Добавить validator pipeline.
8. Сохранять адаптированные статьи в БД.
9. Создать Vite React Mini App.
10. Реализовать экран чтения RTL.
11. Добавить endpoint перевода слова.
12. Добавить Bottom Sheet перевода.
13. Сохранять слова пользователя.
14. Добавить завершение чтения и пересчет MMR.
15. Добавить прием URL и парсинг новостей.
16. Добавить cron-инжест дефолтных источников.

