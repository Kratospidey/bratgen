import ffmpeg, { type FilterSpecification } from "fluent-ffmpeg";

export interface MixdownRequest {
  inputVideoPath: string;
  musicPath?: string;
  outputPath: string;
  muteOriginal?: boolean;
  musicGainDb?: number;
  startTime?: number;
  duration?: number;
}

export function renderPreview({
  inputVideoPath,
  musicPath,
  outputPath,
  muteOriginal = false,
  musicGainDb = 0,
  startTime,
  duration
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

      if (muteOriginal) {
        audioOutput = musicInput;
      } else {
        const mixLabel = "mixed";
        filters.push({
          filter: "amix",
          options: { inputs: 2, dropout_transition: 0 },
          inputs: ["0:a", musicInput],
          outputs: mixLabel
        });
        audioOutput = mixLabel;
      }
    } else if (muteOriginal) {
      command.noAudio();
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

    command.output(outputPath).on("end", () => resolve()).on("error", reject).run();
  });
}
