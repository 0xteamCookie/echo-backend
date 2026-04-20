import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const base = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const upstream = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
