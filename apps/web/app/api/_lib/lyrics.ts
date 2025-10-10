import { createHash, randomUUID } from "crypto";
import type { StoredUploadSummary } from "@/lib/uploads";
import { analyzeUploadAudio, type LocalAudioAnalysis } from "@/app/api/_lib/analysis";
import { ensureLocalPath } from "@/app/api/_lib/storage";
import { getRecord, upsertRecord } from "@/app/api/_lib/datastore";

export interface AlignedLyricLine {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AlignedLyricWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AlignmentResult {
  lines: AlignedLyricLine[];
  duration: number;
  model: "beats" | "whisper";
  words: AlignedLyricWord[];
}

interface LyricTranscriptRecord {
  id: string;
  uploadId: string;
  lyricsHash: string;
  createdAt: string;
  updatedAt: string;
  model: "beats" | "whisper";
  duration: number;
  sourceChecksum: string | null;
  lines: AlignedLyricLine[];
  words: AlignedLyricWord[];
}

const TRANSCRIPT_TABLE = "lyric_transcripts";

const whisperCacheTtlSeconds = Number(process.env.BRATGEN_WHISPER_CACHE_TTL ?? 86400);

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
  const checksum = upload.files.audio?.checksum ?? upload.files.video.checksum;
  const lyricsHash = hashLyrics(lyrics);

  const cached = await getCachedTranscript({
    uploadId: upload.id,
    lyricsHash,
    sourceChecksum: checksum
  });
  if (cached) {
    return cached;
  }

  if (!lines.length) {
    const empty: AlignmentResult = {
      lines: [],
      words: [],
      duration: analysis.duration,
      model: whisper ? "whisper" : "beats"
    };
    await cacheTranscript({
      uploadId: upload.id,
      lyricsHash,
      sourceChecksum: checksum ?? null,
      result: empty
    });
    return empty;
  }

  if (whisper) {
    try {
      const whisperResult = await alignWithWhisper(whisper, upload, lines, analysis);
      if (whisperResult) {
        const snapped = snapToBeats(whisperResult.lines, whisperResult.words, analysis);
        const result: AlignmentResult = {
          lines: snapped.lines,
          words: snapped.words,
          duration: analysis.duration,
          model: "whisper"
        };
        await cacheTranscript({
          uploadId: upload.id,
          lyricsHash,
          sourceChecksum: checksum ?? null,
          result
        });
        return result;
      }
    } catch (error) {
      console.warn("whisper alignment failed", error);
    }
  }

  const beatAligned = alignWithBeats(lines, analysis);
  const snapped = snapToBeats(beatAligned.lines, beatAligned.words, analysis);
  const result: AlignmentResult = {
    lines: snapped.lines,
    words: snapped.words,
    duration: analysis.duration,
    model: "beats"
  };
  await cacheTranscript({
    uploadId: upload.id,
    lyricsHash,
    sourceChecksum: checksum ?? null,
    result
  });
  return result;
}

interface WordWithLine extends AlignedLyricWord {
  lineIndex: number;
}

async function alignWithWhisper(
  pipeline: any,
  upload: StoredUploadSummary,
  lines: string[],
  analysis: LocalAudioAnalysis
): Promise<{ lines: AlignedLyricLine[]; words: WordWithLine[] } | null> {
  const source = upload.files.audio ?? upload.files.video;
  if (!source) {
    return null;
  }
  const localPath = await ensureLocalPath(source);
  const result = await pipeline(localPath, {
    chunk_length_s: 30,
    return_timestamps: "word"
  });
  const rawWords = (result.chunks ?? []) as Array<{ text: string; timestamp: [number, number]; confidence?: number }>;
  if (!rawWords.length) {
    return null;
  }

  const linesTimed: AlignedLyricLine[] = [];
  const wordsTimed: WordWithLine[] = [];
  let cursor = 0;

  const normalizedWords = rawWords.map((word) => ({
    original: word.text.trim(),
    normalized: sanitize(word.text).trim(),
    start: word.timestamp?.[0] ?? 0,
    end: word.timestamp?.[1] ?? (word.timestamp?.[0] ?? 0),
    confidence: word.confidence ?? 0.75
  }));

  for (const line of lines) {
    const tokens = sanitize(line).split(" ").filter(Boolean);
    if (!tokens.length) {
      continue;
    }
    const startIndex = findTokenMatch(normalizedWords, tokens[0], cursor);
    const endIndex = findTokenMatch(normalizedWords, tokens[tokens.length - 1], startIndex);
    const startTime = startIndex >= 0 ? normalizedWords[startIndex].start : analysis.beats[cursor] ?? 0;
    const endTime = endIndex >= 0 ? normalizedWords[endIndex].end : startTime + Math.max(1, tokens.length * 0.4);
    cursor = Math.max(0, endIndex >= 0 ? endIndex + 1 : startIndex + 1);
    const confidence = averageConfidence(normalizedWords.slice(Math.max(0, startIndex), Math.max(startIndex + 1, endIndex + 1)));
    linesTimed.push({
      text: line,
      start: Math.max(0, startTime),
      end: Math.min(analysis.duration, Math.max(startTime + 0.25, endTime)),
      confidence: confidence ?? 0.75
    });

    if (startIndex >= 0) {
      const wordSlice = normalizedWords.slice(Math.max(0, startIndex), Math.max(startIndex + 1, endIndex + 1));
      wordSlice.forEach((word, index) => {
        const original = rawWords[Math.max(0, startIndex) + index];
        wordsTimed.push({
          text: original?.text?.trim() ?? word.normalized,
          start: Math.max(0, word.start),
          end: Math.max(0, word.end),
          confidence: word.confidence,
          lineIndex: linesTimed.length - 1
        });
      });
    }
  }

  if (!wordsTimed.length) {
    normalizedWords.forEach((word) => {
      wordsTimed.push({
        text: word.original,
        start: word.start,
        end: word.end,
        confidence: word.confidence,
        lineIndex: 0
      });
    });
  }

  return { lines: linesTimed, words: wordsTimed };
}

function snapToBeats(
  lines: AlignedLyricLine[],
  words: WordWithLine[],
  analysis: LocalAudioAnalysis
): { lines: AlignedLyricLine[]; words: AlignedLyricWord[] } {
  if (!analysis.beats.length) {
    return { lines, words: words.map(({ lineIndex, ...rest }) => rest) };
  }
  const snappedLines = lines.map((line) => {
    const beatStart = closestBeat(line.start, analysis.beats);
    const beatEnd = closestBeat(line.end, analysis.beats, true) ?? beatStart + Math.max(0.5, line.end - line.start);
    return {
      ...line,
      start: beatStart,
      end: Math.min(analysis.duration, beatEnd)
    };
  });

  const snappedWords = words.map((word) => {
    const originalLine = lines[word.lineIndex] ?? lines[0];
    const snappedLine = snappedLines[word.lineIndex] ?? snappedLines[0];
    const originalSpan = Math.max(originalLine.end - originalLine.start, 0.1);
    const snappedSpan = Math.max(snappedLine.end - snappedLine.start, 0.1);
    const relative = (word.start - originalLine.start) / originalSpan;
    const start = snappedLine.start + Math.max(0, Math.min(1, relative)) * snappedSpan;
    const duration = Math.max(0.08, word.end - word.start);
    return {
      text: word.text,
      start,
      end: Math.min(snappedLine.end, start + duration),
      confidence: word.confidence
    } satisfies AlignedLyricWord;
  });

  return { lines: snappedLines, words: snappedWords };
}

function alignWithBeats(
  lines: string[],
  analysis: LocalAudioAnalysis
): { lines: AlignedLyricLine[]; words: WordWithLine[] } {
  const beats = analysis.beats.length ? analysis.beats : generateLinearBeats(analysis.duration, lines.length);
  const allocations = beats.slice(0, Math.max(lines.length, beats.length));
  const linesTimed: AlignedLyricLine[] = [];
  const words: WordWithLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const start = allocations[i] ?? (analysis.duration / lines.length) * i;
    const end = allocations[i + 1] ?? Math.min(analysis.duration, start + analysis.duration / lines.length);
    const line: AlignedLyricLine = {
      text: lines[i],
      start,
      end,
      confidence: 0.6
    };
    linesTimed.push(line);
    const tokens = sanitize(lines[i]).split(" ").filter(Boolean);
    if (!tokens.length) {
      continue;
    }
    const tokenDuration = Math.max((end - start) / tokens.length, 0.2);
    tokens.forEach((token, index) => {
      const tokenStart = start + index * tokenDuration;
      words.push({
        text: token,
        start: tokenStart,
        end: Math.min(end, tokenStart + tokenDuration * 0.9),
        confidence: 0.5,
        lineIndex: i
      });
    });
  }
  return { lines: linesTimed, words };
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

function findTokenMatch(
  words: Array<{ normalized: string }>,
  token: string,
  startIndex: number
) {
  const clean = sanitize(token);
  for (let i = startIndex; i < words.length; i++) {
    const word = words[i].normalized;
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

function hashLyrics(lyrics: string): string {
  return createHash("sha1").update(lyrics).digest("hex");
}

function transcriptId(uploadId: string, lyricsHash: string) {
  return `${uploadId}:${lyricsHash}`;
}

async function getCachedTranscript({
  uploadId,
  lyricsHash,
  sourceChecksum
}: {
  uploadId: string;
  lyricsHash: string;
  sourceChecksum?: string | null;
}): Promise<AlignmentResult | null> {
  const record = await getRecord<LyricTranscriptRecord>(TRANSCRIPT_TABLE, transcriptId(uploadId, lyricsHash));
  if (!record) {
    return null;
  }
  if (record.sourceChecksum && sourceChecksum && record.sourceChecksum !== sourceChecksum) {
    return null;
  }
  if (record.model === "whisper" && whisperCacheTtlSeconds > 0) {
    const ageSeconds = (Date.now() - new Date(record.updatedAt).getTime()) / 1000;
    if (ageSeconds > whisperCacheTtlSeconds) {
      return null;
    }
  }
  return {
    lines: record.lines,
    words: record.words,
    duration: record.duration,
    model: record.model
  } satisfies AlignmentResult;
}

async function cacheTranscript({
  uploadId,
  lyricsHash,
  sourceChecksum,
  result
}: {
  uploadId: string;
  lyricsHash: string;
  sourceChecksum: string | null;
  result: AlignmentResult;
}) {
  const id = transcriptId(uploadId, lyricsHash);
  const existing = await getRecord<LyricTranscriptRecord>(TRANSCRIPT_TABLE, id);
  const now = new Date().toISOString();
  const record: LyricTranscriptRecord = {
    id,
    uploadId,
    lyricsHash,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    model: result.model,
    duration: result.duration,
    sourceChecksum,
    lines: result.lines,
    words: result.words
  };
  await upsertRecord(TRANSCRIPT_TABLE, record);
}

