import { DocumentType } from '../shared/types';
import { ClaudeInterface } from './claudeInterface';

interface DocumentPrompt {
  welcomeMessage: string;
  placeholderText: string;
}

const DOCUMENT_PROMPTS: Record<DocumentType, DocumentPrompt> = {
  [DocumentType.GameVision]: {
    welcomeMessage: "Let's explore your game vision. Tell me about your game - what excites you most about it?",
    placeholderText: "Share your thoughts freely - I'll ask questions to help develop the vision"
  },
  [DocumentType.CoreGameConcept]: {
    welcomeMessage: "Let's outline your core game concept. What's the fundamental gameplay experience?",
    placeholderText: "Describe the core gameplay loop, key mechanics, or main activities"
  },
  [DocumentType.TargetAudience]: {
    welcomeMessage: "Let's identify your target audience. Who are you making this game for?",
    placeholderText: "Consider age groups, interests, gaming experience, platforms they use"
  },
  [DocumentType.CorePillarsValues]: {
    welcomeMessage: "Let's establish your core pillars and values. What principles guide your game design?",
    placeholderText: "List key values, design pillars, or guiding principles"
  },
  [DocumentType.WhyPlayIt]: {
    welcomeMessage: "Let's explore why players will love your game. What makes it compelling?",
    placeholderText: "Think about player motivations, rewards, and satisfaction"
  },
  [DocumentType.WhatShouldTheyFeel]: {
    welcomeMessage: "Let's define the emotional journey. How should players feel while playing?",
    placeholderText: "Describe emotions, moods, or feelings you want to evoke"
  },
  [DocumentType.UniqueSellingPoints]: {
    welcomeMessage: "Let's identify what makes your game unique. What sets it apart?",
    placeholderText: "List unique features, innovations, or special qualities"
  },
  [DocumentType.GameLoop]: {
    welcomeMessage: "Let's detail your game loop. What keeps players engaged moment to moment?",
    placeholderText: "Describe core activities, feedback loops, and progression"
  },
  [DocumentType.PlayerJourney]: {
    welcomeMessage: "Let's map the player's journey. How do they progress through your game?",
    placeholderText: "Outline key stages, milestones, or story beats"
  },
  [DocumentType.StoryOverview]: {
    welcomeMessage: "Let's craft your story overview. What tale does your game tell?",
    placeholderText: "Share plot points, character arcs, or narrative themes"
  },
  [DocumentType.Presentation]: {
    welcomeMessage: "Let's plan your game's presentation. How will it look and feel?",
    placeholderText: "Describe art style, audio direction, or visual themes"
  },
  [DocumentType.KeyQuestions]: {
    welcomeMessage: "Let's address key questions about your game. What needs to be resolved?",
    placeholderText: "List critical questions, concerns, or decisions to make"
  },
  [DocumentType.CoreDesignDetails]: {
    welcomeMessage: "Let's detail your core design. What are the essential mechanics?",
    placeholderText: "Describe key systems, rules, or gameplay elements"
  },
  [DocumentType.StrategicDirection]: {
    welcomeMessage: "Let's plan your strategic direction. Where is this game headed?",
    placeholderText: "Outline goals, milestones, or development priorities"
  }
};

export class PromptManager {
  static getPromptForDocument(type: DocumentType): DocumentPrompt | null {
    return DOCUMENT_PROMPTS[type] || null;
  }

  private static getSystemPrompt(type: DocumentType): string {
    switch (type) {
      case DocumentType.GameVision:
        return `You are helping create a Game Vision document. Let the user express their ideas freely, but ensure you gather enough information to create a vision that includes:
- Game title
- Single inspirational line description
- A focused paragraph that covers:
  - Game type, player count, and platform
  - Core gameplay and player fantasy
  - Emotional experience
  - Player motivation and rewards
  - Unique elements and vision summary

Start with an open-ended question about their vision. Based on their response, generate contextual follow-up questions to fill in any missing elements. Use their own language and ideas while guiding the conversation toward a complete vision.`;
      default:
        return '';
    }
  }

  static async startDocumentCreation(type: DocumentType): Promise<void> {
    const prompt = this.getPromptForDocument(type);
    if (!prompt) {
      console.error(`No prompt found for document type: ${type}`);
      return;
    }

    // Get the system prompt for this document type
    const systemPrompt = this.getSystemPrompt(type);
    if (!systemPrompt) {
      console.error(`No system prompt found for document type: ${type}`);
      return;
    }

    try {
      // Start the document creation process using Claude interface
      await ClaudeInterface.startDocumentCreation(systemPrompt);
    } catch (error) {
      console.error('Error during document creation:', error);
      throw error;
    }
  }
}
