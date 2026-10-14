# Environment variables

Each part reads its own `.env`, created from the template next to it (`cp .env.example .env`).
This index lists every template's variable names so the whole product's configuration is
visible in one place. Values are deliberately not reproduced here.

## `core/.env.example`

| Variable | Note from the template |
|---|---|
| `LLM_PROVIDER` | --- LLM provider ---------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | python-dotenv reads "KEY=   # text" as the value "# text". |
| `ANTHROPIC_MODEL` |  |
| `OPENROUTER_API_KEY` | Only needed if LLM_PROVIDER=openrouter |
| `OPENROUTER_MODEL` |  |
| `AWS_REGION` | --- AWS / Bedrock (production) ------------------------------------------- |
| `BEDROCK_MODEL_ID` |  |
| `BEDROCK_HAIKU_MODEL_ID` |  |
| `BEDROCK_GUARDRAIL_ID` | Per-tenant; provisioned during onboarding (ops/multi-tenant/ONBOARDING.md) |
| `BEDROCK_GUARDRAIL_VERSION` |  |
| `BEDROCK_KB_ID` | Optional — leave empty if using Q Business |
| `GENAI_GATEWAY_ENABLED` | --- GenAI Gateway (in-process governance) -------------------------------- |
| `DATABASE_URL` | --- Database -------------------------------------------------------------- |
| `CARDIOTWIN_GLOBAL_LIVE_SOURCES` | Explicit opt-in to public discovery adapters (no paid access or clinical import implied). |
| `CARDIOTWIN_GLOBAL_CURATOR_ORGS` | Requires reviewer/admin role too. Review rationale is public; never include patient data. |
| `REDIS_URL` | Empty = in-process pub/sub (single-replica dev). Set on prod with > 1 API replica. |
| `TRIZETTO_GATEWAY_URL` | Set both on prod to flip to live Gateway calls. |
| `TRIZETTO_GATEWAY_TOKEN` |  |
| `USE_AMAZON_Q` | Empty = Bedrock KB / curated corpus. Set USE_AMAZON_Q=true + the IDs to flip. |
| `AMAZON_Q_APPLICATION_ID` |  |
| `AMAZON_Q_INDEX_ID` |  |
| `AMAZON_Q_REGION` |  |
| `EMBEDDING_MODEL` | --- Embeddings (pgvector dev path; production uses Bedrock Titan) ------- |
| `LOG_LEVEL` | --- App ------------------------------------------------------------------- |
| `CORS_ORIGINS` |  |
| `ENVIRONMENT` | local + demo; flipped to "production" in real deploys. |
| `JWT_SECRET` | prod (the model_validator in app/core__backend_app__config.py rejects boot otherwise). |
| `JWT_ALGORITHM` |  |
| `PASSPORT_SIGNING_KEY` | demo-system signature, not a laboratory/clinician/government/third-party attestation. |
| `JWT_EXPIRE_MINUTES` |  |
| `DEMO_USER_PASSWORD` | boot. MUST be overridden in staging/production (validator enforces it). |
| `USE_BEDROCK_KB` | --- Flags ---------------------------------------------------------------- |
| `SEED_ON_BOOT` |  |
| `PLATFORM_ADMIN_USER_IDS` | need the caller's user id (server-generated, not an e-mail) here. Empty = nobody (dev also accepts user_demoad |
| `ENVIRONMENT` | Set explicitly in every deployment: dev / staging / production (guards only engage outside dev). |
| `HITL_CONFIDENCE_THRESHOLD` | 0.0 in dev/demo so every case runs the full DAG. 0.75 in prod (CA SB 1120 conservative). |
| `ONCOTWIN_LLM_EXPLANATIONS` | freshness, uncertainty, safety language, model integrity); otherwise the deterministic text is used. |
| `AUTH_DBLESS_DEMO_ENABLED` | Safe defaults: DB outages fail closed. Enable only for a local DB-less demo. |
| `TRACK7_POSTGRES_PASSWORD` | Set both values to fresh random strings before `docker compose -f docker-compose.track7.yml up`. |
| `INTEROP_RECEIVER_TOKEN` |  |
| `VITE_SMART_FHIR_BASE` | Optional SMART App Launch public client (no client secret in the browser). |
| `VITE_SMART_CLIENT_ID` |  |
| `VITE_SMART_REDIRECT_URI` |  |
| `VAPID_PUBLIC_KEY` | WEB_PUSH_ENCRYPTION_KEY; keep private/encryption keys server-side only. |
| `VAPID_PRIVATE_KEY` |  |
| `VAPID_SUBJECT` |  |
| `WEB_PUSH_ENCRYPTION_KEY` |  |
| `CLOUD_DOCUMENT_PROCESSING_ENABLED` | Keep false unless provider handling is approved; local OCR/review remains available. |

## `modules/aortavision-3d/backend/.env.example`

| Variable | Note from the template |
|---|---|
| `API_HOST` |  |
| `API_PORT` |  |
| `FRONTEND_ORIGIN` |  |

## `modules/aortavision-3d/frontend/.env.example`

| Variable | Note from the template |
|---|---|
| `VITE_API_URL` |  |

## `modules/axxess/.env.example`

| Variable | Note from the template |
|---|---|
| `EXPO_PUBLIC_GEMINI_API_KEY` | Google Gemini API key — get one at https://aistudio.google.com/apikey |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Project Settings → Your apps → Web app → Config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` |  |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |  |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` |  |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |  |
| `EXPO_PUBLIC_FIREBASE_APP_ID` |  |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` |  |

## `modules/cad-detection-3d-heart/.env.example`

| Variable | Note from the template |
|---|---|
| `ENVIRONMENT` | --- Backend Configuration --- |
| `API_HOST` |  |
| `API_PORT` |  |
| `DEBUG` |  |
| `CORS_ORIGINS` | Security & CORS |
| `MODEL_ARTIFACTS_DIR` | Prediction provider: "mock" (demo outputs) or "trained" (needs artifacts in MODEL_ARTIFACTS_DIR)`nPREDICTION_P |
| `DATASET_PATH` |  |
| `ENABLE_SHAP_EXPLANATIONS` | Explainability & SHAP |
| `SHAP_MAX_DISPLAY_FEATURES` |  |
| `VITE_API_BASE_URL` | --- Frontend Configuration --- |
| `VITE_APP_TITLE` |  |
| `VITE_3D_MODEL_PATH` |  |

## `modules/cardiotwin/frontend/.env.example`

| Variable | Note from the template |
|---|---|
| `VITE_API_URL` | (proxied to http://localhost:8000 by the Vite dev server, served by FastAPI in the Docker image). |
| `VITE_API_PROXY` | Dev server only: where the /api proxy forwards to. |
| `VITE_API_HEALTH_TIMEOUT_MS` | Milliseconds to wait for GET /api/health before falling back to the in-browser edge engine. |

## `modules/hack-ireland-2025/little-blue-booth/.env.example`

| Variable | Note from the template |
|---|---|
| `AUTH_SECRET` | https://next-auth.js.org/configuration/options#secret |
| `DATABASE_URL` | https://www.prisma.io/docs/reference/database-reference/connection-urls#env |

## `modules/safetyconnect/.env.example`

| Variable | Note from the template |
|---|---|
| `XAI_API_KEY` | ---- xAI (Grok) : OpenAI-compatible API ---- |
| `XAI_MODEL` |  |
| `XAI_VOICE_MODEL` | Realtime voice model for the voice survey (grok-voice-latest / grok-voice-fast-1.0) |
| `CLICKHOUSE_URL` | ---- ClickHouse (local binary in dev; ClickHouse Cloud for deploy) ---- |
| `CLICKHOUSE_USER` |  |
| `CLICKHOUSE_PASSWORD` |  |
| `CLICKHOUSE_DATABASE` |  |
| `OPENFDA_API_KEY` | ---- openFDA (optional API key raises the rate limit) ---- |
| `TELEGRAM_BOT_TOKEN` | ---- Telegram (optional: one real demo alert to a phone) ---- |
| `TELEGRAM_CHAT_ID` |  |
| `APP_URL` | ---- App base URL (used to build the patient survey link in alerts) ---- |
| `INNGEST_DEV` | For Inngest Cloud deploy, set the event + signing keys instead. |
| `INNGEST_EVENT_KEY` |  |
| `INNGEST_SIGNING_KEY` |  |

