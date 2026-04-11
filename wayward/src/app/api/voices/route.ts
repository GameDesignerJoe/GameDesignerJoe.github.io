import { NextResponse } from "next/server";

const CARTESIA_VOICES_URL = "https://api.cartesia.ai/voices";

export async function GET() {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CARTESIA_API_KEY not configured" },
      { status: 500 }
    );
  }

  const response = await fetch(CARTESIA_VOICES_URL, {
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2024-06-10",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: "Cartesia API error", details: error },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
