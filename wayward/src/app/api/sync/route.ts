import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

function blobKey(code: string): string {
  // Normalize and hash the sync code into a safe filename
  const normalized = code.trim().toLowerCase();
  return `wayward-sync/${normalized}.json`;
}

/**
 * GET /api/sync?code=xxx — download scenarios for a sync code
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing sync code" }, { status: 400 });
  }

  const key = blobKey(code);

  try {
    // List blobs to find our file
    const { blobs } = await list({ prefix: key });
    if (blobs.length === 0) {
      return NextResponse.json({ scenarios: null });
    }

    // Fetch the blob content
    const blobUrl = blobs[0].url;
    const res = await fetch(blobUrl);
    if (!res.ok) {
      return NextResponse.json({ scenarios: null });
    }

    const data = await res.json();
    return NextResponse.json({ scenarios: data.scenarios ?? null });
  } catch {
    return NextResponse.json(
      { error: "Failed to read from cloud storage" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sync — upload scenarios for a sync code
 * Body: { code: string, scenarios: Scenario[] }
 */
export async function PUT(req: NextRequest) {
  try {
    const { code, scenarios } = await req.json();
    if (!code || !Array.isArray(scenarios)) {
      return NextResponse.json(
        { error: "Missing code or scenarios" },
        { status: 400 }
      );
    }

    const key = blobKey(code);
    const content = JSON.stringify({ scenarios, updatedAt: new Date().toISOString() });

    await put(key, content, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to write to cloud storage", details: String(e) },
      { status: 500 }
    );
  }
}
