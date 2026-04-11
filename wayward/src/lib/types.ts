export interface Companion {
  name: string;
  description: string;
  voiceId: string;
  voiceName: string;
  voicePreview: string;
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

export type Emotion = "neutral" | "calm" | "content" | "excited" | "sad" | "angry" | "scared";

export const VALID_EMOTIONS: Emotion[] = ["neutral", "calm", "content", "excited", "sad", "angry", "scared"];

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
