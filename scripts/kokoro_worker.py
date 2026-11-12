#!/usr/bin/env python3
"""
Persistent Kokoro TTS worker for HYDRA TTS.

The Node server keeps this process alive and exchanges newline-delimited JSON
on stdin/stdout. Loading the Kokoro model is expensive (several seconds), so
keeping it warm is what makes per-chunk audiobook synthesis practical.

Request  (one JSON object per line on stdin):
  {"id": "<string>", "action": "ping"}
  {"id": "<string>", "action": "synthesize",
   "text": "...", "voice": "af_heart", "speed": 1.0, "lang": "a"}

Response (one JSON object per line on stdout):
  {"id": "<string>", "ok": true, "sampleRate": 24000, "duration": 12.34,
   "audioBase64": "<wav bytes>"}
  {"id": "<string>", "ok": false, "error": "..."}

All diagnostics go to stderr so stdout stays a clean protocol channel.
"""

import base64
import io
import json
import os
import sys
import traceback
import wave

# Keep a private handle to the real stdout, then point BOTH sys.stdout and the
# underlying file descriptor 1 at stderr. Libraries (and even pip, which misaki
# can invoke on first import) write straight to fd 1, so the fd-level redirect
# is what actually keeps the JSON protocol channel clean.
_PROTOCOL_OUT = os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8", buffering=1)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
sys.stdout = sys.stderr

SAMPLE_RATE = 24000

# Kokoro language codes: the leading letter of a voice id picks the pipeline.
VOICE_LANG_PREFIX = {
    "a": "a",  # American English  (af_*, am_*)
    "b": "b",  # British English   (bf_*, bm_*)
    "e": "e",  # Spanish           (ef_*, em_*)
    "f": "f",  # French            (ff_*, fm_*)
    "h": "h",  # Hindi             (hf_*, hm_*)
    "i": "i",  # Italian           (if_*, im_*)
    "j": "j",  # Japanese          (jf_*, jm_*)
    "p": "p",  # Brazilian Portug. (pf_*, pm_*)
    "z": "z",  # Mandarin Chinese  (zf_*, zm_*)
}

VOICES = {
    "a": [
        "af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica",
        "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
        "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
        "am_michael", "am_onyx", "am_puck", "am_santa",
    ],
    "b": [
        "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
        "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
    ],
}


def log(*args):
    print(*args, file=sys.stderr, flush=True)


def reply(payload):
    _PROTOCOL_OUT.write(json.dumps(payload, ensure_ascii=False) + "\n")
    _PROTOCOL_OUT.flush()


def voice_lang(voice, requested_lang):
    prefix = voice[:1].lower() if voice else ""
    return VOICE_LANG_PREFIX.get(prefix, requested_lang or "a")


def clamp_speed(value):
    try:
        speed = float(value)
    except (TypeError, ValueError):
        return 1.0
    return max(0.5, min(2.0, speed))


class KokoroEngine:
    def __init__(self):
        self.pipelines = {}
        self._kpipeline = None

    def _load_class(self):
        if self._kpipeline is None:
            # Imported lazily so `ping` answers instantly even before torch loads.
            from kokoro import KPipeline
            self._kpipeline = KPipeline
        return self._kpipeline

    def pipeline(self, lang):
        pipeline = self.pipelines.get(lang)
        if pipeline is None:
            log(f"[kokoro] loading pipeline for lang={lang!r} ...")
            KPipeline = self._load_class()
            device = os.environ.get("KOKORO_DEVICE") or None
            pipeline = KPipeline(lang_code=lang, device=device or None)
            self.pipelines[lang] = pipeline
            log(f"[kokoro] pipeline ready for lang={lang!r}")
        return pipeline

    def synthesize(self, text, voice, speed, lang):
        import numpy as np

        voice = (voice or os.environ.get("KOKORO_VOICE") or "af_heart").strip()
        lang = voice_lang(voice, lang)
        speed = clamp_speed(speed)

        pipeline = self.pipeline(lang)
        audio_parts = []
        # split_pattern=None would make Kokoro treat the whole chunk as one piece,
        # which degrades prosody on long input. Newlines keep natural paragraph breaks.
        for result in pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+"):
            audio = getattr(result, "audio", None)
            if audio is None:
                continue
            if hasattr(audio, "detach"):  # torch tensor
                audio = audio.detach().cpu().numpy()
            audio_parts.append(np.asarray(audio, dtype=np.float32))

        if not audio_parts:
            raise RuntimeError("Kokoro produced no audio for this text")

        samples = np.concatenate(audio_parts)
        # Normalize peaks conservatively to avoid clipping after stitching.
        peak = float(np.max(np.abs(samples))) if samples.size else 0.0
        if peak > 0.99:
            samples = samples * (0.99 / peak)

        pcm16 = np.clip(samples * 32767.0, -32768, 32767).astype(np.int16)

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(SAMPLE_RATE)
            wav.writeframes(pcm16.tobytes())

        return buffer.getvalue(), len(pcm16) / float(SAMPLE_RATE), voice

    def handle(self, request):
        action = request.get("action") or "synthesize"
        if action == "ping":
            return {"voices": VOICES}
        if action == "synthesize":
            text = (request.get("text") or "").strip()
            if not text:
                raise ValueError("Text content is required")
            wav_bytes, duration, voice = self.synthesize(
                text,
                request.get("voice"),
                request.get("speed"),
                request.get("lang"),
            )
            return {
                "audioBase64": base64.b64encode(wav_bytes).decode("ascii"),
                "mimeType": "audio/wav",
                "sampleRate": SAMPLE_RATE,
                "duration": round(duration, 3),
                "voice": voice,
            }
        raise ValueError(f"Unknown action: {action!r}")


def main():
    log("[kokoro] worker starting")
    engine = KokoroEngine()
    reply({"type": "ready", "pid": os.getpid(), "voices": VOICES})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            if not isinstance(request, dict):
                raise ValueError("Request must be a JSON object")
            request_id = request.get("id")
            result = engine.handle(request)
            reply({"id": request_id, "ok": True, **result})
        except Exception as exc:  # noqa: BLE001 - surface every failure to Node
            log("[kokoro] error:", exc)
            traceback.print_exc(file=sys.stderr)
            reply({"id": request_id, "ok": False, "error": str(exc)})


if __name__ == "__main__":
    main()
