import { NextResponse } from "next/server";
import { createFileStreamAsync, getUpload, notFoundResponse } from "@/app/api/_lib/storage";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string; file: string } }) {
  const upload = await getUpload(params.id);
  if (!upload) {
    return notFoundResponse("upload not found");
  }

  const stored = params.file === "video" ? upload.files.video : upload.files.audio;
  if (!stored) {
    return notFoundResponse("file not found");
  }

  const nodeStream = await createFileStreamAsync(stored);
  const body = Readable.toWeb(nodeStream) as unknown as BodyInit;
  return new NextResponse(body, {
    headers: {
      "content-type": stored.mimeType,
      "content-length": stored.size.toString(),
      "x-checksum-sha256": stored.checksum
    }
  });
}
