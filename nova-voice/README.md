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

- `female, young adult, low pitch` ← current Nova default / Sample 1
- `female, young adult, moderate pitch`
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
