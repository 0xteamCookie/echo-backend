import { NextRequest, NextResponse } from "next/server";

function backendBase(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function authHeaders(req: NextRequest): HeadersInit {
  const auth = req.headers.get("authorization")?.trim();
  return auth ? { Authorization: auth } : {};
}

export async function GET(req: NextRequest) {
  const upstreamUrl = new URL(`${backendBase()}/api/announcement`);
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("long") ?? req.nextUrl.searchParams.get("lon");
  const limit = req.nextUrl.searchParams.get("limit");

  if (lat) upstreamUrl.searchParams.set("lat", lat);
  if (lon) upstreamUrl.searchParams.set("long", lon);
  if (limit) upstreamUrl.searchParams.set("limit", limit);

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers: authHeaders(req),
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

export async function POST(req: NextRequest) {
  const upstreamUrl = `${backendBase()}/api/announcement`;
  const body = await req.text();
  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(req),
    },
    body,
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
