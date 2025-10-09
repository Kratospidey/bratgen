import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import type { StoredFileSummary, StoredUploadSummary } from "@/lib/uploads";

const projectRoot = path.resolve(process.cwd(), "..", "..");
const storageRoot = process.env.BRATGEN_STORAGE ?? path.join(projectRoot, "storage");
const uploadRoot = path.join(storageRoot, "uploads");

async function ensureUploadDir(id: string) {
  await mkdir(path.join(uploadRoot, id), { recursive: true });
}

async function persistFile(file: File, destination: string): Promise<StoredFileSummary> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  await writeFile(destination, buffer);
  const stats = await stat(destination);
  return {
    path: destination,
    size: stats.size,
    originalName: file.name,
    mimeType: file.type,
    checksum: hash
  };
}

export async function createUpload({
  video,
  audio,
  duration
}: {
  video: File;
  audio?: File | null;
  duration: number;
}): Promise<StoredUploadSummary> {
  const id = randomUUID();
  await ensureUploadDir(id);
  const uploadDir = path.join(uploadRoot, id);

  const videoExtension = inferExtension(video);
  const videoDestination = path.join(uploadDir, `video${videoExtension}`);
  const storedVideo = await persistFile(video, videoDestination);

  let storedAudio: StoredFileSummary | undefined;
  if (audio) {
    const audioExtension = inferExtension(audio);
    const audioDestination = path.join(uploadDir, `audio${audioExtension}`);
    storedAudio = await persistFile(audio, audioDestination);
  }

  const record: StoredUploadSummary = {
    id,
    createdAt: new Date().toISOString(),
    duration,
    files: {
      video: storedVideo,
      ...(storedAudio ? { audio: storedAudio } : {})
    }
  };

  await writeFile(path.join(uploadDir, "meta.json"), JSON.stringify(record, null, 2));
  return record;
}

export async function getUpload(id: string): Promise<StoredUploadSummary | null> {
  try {
    const metaPath = path.join(uploadRoot, id, "meta.json");
    const raw = await readFile(metaPath, "utf-8");
    return JSON.parse(raw) as StoredUploadSummary;
  } catch (error) {
    return null;
  }
}

export async function listUploads(): Promise<StoredUploadSummary[]> {
  try {
      const directories = await readdir(uploadRoot);
      const uploads: StoredUploadSummary[] = [];
    for (const entry of directories) {
      const maybeUpload = await getUpload(entry);
      if (maybeUpload) {
        uploads.push(maybeUpload);
      }
    }
    return uploads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    return [];
  }
}

export function createFileStream(stored: StoredFileSummary): Readable {
  return createReadStream(stored.path);
}

function inferExtension(file: File) {
  const fromName = path.extname(file.name);
  if (fromName) {
    return fromName;
  }
  if (file.type === "video/mp4") return ".mp4";
  if (file.type === "video/quicktime") return ".mov";
  if (file.type === "audio/mpeg") return ".mp3";
  if (file.type === "audio/wav") return ".wav";
  if (file.type === "audio/x-m4a") return ".m4a";
  return "";
}

export function notFoundResponse(message: string): NextResponse {
  return NextResponse.json({ message }, { status: 404 });
}

export function badRequestResponse(message: string): NextResponse {
  return NextResponse.json({ message }, { status: 400 });
}

export function serverErrorResponse(message: string): NextResponse {
  return NextResponse.json({ message }, { status: 500 });
}
