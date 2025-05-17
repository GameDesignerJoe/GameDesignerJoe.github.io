import { DocumentType } from '../shared/types';

interface PromptTemplate {
  systemPrompt: string;
  initialPrompt: string;
  followUpPrompts: {
    groupDynamics: string;
    worldAndChallenges: string;
    progressionAndGrowth: string;
    storyAndNarrative: string;
    uniqueFeatures: string;
  };
}

const GAME_VISION_PROMPT: PromptTemplate = {
  systemPrompt: `You are a game design document assistant specializing in creating clear, compelling Game Vision documents. Your role is to help developers articulate their game's core concept through natural conversation, asking follow-up questions based on their responses and guiding them to explore all important aspects of their vision.`,
  
  initialPrompt: `Hi, I'm here to help you define your game. Why don't you tell me what you envision when you think about it? Share whatever comes to mind about the experience you want to create.`,
  
  followUpPrompts: {
    groupDynamics: `That's an interesting concept! Let's explore the group dynamics you mentioned. What kind of shared experiences do you want players to have together? How will they work as a team?`,
    
    worldAndChallenges: `I see how that would create engaging player interactions. Now tell me about the world they'll be exploring. What makes it compelling and what kinds of challenges will they face?`,
    
    progressionAndGrowth: `The world sounds fascinating! How will players grow and develop as they explore it? What systems or mechanics will drive their progression?`,
    
    storyAndNarrative: `That's a great progression system. How will the story unfold as players advance? What narrative elements will make their journey meaningful?`,
    
    uniqueFeatures: `The narrative elements sound compelling. What unique features or innovations will make your game stand out? What will players remember most about their experience?`
  }
};

export class PromptManager {
  private static readonly prompts: Record<DocumentType, PromptTemplate> = {
    [DocumentType.GameVision]: GAME_VISION_PROMPT,
    // Other document types will be added here
  } as Record<DocumentType, PromptTemplate>;

  static getPromptForDocument(type: DocumentType): PromptTemplate | null {
    return this.prompts[type] || null;
  }

  private static async injectClaudeMessage(text: string): Promise<void> {
    // Find the chat container
    const chatContainer = document.querySelector('.chat-container, .claude-container');
    if (!chatContainer) {
      console.error('Could not find chat container');
      return;
    }

    // Create a new message element
    const messageElement = document.createElement('div');
    messageElement.className = 'claude-message assistant-message';
    messageElement.innerHTML = `
      <div class="claude-response bg-claude-light dark:bg-claude-dark rounded-xl px-4 py-3 my-4">
        <div class="claude-message-content text-gray-900 dark:text-gray-100">${text}</div>
      </div>
    `;

    // Add the message to the chat
    chatContainer.appendChild(messageElement);

    // Scroll to the new message
    messageElement.scrollIntoView({ behavior: 'smooth' });

    // Wait a moment for the UI to update
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private static currentPromptStage: keyof PromptTemplate['followUpPrompts'] | 'initial' = 'initial';

  static async injectPrompt(prompt: PromptTemplate): Promise<void> {
    // Send the initial prompt as a Claude message
    await this.injectClaudeMessage(prompt.initialPrompt);
    this.currentPromptStage = 'initial';
  }

  static async startDocumentCreation(type: DocumentType): Promise<void> {
    const prompt = this.getPromptForDocument(type);
    if (!prompt) {
      console.error(`No prompt template found for document type: ${type}`);
      return;
    }

    try {
      await this.injectPrompt(prompt);
      this.monitorResponse(prompt);
    } catch (error) {
      console.error('Error starting document creation:', error);
    }
  }

  static monitorResponse(prompt: PromptTemplate): void {
    // Create a mutation observer to watch for Claude's responses
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Look for new response elements
          const responses = Array.from(document.querySelectorAll('.claude-response'));
          for (const response of responses) {
            // Process the response and send next prompt
            this.processResponse(response.textContent || '', prompt);
          }
        }
      }
    });

    // Start observing the chat container
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      observer.observe(chatContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  private static async processResponse(content: string, prompt: PromptTemplate): Promise<void> {
    console.log('Captured response:', content);

    // Determine next prompt based on current stage
    let nextPrompt: string | undefined;
    
    switch (this.currentPromptStage) {
      case 'initial':
        nextPrompt = prompt.followUpPrompts.groupDynamics;
        this.currentPromptStage = 'groupDynamics';
        break;
      case 'groupDynamics':
        nextPrompt = prompt.followUpPrompts.worldAndChallenges;
        this.currentPromptStage = 'worldAndChallenges';
        break;
      case 'worldAndChallenges':
        nextPrompt = prompt.followUpPrompts.progressionAndGrowth;
        this.currentPromptStage = 'progressionAndGrowth';
        break;
      case 'progressionAndGrowth':
        nextPrompt = prompt.followUpPrompts.storyAndNarrative;
        this.currentPromptStage = 'storyAndNarrative';
        break;
      case 'storyAndNarrative':
        nextPrompt = prompt.followUpPrompts.uniqueFeatures;
        this.currentPromptStage = 'uniqueFeatures';
        break;
      // No more prompts after uniqueFeatures
    }

    if (nextPrompt) {
      await this.injectClaudeMessage(nextPrompt);
    }
  }
}
