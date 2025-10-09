import type { StoredUploadSummary } from "@/lib/uploads";
import { analyzeUploadAudio, type LocalAudioAnalysis } from "@/app/api/_lib/analysis";
import { ensureLocalPath } from "@/app/api/_lib/storage";

export interface AlignedLyricLine {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AlignmentResult {
  lines: AlignedLyricLine[];
  duration: number;
  model: "beats" | "whisper";
}

let whisperAvailable: boolean | null = null;
let whisperPipeline: any = null;

async function loadWhisper() {
  if (whisperAvailable === false) {
    return null;
  }
  if (!process.env.BRATGEN_ENABLE_WHISPER) {
    whisperAvailable = false;
    return null;
  }
  if (whisperPipeline) {
    return whisperPipeline;
  }
  try {
    const transformers = await import("@xenova/transformers");
    whisperPipeline = await transformers.pipeline("automatic-speech-recognition", "Xenova/whisper-small.en");
    whisperAvailable = true;
    return whisperPipeline;
  } catch (error) {
    console.warn("failed to load whisper pipeline", error);
    whisperAvailable = false;
    return null;
  }
}

export async function alignLyricsToAudio({
  upload,
  lyrics
}: {
  upload: StoredUploadSummary;
  lyrics: string;
}): Promise<AlignmentResult> {
  const lines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const analysis = await analyzeUploadAudio(upload, Math.min(upload.duration, 30));
  const whisper = await loadWhisper();

  if (!lines.length) {
    return {
      lines: [],
      duration: analysis.duration,
      model: whisper ? "whisper" : "beats"
    };
  }

  if (whisper) {
    try {
      const whisperLines = await alignWithWhisper(whisper, upload, lines, analysis);
      if (whisperLines) {
        return {
          lines: snapToBeats(whisperLines, analysis),
          duration: analysis.duration,
          model: "whisper"
        };
      }
    } catch (error) {
      console.warn("whisper alignment failed", error);
    }
  }

  return {
    lines: alignWithBeats(lines, analysis),
    duration: analysis.duration,
    model: "beats"
  };
}

async function alignWithWhisper(
  pipeline: any,
  upload: StoredUploadSummary,
  lines: string[],
  analysis: LocalAudioAnalysis
): Promise<AlignedLyricLine[] | null> {
  const source = upload.files.audio ?? upload.files.video;
  if (!source) {
    return null;
  }
  const localPath = await ensureLocalPath(source);
  const result = await pipeline(localPath, {
    chunk_length_s: 30,
    return_timestamps: "word"
  });
  const words = (result.chunks ?? []) as Array<{ text: string; timestamp: [number, number]; confidence?: number }>;
  if (!words.length) {
    return null;
  }

  const linesTimed: AlignedLyricLine[] = [];
  let cursor = 0;

  for (const line of lines) {
    const tokens = sanitize(line).split(" ").filter(Boolean);
    if (!tokens.length) {
      continue;
    }
    const startIndex = findTokenMatch(words, tokens[0], cursor);
    const endIndex = findTokenMatch(words, tokens[tokens.length - 1], startIndex);
    const startTime = startIndex >= 0 ? words[startIndex].timestamp[0] : analysis.beats[cursor] ?? 0;
    const endTime = endIndex >= 0 ? words[endIndex].timestamp[1] : startTime + Math.max(1, tokens.length * 0.4);
    cursor = Math.max(0, endIndex >= 0 ? endIndex + 1 : startIndex + 1);
    const confidence = averageConfidence(words.slice(Math.max(0, startIndex), Math.max(startIndex + 1, endIndex + 1)));
    linesTimed.push({
      text: line,
      start: Math.max(0, startTime),
      end: Math.min(analysis.duration, Math.max(startTime + 0.25, endTime)),
      confidence: confidence ?? 0.75
    });
  }

  return linesTimed;
}

function snapToBeats(lines: AlignedLyricLine[], analysis: LocalAudioAnalysis): AlignedLyricLine[] {
  if (!analysis.beats.length) {
    return lines;
  }
  return lines.map((line) => {
    const beatStart = closestBeat(line.start, analysis.beats);
    const beatEnd = closestBeat(line.end, analysis.beats, true) ?? beatStart + Math.max(0.5, (line.end - line.start));
    return {
      ...line,
      start: beatStart,
      end: Math.min(analysis.duration, beatEnd)
    };
  });
}

function alignWithBeats(lines: string[], analysis: LocalAudioAnalysis): AlignedLyricLine[] {
  const beats = analysis.beats.length ? analysis.beats : generateLinearBeats(analysis.duration, lines.length);
  const allocations = beats.slice(0, Math.max(lines.length, beats.length));
  const linesTimed: AlignedLyricLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const start = allocations[i] ?? (analysis.duration / lines.length) * i;
    const end = allocations[i + 1] ?? Math.min(analysis.duration, start + analysis.duration / lines.length);
    linesTimed.push({
      text: lines[i],
      start,
      end,
      confidence: 0.6
    });
  }
  return snapToBeats(linesTimed, analysis);
}

function closestBeat(time: number, beats: number[], searchForward = false): number {
  if (!beats.length) {
    return time;
  }
  if (searchForward) {
    const after = beats.find((beat) => beat >= time);
    return after ?? beats[beats.length - 1];
  }
  let best = beats[0];
  let bestDistance = Math.abs(time - best);
  for (const beat of beats) {
    const distance = Math.abs(time - beat);
    if (distance < bestDistance) {
      best = beat;
      bestDistance = distance;
    }
  }
  return best;
}

function generateLinearBeats(duration: number, count: number): number[] {
  const beats: number[] = [];
  if (count === 0) {
    return beats;
  }
  const spacing = duration / count;
  for (let i = 0; i < count; i++) {
    beats.push(i * spacing);
  }
  return beats;
}

function sanitize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findTokenMatch(words: Array<{ text: string; timestamp: [number, number] }>, token: string, startIndex: number) {
  const clean = sanitize(token);
  for (let i = startIndex; i < words.length; i++) {
    const word = sanitize(words[i].text);
    if (word.includes(clean) || clean.includes(word)) {
      return i;
    }
  }
  return -1;
}

function averageConfidence(words: Array<{ confidence?: number }>): number | null {
  const values = words.map((word) => word.confidence).filter((value): value is number => typeof value === "number");
  if (!values.length) {
    return null;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

