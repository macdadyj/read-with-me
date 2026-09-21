# Read With Me

A mobile-first web app that helps a child read a **printed workbook page**. Take a photo, follow the words on screen, listen while they read aloud, and coach them only when they stall.

Target readers: roughly ages 5–8, with a parent nearby. No accounts for this first demo. No ads, no social, no public gallery.

AI pieces are **Google Cloud only** (Vision or Document AI, Speech-to-Text Chirp 3, Cloud Text-to-Speech, Vertex Gemini). Nothing is sent to OpenAI, AWS, or xAI.

## Core loop

1. **Capture** a workbook page (camera, upload, or the built-in sample). Confirm with a simple Full / Tighten / Text-only crop.
2. **Extract** lines and words with bounding boxes.
3. **Coach start:** “Let’s start at the top.” Highlight the first reading word.
4. **Listen** to the microphone (streamed to Cloud Speech-to-Text). A typed-word box stands in for the mic in local demo mode.
5. **Advance** `currentIndex` when the child says a close-enough match.
6. **Help in stages** if they stall (see stall ladder below). Do not interrupt fluent reading.
7. **End of page:** “Nice reading.” Offer another picture.

## Stall ladder (product spec)

The stall clock starts when a word is highlighted and no advancing match arrives. Parent toggle:

| Pace | Hint 1 | Hint 2 | Hint 3 | Say the word |
| --- | --- | --- | --- | --- |
| **Gentle** | ~4s | ~8s | ~12s | ~16s or 3rd missed attempt |
| **Keep us moving** | ~2s | ~4s | ~6s | ~8s |

Stages:

1. Gentle prompt — “Try this word.”
2. Phoneme hint — first sound, then onset + vowel (`because` → “It starts with /b/.” then “/bih/ … /kawz/.”). The child sees the word in large type with the coached part underlined. No IPA dump.
3. An easy sentence that uses the word, still avoiding a blunt answer when possible.
4. Say the word clearly, ask them to repeat, then move on so the page does not die on one word.

**Help** always advances one stage immediately. Copy is encouraging: “almost,” never “wrong.”

The aligner is word-based and fuzzy (Levenshtein + common kid pronunciations). It can skip one tiny function word, snap forward on the same line, and will not snap backward more than one token.

## Local demo (no camera, no mic, no GCP)

```bash
npm install
npm test
npm run test:e2e
npm run dev
```

Open `http://localhost:5173`.

- **Use the sample page** loads `public/fixtures/workbook.png` plus mocked OCR JSON.
- **Type a word to pretend you said it** drives the real aligner.
- **Play the demo** runs the script below.
- Without Application Default Credentials the API stays in mock mode: fixture OCR, local hints, browser `speechSynthesis` if Cloud TTS returns 204.

### Demo script

1. Home → **Play the demo** (or Use the sample page → **This is the text**).
2. Coach says “Let’s start at the top.” **The** is highlighted.
3. First two words advance (`the`, `puppy`).
4. The track stalls on the **third word** (`ran`).
5. Watch the ladder: prompt → first sound → sentence hint → say “ran.”
6. The word advances and the page can finish.

Manual version of the same path: sample page → Start → type `the` → type `puppy` → wait on `ran` (or tap **Help**) → type `ran`.

## Architecture

One Cloud Run service:

- React + Vite UI (camera / mic via `getUserMedia`; **Web Speech is not the primary recognizer**)
- Express API on the same origin
  - `POST /api/ocr` — Vision `DOCUMENT_TEXT_DETECTION` (Document AI if `DOCUMENT_AI_PROCESSOR` is set later)
  - `GET /api/ocr/fixture` — sample workbook OCR
  - `WS /api/stt-stream` — 16 kHz PCM16 → Speech-to-Text v2 `chirp_3`
  - `POST /api/hint` — Vertex Gemini, local pedagogue fallback
  - `POST /api/speak` — Cloud TTS (`en-US-Neural2-F` by default)
  - `GET /api/config` — whether GCP clients are live

Simplest GCP-native choices used here: **Vision** (no Document AI processor to provision), **Speech-to-Text v2 Chirp 3** in location `us`, **Neural2 TTS**, **Gemini on Vertex** in `us-central1`. Clients are env-flagged: missing ADC → graceful mocks. APIs can be enabled in parallel; the UI works on the sample page meanwhile.

Photos and child audio are held in memory for the live request only. `SAVE_SESSION` defaults to false. No long-term child audio in v1.

## Enable APIs and deploy

Use the existing project **`montano-349204`**. Do not create a new project.

| Setting | Value |
| --- | --- |
| `GCP_PROJECT_ID` | `montano-349204` |
| `REGION` | `us-central1` |
| Cloud Run service | `read-with-me` |
| Runtime SA | `read-with-me@montano-349204.iam.gserviceaccount.com` |
| Bucket | `gs://montano-349204-read-with-me` |

Speech-to-Text v2 recognizers still use multi-region `us`. Everything else is `us-central1`.

These APIs are already enabled on `montano-349204`: Vision, Document AI, Speech-to-Text, Text-to-Speech, Vertex AI, Cloud Run, Cloud Storage, Cloud Build. Re-run only if a new machine needs it:

```bash
export GCP_PROJECT_ID=montano-349204
export REGION=us-central1
gcloud config set project "$GCP_PROJECT_ID"

gcloud services enable \
  vision.googleapis.com \
  documentai.googleapis.com \
  speech.googleapis.com \
  texttospeech.googleapis.com \
  aiplatform.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  --project="$GCP_PROJECT_ID"
```

Local `npm run dev` keeps mock fallbacks until ADC is present. Do not wait on further GCE work.

### IAM

Deploy and run as **`read-with-me@montano-349204.iam.gserviceaccount.com`** (never the Compute default). That account needs:

- `roles/aiplatform.user` — Vertex Gemini
- `roles/speech.client` — streaming recognition
- Vision and Cloud TTS once those APIs are enabled (already on)
- `roles/storage.objectAdmin` on `gs://montano-349204-read-with-me` if a parent later sets `SAVE_SESSION=true`

```bash
export GCP_PROJECT_ID=montano-349204
export SA=read-with-me@montano-349204.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$SA" --role="roles/speech.client"
gsutil iam ch "serviceAccount:${SA}:objectAdmin" gs://montano-349204-read-with-me
```

### Deploy

```bash
export GCP_PROJECT_ID=montano-349204
export REGION=us-central1
gcloud builds submit --project="$GCP_PROJECT_ID" --config cloudbuild.yaml
# or
gcloud run deploy read-with-me \
  --project="$GCP_PROJECT_ID" \
  --source . \
  --region="$REGION" \
  --allow-unauthenticated \
  --min-instances=0 \
  --service-account=read-with-me@montano-349204.iam.gserviceaccount.com \
  --set-env-vars="GCP_PROJECT_ID=montano-349204,REGION=us-central1,GCP_LOCATION=us-central1,SPEECH_LOCATION=us,GCS_BUCKET=gs://montano-349204-read-with-me,SAVE_SESSION=false"
```

Manifests: `cloudbuild.yaml` and `deploy/cloud-run-service.yaml`. The service listens on `PORT` (8080) and scales to zero.

## Local path with Application Default Credentials

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project montano-349204
cp .env.example .env
# already contains:
#   GCP_PROJECT_ID=montano-349204
#   REGION=us-central1
#   GCS_BUCKET=gs://montano-349204-read-with-me
npm run dev
```

The Google client libraries pick up ADC automatically and call `montano-349204`. If ADC or an API is missing, each client falls back to mocks. Set `USE_MOCK_GCP=true` to force mocks even when ADC exists.

## Cost drivers (estimates)

These move with list price; treat them as order-of-magnitude.

| Driver | What burns money | Ballpark |
| --- | --- | --- |
| Cloud Vision `DOCUMENT_TEXT_DETECTION` | Per image | about $1.50 / 1,000 images |
| Speech-to-Text v2 Chirp 3 | Streaming minutes while Listening is on | roughly $0.016–$0.048 / minute |
| Cloud TTS Neural2 / Chirp-style | Characters spoken by the coach | about $4–$16 / 1M characters |
| Vertex Gemini | Hint + OCR cleanup tokens | cents per page at flash-tier rates |
| Cloud Run | CPU/RAM while a session is live; **scale-to-zero** when idle | mostly $0 at rest |

Biggest knob: **stop the mic when paused**. Do not leave streaming STT open on the kitchen table.

## Child safety

- Encouraging copy only.
- No accounts, comments, or share sheet in v1.
- Raw child audio is not written to disk or Cloud Storage unless a parent later opts into `SAVE_SESSION`.
- If OCR finds nothing: “I couldn’t find words in that photo. Let’s try a flatter, brighter picture.”

## Layout

```
src/client     React UI (home, confirm, reader, done)
src/server     Cloud Run API + STT WebSocket
src/shared     Aligner, stall ladder, phoneme hints, types
public/fixtures  Sample workbook photo + mocked OCR JSON
```

`npm test` (Vitest) covers the aligner, stall timings, and the **mic capture → PCM16 encode → STT client** path using a synthetic sine buffer (no real microphone). It asserts LINEAR16 frames are produced and a mock Speech-to-Text writer receives them.

Optional Playwright (fake `MediaStream`, no hardware mic):

```bash
npx playwright install chromium
npm run test:e2e
```

That grants microphone permission, injects an oscillator, opens the reader, and checks the live level meter moves into a hearing state.

`npm run fixture` regenerates the sample page.

### Mic diagnostics

While listening, the browser console logs `[read-with-me:mic]` events (`start`, `level`, `transcript` char counts, `stt-ready` / `stt-error`). Cloud Run logs `[read-with-me:stt]` with frame/byte counts only — never audio bytes or what the child said.
