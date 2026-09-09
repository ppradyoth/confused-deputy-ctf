import { NextRequest, NextResponse } from "next/server";
import { evaluateLevel1 } from "@/lib/levels/level1";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const ticketId = typeof body.ticketId === "string" && body.ticketId.trim() ? body.ticketId : "1042";
  const result = evaluateLevel1({ message: body.message, ticketId });

  return NextResponse.json(result);
}
