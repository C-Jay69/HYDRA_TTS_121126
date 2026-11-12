import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Shared Gemini client utility with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    apiVersion: 'v1alpha',
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * ---------------------------------------------------------------------------
 * Kokoro (local, offline) TTS
 * ---------------------------------------------------------------------------
 * Talks to scripts/kokoro_worker.py, a persistent Python process that keeps
 * the Kokoro-82M model loaded between chunks. The Python interpreter defaults
 * to ~/venv/bin/python (where kokoro + torch are installed) but can be pointed
 * elsewhere with KOKORO_PYTHON.
 */
const KOKORO_SCRIPT = path.resolve(__dirname, 'scripts', 'kokoro_worker.py');
const KOKORO_TIMEOUT_MS = parseInt(process.env.KOKORO_TIMEOUT_MS || '600000', 10);

function resolveKokoroPython(): string {
  const candidates = [
    process.env.KOKORO_PYTHON,
    path.join(os.homedir(), 'venv', 'bin', 'python'),
    'python3',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep) && !candidate.startsWith('.')) {
      // Bare command such as "python3": let the OS resolve it.
      return candidate;
    }
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'python3';
}

interface KokoroPending {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

class KokoroWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, KokoroPending>();
  private buffer = '';
  private stderrTail: string[] = [];
  private lastError: string | null = null;
  private ready = false;

  readonly pythonPath = resolveKokoroPython();

  get configured(): boolean {
    return fs.existsSync(KOKORO_SCRIPT) && fs.existsSync(this.pythonPath);
  }

  get running(): boolean {
    return Boolean(this.child && !this.child.killed);
  }

  get isModelReady(): boolean {
    return this.ready;
  }

  get diagnostics() {
    return {
      configured: this.configured,
      running: this.running,
      modelReady: this.ready,
      python: this.pythonPath,
      script: KOKORO_SCRIPT,
      lastError: this.lastError,
      stderrTail: this.stderrTail.slice(-20),
    };
  }

  private ensureStarted() {
    if (this.running) return;

    this.ready = false;
    this.buffer = '';
    console.log(`[kokoro] starting worker: ${this.pythonPath} ${KOKORO_SCRIPT}`);

    const child = spawn(this.pythonPath, [KOKORO_SCRIPT], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        TOKENIZERS_PARALLELISM: 'false',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.onStdout(chunk));

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trimEnd();
      if (!text) return;
      this.stderrTail.push(text);
      if (this.stderrTail.length > 40) this.stderrTail.shift();
      console.log(`[kokoro:py] ${text}`);
    });

    child.on('error', (err) => {
      this.lastError = err.message;
      console.error('[kokoro] failed to start Python worker:', err.message);
      this.failAll(new Error(`Kokoro worker failed to start: ${err.message}`));
      this.child = null;
      this.ready = false;
    });

    child.on('exit', (code, signal) => {
      const message = `Kokoro worker exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
      console.error(`[kokoro] ${message}`);
      if (code !== 0 && code !== null) this.lastError = message;
      this.failAll(new Error(message));
      this.child = null;
      this.ready = false;
    });
  }

  private onStdout(chunk: string) {
    this.buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message: any;
      try {
        message = JSON.parse(line);
      } catch {
        console.warn(`[kokoro] ignoring non-JSON worker output: ${line.slice(0, 200)}`);
        continue;
      }

      if (message.type === 'ready') {
        this.ready = true;
        console.log(`[kokoro] worker ready (pid ${message.pid})`);
        continue;
      }

      const pending = message.id ? this.pending.get(message.id) : undefined;
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);

      if (message.ok === false) {
        pending.reject(new Error(message.error || 'Kokoro synthesis failed'));
      } else {
        pending.resolve(message);
      }
    }
  }

  private failAll(error: Error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.reject(error);
    }
  }

  request(payload: Record<string, unknown>, timeoutMs = KOKORO_TIMEOUT_MS): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.configured) {
        reject(
          new Error(
            `Kokoro is not configured. Missing worker script or Python interpreter (${this.pythonPath}). Set KOKORO_PYTHON in .env.`
          )
        );
        return;
      }

      this.ensureStarted();
      const child = this.child;
      if (!child || !child.stdin.writable) {
        reject(new Error('Kokoro worker is not running'));
        return;
      }

      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Kokoro timed out after ${Math.round(timeoutMs / 1000)}s. The first run may still be downloading model weights; check the server logs.`
          )
        );
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, ...payload }) + '\n');
    });
  }

  warmUp() {
    if (!this.configured) return;
    this.request(
      { action: 'synthesize', text: 'Warming up.', voice: process.env.KOKORO_VOICE || 'af_heart', speed: 1 },
      KOKORO_TIMEOUT_MS
    ).catch((err) => console.warn(`[kokoro] warm-up skipped: ${err.message}`));
  }

  stop() {
    this.failAll(new Error('Server shutting down'));
    if (this.child) {
      try {
        this.child.stdin.end();
      } catch {}
      this.child.kill();
      this.child = null;
    }
    this.ready = false;
  }
}

const kokoro = new KokoroWorker();

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3.8-flash-tts',
    kokoro: {
      configured: kokoro.configured,
      running: kokoro.running,
      modelReady: kokoro.isModelReady,
    },
  });
});

// Kokoro health / diagnostics (useful while the model downloads on first use)
app.get('/api/kokoro/status', (_req: Request, res: Response) => {
  res.json(kokoro.diagnostics);
});

app.post('/api/tts/kokoro', async (req: Request, res: Response) => {
  const { text, voice = process.env.KOKORO_VOICE || 'af_heart', speed = 1, lang } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Text content is required' });
    return;
  }

  if (!kokoro.configured) {
    res.status(503).json({
      error: `Kokoro is not available on this machine. Expected worker script at ${KOKORO_SCRIPT} and Python at ${kokoro.pythonPath}. Set KOKORO_PYTHON in .env if your venv lives elsewhere.`,
    });
    return;
  }

  try {
    const result = await kokoro.request({
      action: 'synthesize',
      text: text.trim(),
      voice,
      speed,
      lang,
    });

    res.json({
      audioBase64: result.audioBase64,
      mimeType: result.mimeType || 'audio/wav',
      sampleRate: result.sampleRate || 24000,
      duration: result.duration,
      voice: result.voice,
    });
  } catch (error: any) {
    console.error('[kokoro] synthesis failed:', error?.message || error);
    res.status(502).json({ error: error?.message || 'Kokoro synthesis failed' });
  }
});

app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, voice = 'Kore', style = 'Natural, captivating audiobook narrator with nuanced pacing and expressive inflection' } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Text content is required' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
    });
    return;
  }

  try {
    // Unary TTS with gemini-3.8-flash-tts generates complete WAV audio (24kHz mono 16-bit)
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: style || 'Clear, warm, professional audiobook narration',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || 'Kore',
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(
      (part: any) => part.inlineData?.mimeType?.startsWith('audio/') || part.inlineData?.data
    );

    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      // Fallback check if parts[0] has inlineData
      const fallbackData = candidate?.content?.parts?.[0]?.inlineData?.data;
      if (fallbackData) {
        res.json({
          audioBase64: fallbackData,
          mimeType: candidate?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav',
        });
        return;
      }
      res.status(502).json({
        error: 'No audio data received from Gemini TTS model',
        details: candidate?.finishReason || 'Unknown generation status',
      });
      return;
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error generating speech with Gemini TTS:', error);
    const message = error?.message || 'Failed to synthesize speech';
    const status = error?.status || 500;
    res.status(status).json({
      error: message,
      code: error?.code,
    });
  }
});

// Vite middleware for development or static serving for production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);

    // Load the Kokoro model in the background so the first chunk isn't slow.
    // Set KOKORO_WARMUP=false to skip (e.g. when only using Gemini).
    if (process.env.KOKORO_WARMUP !== 'false') {
      kokoro.warmUp();
    }
  });
}

const shutdown = () => {
  kokoro.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
