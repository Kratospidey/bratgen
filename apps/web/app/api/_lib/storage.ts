import { createHash, randomUUID } from "crypto";
import { mkdir, stat, writeFile } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { StoredFileSummary, StoredUploadSummary } from "@/lib/uploads";
import { uploadRoot } from "@/app/api/_lib/paths";
import { getRecord, listRecords, removeRecord, upsertRecord } from "@/app/api/_lib/datastore";

const s3Bucket = process.env.BRATGEN_S3_BUCKET;
const s3Region = process.env.BRATGEN_S3_REGION ?? "us-east-1";
const s3Endpoint = process.env.BRATGEN_S3_ENDPOINT;
const s3ForcePathStyle = process.env.BRATGEN_S3_FORCE_PATH_STYLE === "true";

const s3Client = s3Bucket
  ? new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      forcePathStyle: s3ForcePathStyle,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
          : undefined
    })
  : null;

async function ensureUploadDir(id: string) {
  await mkdir(path.join(uploadRoot, id), { recursive: true });
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

async function persistFile({
  file,
  uploadId,
  role
}: {
  file: File;
  uploadId: string;
  role: "video" | "audio" | "render";
}): Promise<StoredFileSummary> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const fileId = randomUUID();
  const extension = inferExtension(file);

  if (s3Client && s3Bucket) {
    const key = `${role}s/${uploadId}/${fileId}${extension}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ChecksumSHA256: checksum
      })
    );
    return {
      id: fileId,
      path: `s3://${s3Bucket}/${key}`,
      size: buffer.byteLength,
      originalName: file.name,
      mimeType: file.type,
      checksum,
      storage: "s3",
      bucket: s3Bucket,
      key
    } satisfies StoredFileSummary;
  }

  await ensureUploadDir(uploadId);
  const destination = path.join(uploadRoot, uploadId, `${fileId}${extension}`);
  await writeFile(destination, buffer);
  const stats = await stat(destination);
  return {
    id: fileId,
    path: destination,
    size: stats.size,
    originalName: file.name,
    mimeType: file.type,
    checksum,
    storage: "local"
  } satisfies StoredFileSummary;
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
  const uploadId = randomUUID();
  const storedVideo = await persistFile({ file: video, uploadId, role: "video" });
  const storedAudio = audio ? await persistFile({ file: audio, uploadId, role: "audio" }) : undefined;

  const record: StoredUploadSummary = {
    id: uploadId,
    createdAt: new Date().toISOString(),
    duration,
    files: {
      video: storedVideo,
      ...(storedAudio ? { audio: storedAudio } : {})
    }
  };

  await upsertRecord<StoredUploadSummary>("uploads", record);
  return record;
}

export async function getUpload(id: string): Promise<StoredUploadSummary | null> {
  return getRecord<StoredUploadSummary>("uploads", id);
}

export async function listUploads(): Promise<StoredUploadSummary[]> {
  const uploads = await listRecords<StoredUploadSummary>("uploads");
  return uploads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteUpload(id: string) {
  const upload = await getUpload(id);
  if (!upload) {
    return;
  }
  if (s3Client && s3Bucket) {
    const keys = [upload.files.video, upload.files.audio].filter(Boolean) as StoredFileSummary[];
    await Promise.all(
      keys.map((file) =>
        s3Client.send(
          new DeleteObjectCommand({
            Bucket: file.bucket ?? s3Bucket,
            Key: file.key ?? file.path.replace(`s3://${s3Bucket}/`, "")
          })
        )
      )
    );
  }
  await removeRecord("uploads", id);
}

async function streamFromS3(file: StoredFileSummary): Promise<Readable> {
  if (!s3Client || !file.bucket || !file.key) {
    throw new Error("s3 storage not configured for file");
  }
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: file.bucket,
      Key: file.key
    })
  );
  const body = response.Body;
  if (!body || !(body instanceof Readable || typeof (body as any).transformToWebStream === "function")) {
    throw new Error("unexpected s3 body type");
  }
  if (body instanceof Readable) {
    return body;
  }
  return Readable.fromWeb((body as any).transformToWebStream());
}

export function createFileStream(stored: StoredFileSummary): Readable {
  if (stored.storage === "s3") {
    throw new Error("use createFileStreamAsync for s3 assets");
  }
  return createReadStream(stored.path);
}

export async function createFileStreamAsync(stored: StoredFileSummary): Promise<Readable> {
  if (stored.storage === "s3") {
    return streamFromS3(stored);
  }
  return createReadStream(stored.path);
}

export async function ensureLocalPath(stored: StoredFileSummary): Promise<string> {
  if (stored.storage === "local") {
    return stored.path;
  }
  const tmpDir = path.join(uploadRoot, "tmp");
  await mkdir(tmpDir, { recursive: true });
  const destination = path.join(tmpDir, `${stored.id}-${path.basename(stored.key ?? "blob")}`);
  const stream = await createFileStreamAsync(stored);
  await new Promise<void>((resolve, reject) => {
    const writer = createWriteStream(destination);
    stream.on("error", reject);
    writer.on("error", reject);
    writer.on("finish", () => resolve());
    stream.pipe(writer);
  });
  return destination;
}

export async function registerGeneratedFile({
  absolutePath,
  uploadId,
  originalName,
  mimeType,
  scope
}: {
  absolutePath: string;
  uploadId: string;
  originalName: string;
  mimeType: string;
  scope: "render" | "analysis";
}): Promise<StoredFileSummary> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const reader = createReadStream(absolutePath);
    reader.on("data", (chunk) => hash.update(chunk));
    reader.on("error", reject);
    reader.on("end", () => resolve());
  });

  const fileId = randomUUID();
  const stats = await stat(absolutePath);
  const checksum = hash.digest("hex");

  if (s3Client && s3Bucket) {
    const key = `${scope}s/${uploadId}/${fileId}${path.extname(absolutePath) || ".mp4"}`;
    const body = createReadStream(absolutePath);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ChecksumSHA256: checksum
      })
    );
    return {
      id: fileId,
      path: `s3://${s3Bucket}/${key}`,
      size: stats.size,
      originalName,
      mimeType,
      checksum,
      storage: "s3",
      bucket: s3Bucket,
      key
    } satisfies StoredFileSummary;
  }

  return {
    id: fileId,
    path: absolutePath,
    size: stats.size,
    originalName,
    mimeType,
    checksum,
    storage: "local"
  } satisfies StoredFileSummary;
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
