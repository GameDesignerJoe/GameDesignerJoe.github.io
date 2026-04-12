import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const response = await fetch(
    "https://api.elevenlabs.io/v1/user/subscription",
    {
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: "ElevenLabs API error", details: error },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json({
    character_count: data.character_count,
    character_limit: data.character_limit,
    next_character_count_reset_unix: data.next_character_count_reset_unix,
  });
}
