export class ClaudeInterface {
  static async startDocumentCreation(systemPrompt: string): Promise<void> {
    // Wait for page to be ready
    await this.waitForInterface();

    // Find the input field
    const input = await this.findInput();
    if (!input) {
      throw new Error('Could not find input field');
    }

    // Set the welcome message
    const welcomeMessage = "Hello, I'm here to help you with define the vision of your game. Why don't you tell me about it.";
    
    // Set the value and trigger input event
    if (input instanceof HTMLTextAreaElement) {
      input.value = welcomeMessage;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.hasAttribute('contenteditable')) {
      input.textContent = welcomeMessage;
      // Trigger React synthetic events
      const events = ['beforeinput', 'input', 'change'];
      for (const eventName of events) {
        const event = new Event(eventName, { bubbles: true });
        Object.defineProperty(event, 'target', { value: input });
        Object.defineProperty(event, 'currentTarget', { value: input });
        input.dispatchEvent(event);
      }
    }

    // Find and click the submit button
    const button = await this.findButton();
    if (!button) {
      throw new Error('Could not find submit button');
    }

    button.click();
  }

  private static async waitForInterface(timeout = 10000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      // Check for interface readiness
      if (document.readyState === 'complete' && document.querySelector('main')) {
        // Additional check for React app mount
        const reactRoot = document.querySelector('#__next');
        if (reactRoot) {
          return;
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Timeout waiting for Claude interface to be ready');
  }

  private static async findInput(): Promise<HTMLElement | null> {
    const selectors = [
      // Current Claude selectors
      'textarea.ProseMirror',
      'div[contenteditable="true"]',
      // Fallback selectors
      'textarea[placeholder*="Send a message"]',
      'textarea[placeholder*="message"]',
      'textarea.chat-input',
      'textarea[role="textbox"]'
    ];

    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) return input as HTMLElement;
    }

    return null;
  }

  private static async findButton(): Promise<HTMLButtonElement | null> {
    const selectors = [
      // Current Claude selectors
      'button[aria-label="Send message"]',
      'button.text-white[type="submit"]',
      // Fallback selectors
      'button[type="submit"]',
      'button.send-button',
      'button.chat-submit',
      'button[aria-label*="send"]',
      'button[aria-label*="submit"]',
      'button:has(svg)'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button) return button;
    }

    return null;
  }
}
