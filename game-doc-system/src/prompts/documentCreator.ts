import { DocumentType } from '../shared/types';

interface DocumentPrompt {
  welcomeMessage: string;
  placeholderText: string;
  questions: string[];
}

const DOCUMENT_PROMPTS: Record<DocumentType, DocumentPrompt> = {
  [DocumentType.GameVision]: {
    welcomeMessage: "Let's explore your game vision",
    placeholderText: "Tell me about your game vision at a high level",
    questions: [
      "What inspired this game? What influences shaped your vision?",
      "What emotional journey do you want players to experience?",
      "What makes your game unique and innovative?",
      "What's your creative direction and aesthetic vision?",
      "How do you see this vision informing the rest of the game's development?"
    ]
  },
  [DocumentType.CoreGameConcept]: {
    welcomeMessage: "Let's outline your core game concept",
    placeholderText: "Describe the core gameplay loop, key mechanics, or main activities",
    questions: [
      "What is the main activity or action in your game?",
      "How does the core gameplay loop work?",
      "What are the key mechanics that make it engaging?",
      "How does the player interact with the game world?",
      "What makes this concept unique or interesting?"
    ]
  },
  [DocumentType.TargetAudience]: {
    welcomeMessage: "Let's identify your target audience",
    placeholderText: "Describe who you're making this game for",
    questions: [
      "What age groups are you targeting?",
      "What gaming experience level do they have?",
      "What other games do they play?",
      "What interests or hobbies do they have?",
      "How much time do they spend gaming?"
    ]
  },
  [DocumentType.CorePillarsValues]: {
    welcomeMessage: "Let's establish your core pillars and values",
    placeholderText: "List the key principles guiding your game design",
    questions: [
      "What are your main design pillars?",
      "What values drive your design decisions?",
      "What experience are you optimizing for?",
      "What will you not compromise on?",
      "How do these pillars support each other?"
    ]
  },
  [DocumentType.WhyPlayIt]: {
    welcomeMessage: "Let's explore why players will love your game",
    placeholderText: "Describe what makes your game compelling",
    questions: [
      "What's the main appeal of your game?",
      "What rewards or satisfaction does it offer?",
      "Why would someone choose this over similar games?",
      "What keeps players coming back?",
      "How does it stand out in the market?"
    ]
  },
  [DocumentType.WhatShouldTheyFeel]: {
    welcomeMessage: "Let's define the emotional journey",
    placeholderText: "Describe the feelings and emotions players should experience",
    questions: [
      "What's the primary emotion you want to evoke?",
      "How does the emotional journey progress?",
      "What moments create peak experiences?",
      "How do you maintain emotional engagement?",
      "What memories should players take away?"
    ]
  },
  [DocumentType.UniqueSellingPoints]: {
    welcomeMessage: "Let's identify what makes your game unique",
    placeholderText: "List the features or qualities that set your game apart",
    questions: [
      "What's your main innovation or unique feature?",
      "What combinations of elements are novel?",
      "What technical advantages do you have?",
      "What creative approaches set you apart?",
      "How do you improve on existing games?"
    ]
  },
  [DocumentType.GameLoop]: {
    welcomeMessage: "Let's detail your game loop",
    placeholderText: "Describe what keeps players engaged moment to moment",
    questions: [
      "What's the basic moment-to-moment gameplay?",
      "How do activities chain together?",
      "What drives player decisions?",
      "How do you maintain engagement?",
      "What creates variety in the loop?"
    ]
  },
  [DocumentType.PlayerJourney]: {
    welcomeMessage: "Let's map the player's journey",
    placeholderText: "Outline how players progress through your game",
    questions: [
      "How does the journey begin?",
      "What are the major milestones?",
      "How does difficulty progress?",
      "What skills do players develop?",
      "How does the journey conclude?"
    ]
  },
  [DocumentType.StoryOverview]: {
    welcomeMessage: "Let's craft your story overview",
    placeholderText: "Share the tale your game tells",
    questions: [
      "What's the main narrative theme?",
      "Who are the key characters?",
      "What's the central conflict?",
      "How does the story progress?",
      "How does it connect to gameplay?"
    ]
  },
  [DocumentType.Presentation]: {
    welcomeMessage: "Let's plan your game's presentation",
    placeholderText: "Describe how your game will look and feel",
    questions: [
      "What's your visual style?",
      "How does the audio support the experience?",
      "What's your UI philosophy?",
      "How do you maintain visual clarity?",
      "What technical constraints affect presentation?"
    ]
  },
  [DocumentType.KeyQuestions]: {
    welcomeMessage: "Let's address key questions about your game",
    placeholderText: "List critical questions that need answers",
    questions: [
      "What are your biggest design challenges?",
      "What technical hurdles do you face?",
      "What market risks concern you?",
      "What resource constraints affect you?",
      "What unknowns need resolution?"
    ]
  },
  [DocumentType.CoreDesignDetails]: {
    welcomeMessage: "Let's detail your core design",
    placeholderText: "Describe the essential mechanics and systems",
    questions: [
      "What are your core mechanics?",
      "How do systems interact?",
      "What creates depth in gameplay?",
      "How do you balance complexity?",
      "What makes the design coherent?"
    ]
  },
  [DocumentType.StrategicDirection]: {
    welcomeMessage: "Let's plan your strategic direction",
    placeholderText: "Outline your goals and priorities",
    questions: [
      "What are your key milestones?",
      "How will you measure success?",
      "What's your competitive strategy?",
      "How will you grow and evolve?",
      "What's your long-term vision?"
    ]
  }
};

export class DocumentCreator {
  private static generatePrompt(type: DocumentType, answers: string[]): string {
    const prompt = DOCUMENT_PROMPTS[type];
    if (!prompt) {
      throw new Error(`No prompt found for document type: ${type}`);
    }

    // Create a formatted prompt that includes all answers
    const formattedAnswers = answers.map((answer, index) => 
      `Q: ${prompt.questions[index]}\nA: ${answer}`
    ).join('\n\n');

    // Get document type specific format instructions
    const formatInstructions = {
      [DocumentType.GameVision]: `
1. Creative vision and inspiration
2. Emotional goals and player feelings
3. Unique aspects and innovations
4. Creative direction and aesthetic goals`,
      [DocumentType.CoreGameConcept]: `
1. The core gameplay loop
2. Key mechanics and systems
3. Player interactions and controls
4. Unique elements and distinguishing features`,
      [DocumentType.TargetAudience]: `
1. Primary audience demographics
2. Player experience level and preferences
3. Gaming habits and interests
4. Market positioning`,
      [DocumentType.CorePillarsValues]: `
1. Key design pillars
2. Guiding values and principles
3. Experience goals
4. Non-negotiable elements`,
      [DocumentType.WhyPlayIt]: `
1. Core appeal and value proposition
2. Player rewards and satisfaction
3. Competitive advantages
4. Player retention elements`,
      [DocumentType.WhatShouldTheyFeel]: `
1. Primary emotional experience
2. Emotional journey and progression
3. Peak moments and memories
4. Engagement maintenance`,
      [DocumentType.UniqueSellingPoints]: `
1. Key innovations and unique features
2. Technical and creative advantages
3. Market differentiation
4. Competitive improvements`,
      [DocumentType.GameLoop]: `
1. Core gameplay mechanics
2. Activity chains and progression
3. Player decision drivers
4. Engagement and variety elements`,
      [DocumentType.PlayerJourney]: `
1. Journey structure and progression
2. Key milestones and achievements
3. Skill development path
4. Difficulty curve`,
      [DocumentType.StoryOverview]: `
1. Narrative theme and setting
2. Key characters and conflicts
3. Story progression
4. Gameplay integration`,
      [DocumentType.Presentation]: `
1. Visual style and direction
2. Audio design philosophy
3. UI/UX approach
4. Technical considerations`,
      [DocumentType.KeyQuestions]: `
1. Design challenges and solutions
2. Technical considerations
3. Market and resource risks
4. Critical unknowns`,
      [DocumentType.CoreDesignDetails]: `
1. Core mechanics breakdown
2. System interactions
3. Gameplay depth elements
4. Design coherence`,
      [DocumentType.StrategicDirection]: `
1. Key milestones and goals
2. Success metrics
3. Competitive strategy
4. Growth and evolution plan`
    }[type];

    // Special handling for Game Vision document
    if (type === DocumentType.GameVision) {
      return `Please help me create a game vision document based on the following responses:

${formattedAnswers}

Please synthesize these answers into a clear, cohesive Game Vision document that captures the creative essence and high-level concept of the game. The document should include:

1. Title of the game
2. Single inspirational line description
3. A single paragraph that captures the high level overview of the game, naturally incorporating:
   - The creative vision and inspiration
   - The emotional goals and player feelings
   - The unique aspects and innovations
   - The creative direction and aesthetic goals

The paragraph should flow naturally and authentically represent the creator's vision, while maintaining focus on what makes this game special and how it will resonate with players.`;
    }

    // For other document types, use the standard format
    return `Please help me create a ${prompt.welcomeMessage.toLowerCase().replace("let's ", "")} based on the following responses:

${formattedAnswers}

Please synthesize these answers into a clear, cohesive document that outlines:${formatInstructions}

Format the response as a well-structured document with appropriate sections and headings.`;
  }

  static async startDocumentCreation(type: DocumentType): Promise<void> {
    // Create sidebar form interface
    const form = document.createElement('form');
    form.className = 'gdds-document-form';
    
    const prompt = DOCUMENT_PROMPTS[type];
    if (!prompt) {
      throw new Error(`No prompt found for document type: ${type}`);
    }

    // Add header
    const header = document.createElement('h3');
    header.textContent = prompt.welcomeMessage;
    form.appendChild(header);

    // Add questions
    const answers: string[] = [];
    prompt.questions.forEach((question, index) => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'gdds-form-group';

      const label = document.createElement('label');
      label.textContent = question;
      questionDiv.appendChild(label);

      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Your answer...';
      textarea.required = true;
      textarea.addEventListener('input', () => {
        answers[index] = textarea.value;
        updatePreview();
      });
      questionDiv.appendChild(textarea);

      form.appendChild(questionDiv);
    });

    // Add preview section
    const previewSection = document.createElement('div');
    previewSection.className = 'gdds-preview-section';
    previewSection.innerHTML = `
      <h4>Generated Prompt Preview</h4>
      <pre class="gdds-preview"></pre>
    `;
    form.appendChild(previewSection);

    // Add submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'gdds-button primary';
    submitButton.textContent = 'Generate Document';
    form.appendChild(submitButton);

    // Add form to sidebar
    const sidebar = document.querySelector('#gdds-sidebar');
    if (!sidebar) {
      throw new Error('Sidebar not found');
    }
    sidebar.innerHTML = '';
    sidebar.appendChild(form);

    // Update preview function
    function updatePreview() {
      const preview = form.querySelector('.gdds-preview');
      if (preview && answers.some(a => a)) {
        preview.textContent = DocumentCreator.generatePrompt(type, answers);
      }
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (answers.some(a => !a)) {
        alert('Please answer all questions');
        return;
      }

      const finalPrompt = DocumentCreator.generatePrompt(type, answers);
      
      // Store answers and prompt for later use
      chrome.storage.local.set({
        [`document_${type}_answers`]: answers,
        [`document_${type}_prompt`]: finalPrompt
      });

      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'gdds-success-message';
      successMessage.textContent = 'Answers saved! Click "Create" in Claude to generate the document.';
      form.appendChild(successMessage);
    });
  }
}
