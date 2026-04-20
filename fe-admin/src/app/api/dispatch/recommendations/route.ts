import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const upstreamUrl = new URL(`${base}/api/dispatch/recommendations`);
  const limit = req.nextUrl.searchParams.get("limit");
  if (limit) upstreamUrl.searchParams.set("limit", limit);

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers: auth ? { Authorization: auth } : {},
    cache: "no-store",
  });

  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    data = { error: text || "Upstream error" };
  }
  return NextResponse.json(data, { status: upstream.status });
}
