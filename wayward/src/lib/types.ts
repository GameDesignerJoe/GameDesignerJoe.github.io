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
  openingHook: string;
  aiInstructions: string;
  companion: Companion;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ParsedResponse {
  narrator: string | null;
  companion: string | null;
}

export type InputMode = "say" | "do" | "direct";

export interface Exchange {
  playerInput: string | null;
  playerMode: InputMode | null;
  narrator: string | null;
  companion: string | null;
}

export interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  is_public: boolean;
}
