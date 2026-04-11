import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { messages, model = "llama-3.3-70b-versatile", max_tokens = 200 } = await req.json();

  // Clamp to safe range
  const tokens = Math.min(Math.max(Number(max_tokens) || 200, 50), 1024);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.9,
      max_tokens: tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: "Groq API error", details: error },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
