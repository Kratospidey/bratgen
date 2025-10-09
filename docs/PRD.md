# Project: Brat‑Style Auto Lyric Video Generator

## 1) Summary

Create a minimal, sleek web app where a user uploads a **video** and attaches a **Spotify track link** The app automatically:

* Finds the **best song segment** to fit the video length (or trims video to song end).
* **Layers the music** over the video for preview; exports use **user‑uploaded audio** or **no music** (per setting).
* Overlays **lyrics in brat aesthetics without green blocks** — **transparent** text with **auto black/white** per‑frame contrast.
* Provides a **Mute Original Clip Audio** toggle.
* Exports a shareable/downloadable video.


---

## 2) Goals & Non‑Goals

**Goals**

* 1‑click creation of short lyric edits from user video clips.
* Automatic **segment selection** when track > clip, informed by Spotify analysis where available.
* **Transparent lyric overlay** with auto black/white text for contrast.
* **Audio control**: toggle **Mute Original Clip Audio**; optional ducking when user audio is present.
* Export MP4 (H.264 + AAC) up to **60s**.

**Non‑Goals (v1)**
---

## 3) User Stories

* **U1**: As a creator, I upload a 12–30s vertical video and **drop my audio file** (or paste a Spotify link for preview‑only). I get a finished brat lyric edit.
* **U2**: As a user, if my video is 30s and my song is 3:10, the app **auto‑selects the most “popular”/high‑energy 30s** and aligns lyrics.
* **U3**: As a user, if my video is 45s but my song is 0:30, the export **ends at song end** and fades video/audio.
* **U4**: As a user, I can **nudge** start time ±2s and tweak text size/position before exporting.
* **U5**: As a team, I want **server‑side renders** so exports are consistent and fast.

---

## 4) Scope (v1)

**Must‑haves**

* Upload: MP4/MOV video (<= 200 MB, <= **60s**). **Spotify link** for getting the audio using ytdl or someting etc.
* Auto segment selection for durations **5–60s**.
* Transparent brat‑style overlay: **no green blocks**; text auto‑switches black/white per luminance.
* Subtitle engine: scrape lyrics or get them from somewhere → auto‑timing via Whisper (local) or heuristic (cloud).
* **Audio controls**: Mute/Unmute Original Clip; Music gain; optional ducking when user audio present.
* Export: 1080x1920 MP4; selectable 1:1 and 16:9.

**Nice‑to‑haves**

* Web share link with short‑URL.
* Template save/load.
* Beat‑synced word reveals.

---

## 5) Provider Notes (v1: Spotify only)

* Spotify is used for getting the audio and to surface **Audio Analysis** (sections, tempo, loudness) for better segment suggestions.
* Final exports **include** Spotify stream audio. Export choices produces MP4 up to **60s** with either: (a) **music** mixed per settings or (b) **original clip audio only** or (c) only the music w no original audio. 

* Lyrics come from scraping or some other auto method
---

## 6) System Architecture

**Front‑end**: Next.js (App Router), React, Tailwind.

* Components: UploadPane, PlayerCanvas, LyricEditor, SegmentPicker, StylePreset, ExportPanel.
* Client preview: **@ffmpeg/ffmpeg‑wasm** for quick local previews (optional), WebAudio for metering, Canvas/WebGL for overlays.

**Back‑end**: Next.js API routes (Node), optional worker queue.

* **FFmpeg (native)** for production‑grade rendering on server.
* Whisper (open‑source) via **server job** for optional auto‑timing.
* Storage: Local disk in dev; S3‑compatible in prod.
* Queue: BullMQ/Redis (optional) for render jobs.

**Data**

* Assets: video + audio ; derived waveform and beat grid JSON; timed lyrics JSON.
* Jobs: render requests with selected start time, layout preset, style tokens.

---

## 7) Core Flows

### 7.1 Upload & Validation

1. User proves spotify url,
2. Probe media with ffprobe → duration, fps, resolution, loudness.
3. Generate **waveform peaks** and **chroma features** for segment selection.

### 7.2 Segment Selection ("best/famous part")

* With **Spotify link** and token → use Spotify Audio Analysis (sections/segments + loudness/tempo) to rank high‑energy, chorus‑like windows matching target duration.
* Without analysis (or additionally), run local analysis on **user‑uploaded audio**: onset strength, tempogram, chroma self‑similarity (repetition ≈ chorus), RMS energy, and lyrical density (if .lrc). Score and select; allow ±2s nudge.

### 7.3 Lyric Timing Lyric Timing

* get lyrics somehow then → parse to per‑line times; snap to beats.
* If text‑only **and uploaded audio present** → run Whisper to estimate line timestamps; snap to beats.
* If **provider URL only** (no audio file) → **preview only** (no export) with approximate timings from provider analysis (if available).

### 7.4 Style & Overlay (Brat preset)

* **Color**: No solid plates; **transparent** overlay only.
* **Typography**: **Arial Narrow**, horizontal **width 90%** (visual match), all‑lowercase; heavy weight; tight leading (≈0.95).
* **Look**: Optional processing to emulate artifacted vibe — apply **mosaic** + light **gaussian blur** to text raster, and optional downscale/upsample chain (non‑destructive where possible) for a compressed feel.
* **Auto‑contrast**: For each frame (or every N frames), compute local luminance under the lyric bounds and pick **black or white** text for readability (with 2px stroke/shadow fallback).
* **Layouts**: center, left ribbon, stacked blocks (transparent variants). Safe‑area guards for 9:16.
* **Motion**: subtle scale/position jitter on beats, 100–150ms word fades.

### 7.5 Mix & Export

* **Original Clip Audio**: toggle **Mute** on/off. If not muted and user music present, optional ducking (‑8 dB) under lyric lines.
* **Music Track**:
* Fades: 100ms in/out; hard stop when music ends if video is longer.
* Render path: preview (client low‑res) and final (server FFmpeg → H.264/AAC 192 kbps).

---

## 8) API/Route Design (Next.js)

* `POST /api/upload` → asset IDs.
* `POST /api/analyze/audio` → waveform, beats, chroma, analysis JSON.
* `POST /api/segment/select` → input: durations + analysis; output: start/end.
* `POST /api/lyrics/align` → input: text/.lrc + audioId; output: timed lines.
* `POST /api/render` → input: asset IDs, segment, style, audioMix: `{ useUserMusic: boolean, muteOriginal: boolean }`; output: jobId.
* `GET /api/render/:jobId` → status + download URL.


---

## 9) Data Models (simplified)

```ts
Asset { id, kind: 'video'|'audio'|'lyrics', url, duration, meta }
Analysis { assetId, duration, bpm, beats: number[], chroma: number[][], rms: number[] }
TimedLyric { t0: number, t1: number, text: string }
RenderJob { id, status, params, progress, resultUrl }
```

---

## 10) UI Requirements

* **Landing**: upload video + paste Spotify link;
* **Editor**: player left; lyrics/style right. Keyboard: JKL; arrows to nudge.
* **Audio panel**: checkbox **Mute Original Clip Audio**; slider **Music Gain**; toggle **Use Uploaded Audio in Export**.
* **Segment picker**: show Spotify‑suggested chorus candidates.
* **Style**: auto‑contrast toggle; artifact amount (none/low/med).
* **Export**: 720p/1080p; aspect; **60s cap**; export summary shows **what audio will be in the file**.

---

## 11) Performance Targets

* First preview under **6s** for 30s clip on mid‑tier laptop.
* Server export (1080x1920, ≤60s) under **20s** on 4‑vCPU box.
* Memory: cap FFmpeg‑wasm to 512MB; fall back to server render if exceeded.

---

## 12) Security & Privacy

* All uploads via signed URLs; scans for file type/size.
* Auto‑purge assets after **24 hours** in demo environment.
* No storage of OAuth tokens server‑side beyond session scope.

---

## 13) Testing & QA

* Unit tests: segment scoring, .lrc parser, color/typography presets.
* Integration: end‑to‑end render with fixtures.
* Visual tests: snapshot of frames for regression.

---

## 14) DevOps

* **Repo**: Next.js monorepo (apps/web, packages/ffmpeg, packages/analysis).
* **CI**: Lint + typecheck + unit tests + build.
* **Infra**: Vercel (web) + Render/Fly.io (worker) or single VPS for both.
* **Storage**: S3‑compatible (R2/MinIO) with lifecycle rules.

---

## 15) Project Structure (proposed)

```
/ (repo)
 ├─ apps/web
 │   ├─ app/ (Next App Router)
 │   ├─ components/
 │   ├─ lib/
 │   ├─ styles/
 │   └─ pages/api/ (if using Pages API routes)
 ├─ packages/analysis (Node bindings)
 ├─ packages/ffmpeg (render wrappers)
 ├─ packages/ui (shared UI)
 └─ tests/
```

---

## 16) Acceptance Criteria (v1)

* User uploads a video, provides a **Spotify link**, and (optionally) uploads an audio file.
* System proposes a segment using Spotify analysis; user can nudge ±2s.
* **Transparent** lyric overlay with auto black/white passes contrast checks.
* **Mute Original Clip Audio** works as expected.
* **Export** produces MP4 up to **60s** with either: (a) **music** mixed per settings or (b) **original clip audio only** or (c) only the music w no original audio. 

---

