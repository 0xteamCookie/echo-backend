import { NextResponse } from "next/server";

/**
 * Proxies to the Echo backend so `ADMIN_API_KEY` stays server-side only.
 * Configure `BACKEND_URL` and `ADMIN_API_KEY` in `.env.local`.
 */
export async function POST(req: Request) {
  const key = process.env.ADMIN_API_KEY?.trim();
  const base = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const auth = req.headers.get("authorization")?.trim() ?? "";

  if (!key) {
    return NextResponse.json(
      { error: "ADMIN_API_KEY is not configured on the admin app (set it in fe-admin/.env.local)" },
      { status: 503 },
    );
  }
  if (!auth) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const upstream = await fetch(`${base}/api/provision/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": key,
      Authorization: auth,
    },
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
