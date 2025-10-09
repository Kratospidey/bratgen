import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { stat } from "fs/promises";
import { parseFile } from "music-metadata";
import type { SegmentCandidate } from "@bratgen/analysis";
import type { StoredUploadSummary } from "@/lib/uploads";
import { ensureLocalPath } from "@/app/api/_lib/storage";
import { getRecord, upsertRecord } from "@/app/api/_lib/datastore";

export interface LocalAudioAnalysis {
  id: string;
  uploadId: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  sampleRate: number;
  waveform: number[];
  beats: number[];
  tempo: number;
  energy: number;
  chroma: number[];
  segments: SegmentCandidate[];
}

const TABLE = "audio_analysis";

export async function getCachedAnalysis(uploadId: string): Promise<LocalAudioAnalysis | null> {
  return getRecord<LocalAudioAnalysis>(TABLE, uploadId);
}

export async function analyzeUploadAudio(upload: StoredUploadSummary, targetDuration: number): Promise<LocalAudioAnalysis> {
  const cached = await getCachedAnalysis(upload.id);
  if (cached) {
    return cached;
  }
  const source = upload.files.audio ?? upload.files.video;
  if (!source) {
    throw new Error("upload missing media files");
  }
  const localPath = await ensureLocalPath(source);
  const { duration, sampleRate } = await probeFileMetadata(localPath);
  const pcm = await decodePcm(localPath);
  const waveform = buildWaveform(pcm.samples, pcm.sampleRate, Math.min(720, Math.ceil(duration * 12)));
  const beats = detectBeats(pcm.samples, pcm.sampleRate, duration);
  const tempo = estimateTempo(beats);
  const energy = computeEnergy(waveform);
  const chroma = estimateChroma(pcm.samples, pcm.sampleRate);
  const segments = scoreSegments({
    waveform,
    beats,
    duration,
    targetDuration
  });

  const analysis: LocalAudioAnalysis = {
    id: randomUUID(),
    uploadId: upload.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration,
    sampleRate: pcm.sampleRate,
    waveform,
    beats,
    tempo,
    energy,
    chroma,
    segments
  };

  await upsertRecord(TABLE, analysis);
  return analysis;
}

async function probeFileMetadata(filePath: string): Promise<{ duration: number; sampleRate: number }> {
  try {
    const meta = await parseFile(filePath);
    return {
      duration: meta.format.duration ?? (await stat(filePath)).size / (meta.format.bitrate ?? 128000) * 8,
      sampleRate: meta.format.sampleRate ?? 44100
    };
  } catch (error) {
    return { duration: 30, sampleRate: 44100 };
  }
}

async function decodePcm(filePath: string, targetSampleRate = 16000): Promise<{ samples: Float32Array; sampleRate: number }> {
  const args = [
    "-hide_banner",
    "-i",
    filePath,
    "-ac",
    "1",
    "-ar",
    String(targetSampleRate),
    "-f",
    "f32le",
    "pipe:1"
  ];
  const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "inherit"] });
  const chunks: Buffer[] = [];
  child.stdout?.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
  const buffer = Buffer.concat(chunks);
  const sampleCount = buffer.length / 4;
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buffer.readFloatLE(i * 4);
  }
  return { samples, sampleRate: targetSampleRate };
}

function buildWaveform(samples: Float32Array, sampleRate: number, bins: number): number[] {
  const total = samples.length;
  const binSize = Math.max(1, Math.floor(total / bins));
  const waveform: number[] = [];
  for (let i = 0; i < bins; i++) {
    const start = i * binSize;
    const end = Math.min(total, start + binSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const value = Math.abs(samples[j]);
      if (value > peak) {
        peak = value;
      }
    }
    waveform.push(Math.min(1, peak));
  }
  return waveform;
}

function detectBeats(samples: Float32Array, sampleRate: number, duration: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.5);
  const beats: number[] = [];
  let lastPeak = 0;
  for (let offset = 0; offset < samples.length; offset += windowSize) {
    let sum = 0;
    const end = Math.min(samples.length, offset + windowSize);
    for (let i = offset; i < end; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / (end - offset || 1));
    const normalized = rms;
    const time = offset / sampleRate;
    if (normalized > 0.2 && time - lastPeak > 0.3) {
      beats.push(time);
      lastPeak = time;
    }
  }
  if (!beats.length) {
    const spacing = 60 / 120; // default 120bpm
    for (let t = 0; t < duration; t += spacing) {
      beats.push(t);
    }
  }
  return beats;
}

function estimateTempo(beats: number[]): number {
  if (beats.length < 2) {
    return 120;
  }
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i] - beats[i - 1]);
  }
  const average = intervals.reduce((acc, value) => acc + value, 0) / intervals.length;
  return Math.round(60 / Math.max(average, 0.01));
}

function computeEnergy(waveform: number[]): number {
  const sum = waveform.reduce((acc, value) => acc + value, 0);
  return waveform.length ? sum / waveform.length : 0;
}

function estimateChroma(samples: Float32Array, sampleRate: number): number[] {
  const bins = 12;
  const chroma = new Array(bins).fill(0);
  const window = Math.floor(sampleRate / bins);
  for (let i = 0; i < samples.length; i++) {
    const bucket = Math.floor((i % (window * bins)) / window);
    chroma[bucket] += Math.abs(samples[i]);
  }
  const max = Math.max(...chroma, 1);
  return chroma.map((value) => value / max);
}

function scoreSegments({
  waveform,
  beats,
  duration,
  targetDuration
}: {
  waveform: number[];
  beats: number[];
  duration: number;
  targetDuration: number;
}): SegmentCandidate[] {
  const totalSamples = waveform.length;
  const secondsPerBin = duration / totalSamples;
  const windowBins = Math.max(1, Math.round(targetDuration / secondsPerBin));
  const scores: SegmentCandidate[] = [];
  for (let startBin = 0; startBin + windowBins < totalSamples; startBin += Math.max(1, Math.floor(windowBins / 4))) {
    const endBin = startBin + windowBins;
    let sum = 0;
    let loudPeak = 0;
    for (let i = startBin; i < endBin && i < waveform.length; i++) {
      const value = waveform[i];
      sum += value;
      if (value > loudPeak) {
        loudPeak = value;
      }
    }
    const startTime = startBin * secondsPerBin;
    const endTime = Math.min(duration, endBin * secondsPerBin);
    const beatSupport = beats.filter((beat) => beat >= startTime && beat <= endTime).length / (targetDuration / 0.5);
    scores.push({
      start: startTime,
      end: endTime,
      energy: sum / windowBins,
      loudness: -6 + loudPeak * -12,
      confidence: Math.min(1, beatSupport)
    });
  }
  return scores
    .sort((a, b) => b.energy + b.confidence - (a.energy + a.confidence))
    .slice(0, 8);
}
