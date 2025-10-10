import { NextResponse } from "next/server";
import { getUpload, notFoundResponse } from "@/app/api/_lib/storage";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const upload = await getUpload(params.id);
  if (!upload) {
    return notFoundResponse("upload not found");
  }
  return NextResponse.json({ upload });
}
