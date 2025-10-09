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
