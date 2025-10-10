import { NextResponse } from "next/server";
import { getRenderJob } from "@/app/api/_lib/render-queue";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const job = await getRenderJob(params.id);
  if (!job) {
    return NextResponse.json({ message: "job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
