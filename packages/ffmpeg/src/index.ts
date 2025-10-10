import ffmpeg, { type FilterSpecification } from "fluent-ffmpeg";

export interface MixdownRequest {
  inputVideoPath: string;
  musicPath?: string;
  outputPath: string;
  muteOriginal?: boolean;
  musicGainDb?: number;
  startTime?: number;
  duration?: number;
  duckingDb?: number;
  fadeMs?: number;
  onProgress?: (progress: number) => void;
  musicAutomation?: Array<{ at: number; gainDb: number }>;
}

export function renderPreview({
  inputVideoPath,
  musicPath,
  outputPath,
  muteOriginal = false,
  musicGainDb = 0,
  startTime,
  duration,
  duckingDb = 0,
  fadeMs = 0,
  onProgress,
  musicAutomation
}: MixdownRequest) {
  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg();

    command.addInput(inputVideoPath);

    if (typeof startTime === "number") {
      command.setStartTime(startTime);
    }

    if (typeof duration === "number" && duration > 0) {
      command.setDuration(duration);
    }

    const filters: FilterSpecification[] = [];
    let audioOutput: string | null = null;

    if (musicPath) {
      command.addInput(musicPath);
      let musicInput = "1:a";

      if (musicGainDb !== 0) {
        const musicLabel = "music";
        filters.push({
          filter: "volume",
          options: { volume: `dB(${musicGainDb})` },
          inputs: "1:a",
          outputs: musicLabel
        });
        musicInput = musicLabel;
      }

      if (musicAutomation?.length) {
        const automationExpression = buildAutomationExpression(musicAutomation);
        if (automationExpression) {
          const automationLabel = "music_auto";
          filters.push({
            filter: "volume",
            options: { volume: automationExpression, eval: "frame" },
            inputs: musicInput,
            outputs: automationLabel
          });
          musicInput = automationLabel;
        }
      }

      if (muteOriginal) {
        audioOutput = musicInput;
      } else {
        let primaryInput = "0:a";

        if (duckingDb > 0) {
          const sidechainLabel = "ducked";
          filters.push({
            filter: "sidechaincompress",
            options: {
              level_in: 1,
              level_sc: 1,
              threshold: (-duckingDb).toString(),
              ratio: 6,
              attack: 5,
              release: 100
            },
            inputs: ["0:a", musicInput],
            outputs: sidechainLabel
          });
          primaryInput = sidechainLabel;
        }

        const mixLabel = "mixed";
        filters.push({
          filter: "amix",
          options: { inputs: 2, dropout_transition: 0 },
          inputs: [primaryInput, musicInput],
          outputs: mixLabel
        });
        audioOutput = mixLabel;
      }
    } else if (muteOriginal) {
      command.noAudio();
    }

    if (audioOutput && fadeMs > 0) {
      const fadeLabel = "faded";
      filters.push({
        filter: "afade",
        options: {
          t: "in",
          st: 0,
          d: fadeMs / 1000
        },
        inputs: audioOutput,
        outputs: fadeLabel
      });
      filters.push({
        filter: "afade",
        options: {
          t: "out",
          st: Math.max((duration ?? 0) - fadeMs / 1000, 0),
          d: fadeMs / 1000
        },
        inputs: fadeLabel,
        outputs: "faded_out"
      });
      audioOutput = "faded_out";
    }

    if (filters.length > 0) {
      command.complexFilter(filters);
    }

    const outputOptions = ["-map 0:v"] as string[];

    if (audioOutput) {
      if (audioOutput.includes(":")) {
        outputOptions.push(`-map ${audioOutput}`);
      } else {
        outputOptions.push(`-map [${audioOutput}]`);
      }
    } else if (!muteOriginal && !musicPath) {
      outputOptions.push("-map 0:a");
    }

    command.outputOptions(...outputOptions);
    command.outputOptions("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart");

    if (!muteOriginal || musicPath) {
      command.outputOptions("-c:a", "aac", "-b:a", "192k");
    }

    if (onProgress) {
      command.on("progress", (progress) => {
        if (!progress.timemark) {
          return;
        }
        const seconds = timemarkToSeconds(progress.timemark);
        const total = duration ?? seconds;
        if (total > 0) {
          onProgress(Math.min(1, seconds / total));
        }
      });
    }

    command.output(outputPath).on("end", () => resolve()).on("error", reject).run();
  });
}

function timemarkToSeconds(timemark: string) {
  const parts = timemark.split(":").map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }
  return Number(parts[0]) || 0;
}

export function buildAutomationExpression(points: Array<{ at: number; gainDb: number }>): string | null {
  if (!points.length) {
    return null;
  }
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.gainDb))
    .sort((a, b) => a.at - b.at)
    .reduce<Array<{ at: number; gainDb: number }>>((acc, point) => {
      const last = acc[acc.length - 1];
      if (!last || Math.abs(point.at - last.at) >= 1e-3) {
        acc.push({ at: point.at, gainDb: point.gainDb });
      }
      return acc;
    }, []);
  if (!sorted.length) {
    return null;
  }
  const gain = (db: number) => Math.pow(10, db / 20);
  const segments: Array<{ end: number; expression: string }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const delta = next.at - current.at;
    if (delta <= 0) {
      continue;
    }
    const startGain = gain(current.gainDb);
    const endGain = gain(next.gainDb);
    const slope = (endGain - startGain) / delta;
    const expr = `${startGain.toFixed(6)}+(${slope.toFixed(6)})*(t-${current.at.toFixed(3)})`;
    segments.push({ end: next.at, expression: expr });
  }
  let expression = `${gain(sorted[sorted.length - 1].gainDb).toFixed(6)}`;
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    expression = `if(lt(t,${segment.end.toFixed(3)}),${segment.expression},${expression})`;
  }
  const startGain = gain(sorted[0].gainDb).toFixed(6);
  expression = `if(lt(t,${sorted[0].at.toFixed(3)}),${startGain},${expression})`;
  return expression;
}
