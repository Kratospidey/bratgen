export interface StoredFileVideoMetadata {
  width?: number;
  height?: number;
  fps?: number;
  thumbnailDataUrl?: string;
}

export interface StoredFileAudioMetadata {
  sampleRate?: number;
  channels?: number;
  loudness?: number;
}

export interface StoredFileMetadata {
  duration?: number;
  bitrate?: number;
  video?: StoredFileVideoMetadata;
  audio?: StoredFileAudioMetadata;
}

export interface StoredFileSummary {
  id: string;
  path: string;
  size: number;
  originalName: string;
  mimeType: string;
  checksum: string;
  storage: "local" | "s3";
  bucket?: string;
  key?: string;
  metadata?: StoredFileMetadata;
}

export interface StoredUploadSummary {
  id: string;
  createdAt: string;
  duration: number;
  files: {
    video: StoredFileSummary;
    audio?: StoredFileSummary;
  };
}
