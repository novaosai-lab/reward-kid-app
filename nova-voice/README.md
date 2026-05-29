# Nova Voice - OmniVoice

Local TTS/voice-cloning sandbox for Nova using `k2-fsa/OmniVoice`.

## Setup
- Python: `/opt/homebrew/bin/python3.12`
- Virtualenv: `/Users/nova/.openclaw/workspace/nova-voice/.venv`
- Model: `k2-fsa/OmniVoice`
- Device default: `mps` on Apple Silicon, fallback CPU

## Generate speech

```bash
/Users/nova/.openclaw/workspace/nova-voice/nova-voice \
  --instruct 'female, young adult, low pitch' \
  --output output/nova-thai-test.wav \
  'สวัสดีค่ะพี่นิค โนวาพร้อมช่วยดูแลระบบ โอเพ่นคลอว์ แล้วค่ะ'
```

## Supported voice design examples
Use only supported OmniVoice instruct tokens, comma + space separated:

- `female, young adult, low pitch` ← previous default / Sample 1
- `female, young adult, moderate pitch` ← current Nova default after Nick's listening test (speed `0.94`, quality step `32`)
- `female, young adult, high pitch`
- `female, low pitch`
- `female, british accent`
- `female, whisper`

Unsupported token example: `warm`.

## Voice cloning
Only use voices Nick owns or has explicit permission to clone.

```bash
./nova-voice \
  --ref-audio samples/reference.wav \
  --ref-text 'reference transcript here' \
  --output output/cloned.wav \
  'ข้อความที่ต้องการให้พูด'
```

## Current verified sample
- `/Users/nova/.openclaw/workspace/nova-voice/output/nova-thai-test.wav`
- WAV PCM 16-bit mono 24 kHz
- Duration: ~3.9s

## Voice mode toggle

Modes are stored in `/Users/nova/.openclaw/workspace/nova-voice/state.json`.

- `off` = text only
- `voice` = voice replies allowed when sender wrapper is used
- `both` = text + voice allowed
- `auto` = voice replies for inbound voice context, text for normal text context

```bash
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-mode status
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-mode set auto
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-mode set off
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-mode tone 'female, young adult, moderate pitch'
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-mode profile 'female, young adult, moderate pitch' --speed 0.94 --num-step 32
```

Policy-aware sending:

```bash
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-send \
  --respect-mode \
  --context voice \
  --reply-to 2289 \
  'ตอบกลับ voice note ด้วยเสียง'
```

## Send to Telegram

```bash
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-send \
  --reply-to 2289 \
  --caption 'Nova voice test' \
  'ทดสอบส่งเสียงจากโนวา ผ่านโอมนิวอยซ์ค่ะ'
```

This generates WAV, converts it to OGG/Opus via ffmpeg, then sends it with:

```bash
openclaw message send --channel telegram --target 8613255279 --media output/nova-reply.ogg
```

## Current integration status
1. STT for inbound Telegram voice messages: done via local `whisper-cpp` wrapper `nova-transcribe` using `ggml-small.bin` for better Thai accuracy.
2. TTS outbound Telegram audio: done via `nova-voice-send`.
3. Voice mode policy switch: done via `nova-voice-mode`.

## Next integration phases
1. Add dashboard panel for voice mode/status.
2. Add slash-command routing (`/voice on`, `/voice off`, `/voice auto`) if needed.
3. Add per-chat voice preferences if more users/channels are added.

## Quality baseline

Before replacing STT or TTS engines, run a local Thai round-trip baseline:

```bash
python3 /Users/nova/.openclaw/workspace/nova-voice/benchmark_roundtrip.py --num-step 8
```

This generates speech locally, transcribes it through the current STT engine, and reports latency plus normalized transcript similarity. It is a smoke baseline; evaluate STT improvements against consented real inbound voice notes as well.

### MLX accuracy challenger

An isolated candidate wrapper is available without changing the active Telegram STT route:

```bash
/Users/nova/.openclaw/workspace/nova-voice/nova-transcribe-mlx /path/to/audio.ogg
```

It uses local `mlx-community/whisper-large-v3-turbo` with a short Thai/Nova glossary prompt. Initial benchmark showed improved recognition for `พี่นิค`, `โนวา`, and `รับส่งเสียง`, but slower runtime than current `whisper.cpp small`; keep it as an accuracy challenger until a larger real-sample A/B set is reviewed.

### Thai TTS challenger

An isolated Thai-specific comparison engine is available without changing active OmniVoice replies:

```bash
/Users/nova/.openclaw/workspace/nova-voice/nova-voice-thai \
  --output output/tts-ab/vachana-test.wav \
  'สวัสดีค่ะพี่นิค โนวากำลังทดสอบเสียงภาษาไทยค่ะ'
```

It uses PyThaiTTS Vachana `th_f_1`. Initial local comparison was faster and more intelligible on a Thai sample than the current cold OmniVoice path, but the speaking character is different; require Nick's listening preference before any active default change.
