export interface StoredFileSummary {
  path: string;
  size: number;
  originalName: string;
  mimeType: string;
  checksum: string;
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
