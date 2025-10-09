import ffmpeg from "fluent-ffmpeg";

export interface MixdownRequest {
  inputVideoPath: string;
  musicPath?: string;
  outputPath: string;
  muteOriginal?: boolean;
  musicGainDb?: number;
}

export function renderPreview({
  inputVideoPath,
  musicPath,
  outputPath,
  muteOriginal = false,
  musicGainDb = 0
}: MixdownRequest) {
  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg();

    command.addInput(inputVideoPath);

    if (muteOriginal) {
      command.audioFilters("volume=0");
    }

    if (musicPath) {
      command.addInput(musicPath);
      if (musicGainDb !== 0) {
        command.complexFilter([
          {
            filter: "volume",
            options: { volume: `dB(${musicGainDb})` },
            inputs: "1:a",
            outputs: "music"
          },
          {
            filter: "amix",
            options: { inputs: 2, dropout_transition: 0 },
            inputs: ["0:a", "music"],
            outputs: "mixed"
          }
        ]);
      } else {
        command.complexFilter([
          {
            filter: "amix",
            options: { inputs: 2, dropout_transition: 0 },
            inputs: ["0:a", "1:a"],
            outputs: "mixed"
          }
        ]);
      }
      command.outputOptions("-map 0:v", "-map [mixed]");
    }

    command.output(outputPath).on("end", () => resolve()).on("error", reject).run();
  });
}
