export type AudioProvider = "cartesia" | "elevenlabs";

export interface Companion {
  name: string;
  description: string;
  // Legacy fields (kept for backward compat with existing localStorage data)
  voiceId: string;
  voiceName: string;
  voicePreview: string;
  // Dual provider voice slots
  cartesiaVoiceId: string;
  cartesiaVoiceName: string;
  elevenLabsVoiceId: string;
  elevenLabsVoiceName: string;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  scenario: string;
  openingHook: string;
  playerCharacter: string;
  aiInstructions: string;
  companion: Companion;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type Emotion = "neutral";

export interface ParsedResponse {
  narrator: string | null;
  companion: string | null;
  emotion: Emotion;
}

export type InputMode = "say" | "do" | "direct";

export interface Exchange {
  playerInput: string | null;
  playerMode: InputMode | null;
  narrator: string | null;
  companion: string | null;
  emotion: Emotion;
}

export interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  is_public: boolean;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}
