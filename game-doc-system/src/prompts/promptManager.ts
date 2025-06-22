import { DocumentType } from '../shared/types';
import { ClaudeInterface } from './claudeInterface';

interface DocumentPrompt {
  welcomeMessage: string;
  placeholderText: string;
}

const DOCUMENT_PROMPTS: Record<string, DocumentPrompt> = {
  'game_vision': {
    welcomeMessage: "Hi, I'm here to help you find the vision of your game. Feel free to explain it to me however works best for you. Afterwards, I'll ask you some questions and we'll figure it out together.",
    placeholderText: "Tell me about your game idea..."
  },
  'core_game_concept': {
    welcomeMessage: "Let's outline your core game concept. What's the fundamental gameplay experience?",
    placeholderText: "Describe the core gameplay loop, key mechanics, or main activities"
  },
  'target_audience': {
    welcomeMessage: "Let's identify your target audience. Who are you making this game for?",
    placeholderText: "Consider age groups, interests, gaming experience, platforms they use"
  },
  'core_pillars_values': {
    welcomeMessage: "Let's establish your core pillars and values. What principles guide your game design?",
    placeholderText: "List key values, design pillars, or guiding principles"
  },
  'why_play_it': {
    welcomeMessage: "Let's explore why players will love your game. What makes it compelling?",
    placeholderText: "Think about player motivations, rewards, and satisfaction"
  },
  'what_should_they_feel': {
    welcomeMessage: "Let's define the emotional journey. How should players feel while playing?",
    placeholderText: "Describe emotions, moods, or feelings you want to evoke"
  },
  'unique_selling_points': {
    welcomeMessage: "Let's identify what makes your game unique. What sets it apart?",
    placeholderText: "List unique features, innovations, or special qualities"
  },
  'game_loop': {
    welcomeMessage: "Let's detail your game loop. What keeps players engaged moment to moment?",
    placeholderText: "Describe core activities, feedback loops, and progression"
  },
  'player_journey': {
    welcomeMessage: "Let's map the player's journey. How do they progress through your game?",
    placeholderText: "Outline key stages, milestones, or story beats"
  },
  'story_overview': {
    welcomeMessage: "Let's craft your story overview. What tale does your game tell?",
    placeholderText: "Share plot points, character arcs, or narrative themes"
  },
  'presentation': {
    welcomeMessage: "Let's plan your game's presentation. How will it look and feel?",
    placeholderText: "Describe art style, audio direction, or visual themes"
  },
  'key_questions': {
    welcomeMessage: "Let's address key questions about your game. What needs to be resolved?",
    placeholderText: "List critical questions, concerns, or decisions to make"
  },
  'core_design_details': {
    welcomeMessage: "Let's detail your core design. What are the essential mechanics?",
    placeholderText: "Describe key systems, rules, or gameplay elements"
  },
  'strategic_direction': {
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
      case 'game_vision':
        return `/task You are helping create a Game Vision document. After the user shares their initial idea, ask targeted follow-up questions to gather:
- Game type, player count, and platform
- Core gameplay and player fantasy
- Emotional experience
- Player motivation and rewards
- Three unique elements that set the game apart

Use their language and ideas while ensuring all elements are covered.`;
      default:
        return '';
    }
  }

  static async startDocumentCreation(type: DocumentType): Promise<void> {
    console.log('PromptManager: Starting document creation for type:', type);
    
    const prompt = this.getPromptForDocument(type);
    if (!prompt) {
      console.error(`PromptManager: No prompt found for document type: ${type}`);
      return;
    }
    console.log('PromptManager: Found prompt:', prompt);

    try {
      // Initialize Claude interface
      console.log('PromptManager: Starting Claude interface');
      await ClaudeInterface.startDocumentCreation();
      
      // Wait for UI to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send the system prompt first (silently)
      console.log('PromptManager: Sending system prompt');
      const systemPrompt = this.getSystemPrompt(type);
      await ClaudeInterface.sendMessage(systemPrompt, true);
      
      // Wait for system prompt to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send the welcome message
      console.log('PromptManager: Sending welcome message');
      await ClaudeInterface.sendMessage(prompt.welcomeMessage);
      
      // Set up event listener for user input
      const input = document.querySelector('.claude-input, [contenteditable="true"]') as HTMLElement;
      if (input) {
        input.addEventListener('keydown', async (event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const userInput = input instanceof HTMLTextAreaElement ? 
              input.value : 
              input.textContent || '';
            
            if (userInput.trim()) {
              await ClaudeInterface.handleUserInput(userInput);
            }
          }
        });
      }

      console.log('PromptManager: Document creation setup completed');
    } catch (error) {
      console.error('PromptManager: Error during document creation:', error);
      throw error;
    }
  }
}
