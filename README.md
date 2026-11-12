# HYDRA TTS

Turn long-form manuscripts into audiobooks with intelligent chunking and local
text-to-speech.

## Engines

| Engine | Where it runs | Requirements |
| --- | --- | --- |
| **Kokoro (Local)** — default | Your machine, through `scripts/kokoro_worker.py` | Python with `kokoro` installed |
| **Gemini TTS** | Google Gemini API | `GEMINI_API_KEY` |
| **Browser Voice** | The browser's speech engine | None |

The Kokoro engine keeps a single Python process alive, so the model is loaded
once and reused for every chunk.

## Kokoro setup

1. Make sure a Python environment has Kokoro installed:

   ```bash
   python3 -m venv ~/venv
   ~/venv/bin/pip install kokoro soundfile
   ```

2. Point the app at that interpreter. Either export `KOKORO_PYTHON` or add it
   to `.env`:

   ```bash
   KOKORO_PYTHON="/home/<you>/venv/bin/python"
   KOKORO_VOICE="af_heart"
   ```

   The default is `~/venv/bin/python`, so a venv in your home directory works
   with no configuration.

3. Start the app. On first synthesis, Kokoro downloads its model weights
   (~330 MB) from Hugging Face; later runs load them from the local cache. The
   first chunk therefore takes longer — watch the server logs.

Check status at any time:

```bash
curl http://localhost:3000/api/kokoro/status
```

Voice list (curated in `src/services/ttsService.ts`): `af_heart`, `af_bella`,
`af_nicole`, `af_sarah`, `af_aoede`, `am_michael`, `am_fenrir`, `am_puck`,
`am_onyx`, `am_adam`, `bf_emma`, `bm_george`, `bm_fable`.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `KOKORO_PYTHON` | `~/venv/bin/python` | Python interpreter with the `kokoro` package |
| `KOKORO_VOICE` | `af_heart` | Default voice |
| `KOKORO_TIMEOUT_MS` | `600000` | Per-chunk synthesis timeout |
| `KOKORO_WARMUP` | `true` | Load the model at server startup |
| `KOKORO_DEVICE` | auto | `cuda`, `cpu` or `mps` |
| `GEMINI_API_KEY` | — | Only needed for the Gemini engine |

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

For a production build:

```bash
npm run build
NODE_ENV=production npm start
```
