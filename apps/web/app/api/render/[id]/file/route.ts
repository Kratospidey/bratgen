import { NextResponse } from "next/server";
import { createFileStreamAsync } from "@/app/api/_lib/storage";
import { getRenderJobManifest } from "@/app/api/_lib/renders";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const manifest = await getRenderJobManifest(params.id);
  if (!manifest || !manifest.output) {
    return NextResponse.json({ message: "render not found" }, { status: 404 });
  }

  const nodeStream = await createFileStreamAsync(manifest.output);
  const stream = Readable.toWeb(nodeStream) as unknown as BodyInit;
  return new NextResponse(stream, {
    headers: {
      "content-type": manifest.output.mimeType,
      "content-length": manifest.output.size.toString(),
      "x-checksum-sha256": manifest.output.checksum
    }
  });
}
