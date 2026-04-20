import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const base = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const auth = req.headers.get("authorization")?.trim() ?? "";

  if (!auth) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const upstream = await fetch(`${base}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: auth },
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
