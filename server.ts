import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
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

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3.8-flash-tts',
  });
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
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
