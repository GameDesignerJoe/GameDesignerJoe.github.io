export interface Companion {
  name: string;
  description: string;
  voiceId: string;
  voiceName: string;
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

export interface Section {
  type: "narrative" | "dialogue";
  text: string;
}

export interface ParsedResponse {
  sections: Section[];
  emotion: Emotion;
}

export type InputMode = "say" | "do" | "direct";

export interface Exchange {
  playerInput: string | null;
  playerMode: InputMode | null;
  sections: Section[];
  emotion: Emotion;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}
