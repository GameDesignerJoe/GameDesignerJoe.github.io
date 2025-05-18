import { DocumentType } from '../shared/types';

interface DocumentPrompt {
  welcomeMessage: string;
  placeholderText: string;
}

const DOCUMENT_PROMPTS: Record<DocumentType, DocumentPrompt> = {
  [DocumentType.GameVision]: {
    welcomeMessage: "Let's define your game vision. Why don't you tell me about your game?",
    placeholderText: "Write whatever feels natural - paragraphs, bullets, catch phrases, etc."
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

  static async startDocumentCreation(type: DocumentType): Promise<void> {
    const prompt = this.getPromptForDocument(type);
    if (!prompt) {
      console.error(`No prompt found for document type: ${type}`);
      return;
    }

    // Wait a moment for the UI to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Try to find the welcome message by its unique characteristics
    const welcomeElement = Array.from(document.querySelectorAll('*')).find(element => {
      const text = element.textContent || '';
      return text.includes('Happy') && text.includes('Joe') && text.length < 50;
    }) as HTMLElement;

    if (welcomeElement) {
      // Store the original styles
      const styles = window.getComputedStyle(welcomeElement);
      const originalColor = styles.color;
      const originalFont = styles.font;
      const originalSize = styles.fontSize;

      // Update text while preserving styling
      welcomeElement.innerHTML = `<span style="color: ${originalColor}; font: ${originalFont}; font-size: ${originalSize};">${prompt.welcomeMessage}</span>`;
    } else {
      console.error('Could not find welcome message element');
    }
  }
}
