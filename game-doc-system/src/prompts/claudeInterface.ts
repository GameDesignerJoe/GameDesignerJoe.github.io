export class ClaudeInterface {
  static async sendMessage(message: string, silent: boolean = false): Promise<string> {
    console.log('ClaudeInterface.sendMessage: Starting to send message');
    
    try {
      // Find the input field
      console.log('ClaudeInterface.sendMessage: Finding input field');
      const input = await this.findInput();
      if (!input) {
        throw new Error('Could not find input field');
      }
      console.log('ClaudeInterface.sendMessage: Found input field:', input.tagName);

      // Clear any existing input first
      await this.clearInput();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Set the message and trigger input event
      console.log('ClaudeInterface.sendMessage: Setting message and triggering events');
      this.setInputValue(input, message);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to find and click the submit button
      console.log('ClaudeInterface.sendMessage: Looking for submit button');
      const button = await this.findButton(input);

      if (button) {
        console.log('ClaudeInterface.sendMessage: Found button, clicking');
        button.click();
      } else {
        // Fallback to Enter key if no button found
        console.log('ClaudeInterface.sendMessage: No button found, trying Enter key');
        this.simulateEnterKey(input);
      }

      // Wait for message to be sent and get response
      console.log('ClaudeInterface.sendMessage: Waiting for message to appear');
      const response = await this.waitForResponse();
      console.log('ClaudeInterface.sendMessage: Message sent and appeared successfully');
      return response;
    } catch (error) {
      console.error('ClaudeInterface.sendMessage: Error sending message:', error);
      throw error;
    }
  }

  private static async clearInput(): Promise<void> {
    const input = await this.findInput();
    if (!input) {
      throw new Error('Could not find input field');
    }

    // Clear the input field
    this.setInputValue(input, '');
  }

  static async startDocumentCreation(): Promise<void> {
    console.log('ClaudeInterface: Starting document creation');
    
    try {
      // Wait for page to be ready
      console.log('ClaudeInterface: Waiting for interface to be ready');
      await this.waitForInterface();
      console.log('ClaudeInterface: Interface is ready');

      // Find Claude's input field
      console.log('ClaudeInterface: Finding input field');
      const input = await this.findInput();
      if (!input) {
        throw new Error('Could not find input field');
      }
      console.log('ClaudeInterface: Found input field:', input.tagName);

      // Clear any existing input
      await this.clearInput();

      // Wait for initial messages to load and UI to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Ensure input is still available and focused
      const finalInput = await this.findInput();
      if (!finalInput) {
        throw new Error('Input field not available after initialization');
      }
      finalInput.focus();

      console.log('ClaudeInterface: Document creation completed successfully');
    } catch (error) {
      console.error('ClaudeInterface: Error during document creation:', error);
      throw error;
    }
  }

  static async sendMessageToClaude(message: string): Promise<string> {
    console.log('ClaudeInterface.sendMessageToClaude: Starting to send message:', message.substring(0, 50) + '...');
    
    try {
    // Find Claude's input field
    const input = await this.findInput();
    if (!input) {
      throw new Error('Could not find input field');
    }

      // Clear existing input
      await this.clearInput();
      await new Promise(resolve => setTimeout(resolve, 100));

    // Set the message
    this.setInputValue(input, message);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Find and click the send button
    const button = await this.findButton(input);
    if (button) {
        console.log('ClaudeInterface.sendMessageToClaude: Clicking send button');
      button.click();
    } else {
        console.log('ClaudeInterface.sendMessageToClaude: Using Enter key fallback');
      this.simulateEnterKey(input);
    }

      // Wait for and capture response
      console.log('ClaudeInterface.sendMessageToClaude: Waiting for response');
      const response = await this.waitForResponse();
      
      if (!response) {
        throw new Error('No response received from Claude');
      }

      console.log('ClaudeInterface.sendMessageToClaude: Received response:', response.substring(0, 100) + '...');
      return response;
    } catch (error) {
      console.error('ClaudeInterface.sendMessageToClaude: Error:', error);
      throw error;
    }
  }

  private static async waitForResponse(timeout = 10000): Promise<string> {
    console.log('ClaudeInterface.waitForResponse: Waiting for Claude to respond');
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      // Check for loading indicators
      if (this.checkLoadingState()) {
        console.log('ClaudeInterface.waitForResponse: Claude is still thinking...');
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Updated selectors for Claude's modern interface
      const responseSelectors = [
        '.prose.w-full',
        '.markdown.prose',
        '[data-message-author-role="assistant"]',
        '.claude-message-content',
        '.message-content',
        '.prose'
      ];

      // Get all potential response elements
      const responseElements = responseSelectors.flatMap(selector => 
        Array.from(document.querySelectorAll(selector))
      );

      if (responseElements.length > 0) {
        // Get the last response element
        const lastResponse = responseElements[responseElements.length - 1];
        if (lastResponse && lastResponse.textContent) {
          console.log('ClaudeInterface.waitForResponse: Found response:', lastResponse.textContent.substring(0, 100) + '...');
          return lastResponse.textContent;
        }
      }

      // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('ClaudeInterface.waitForResponse: Timed out waiting for response');
    throw new Error('No response received from Claude within timeout period');
  }

  private static checkLoadingState(): boolean {
    const loadingIndicators = [
      '[data-loading="true"]',
      '.loading',
      '.typing-indicator',
      '[aria-label*="loading"]',
      '[class*="loading"]',
      '[class*="typing"]',
      '.animate-pulse'
    ];
    
    return loadingIndicators.some(selector => {
      const elements = document.querySelectorAll(selector);
      return elements.length > 0;
    });
  }

  private static async waitForInterface(timeout = 30000): Promise<void> {
    console.log('ClaudeInterface.waitForInterface: Starting to wait for interface');
    const start = Date.now();
    let lastCheck = '';
    
    while (Date.now() - start < timeout) {
      // Check for loading state
      if (this.checkLoadingState()) {
        console.log('ClaudeInterface.waitForInterface: Page is loading, waiting...');
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      // Check for interface readiness
      const input = await this.findInput();
      
      const status = `Input: ${input ? 'Found' : 'Not Found'}`;
      if (status !== lastCheck) {
        console.log('ClaudeInterface.waitForInterface: Status -', status);
        lastCheck = status;
      }
      
      if (input) {
        console.log('ClaudeInterface.waitForInterface: Input found, waiting for final load');
        // Wait a bit more to ensure everything is fully loaded and interactive
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Double check the input is still available and interactive
        const finalInput = await this.findInput();
        if (finalInput) {
          console.log('ClaudeInterface.waitForInterface: Interface is ready and interactive');
          return;
        } else {
          console.log('ClaudeInterface.waitForInterface: Input disappeared during wait, continuing to search');
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const error = 'Timeout waiting for Claude interface to be ready';
    console.error('ClaudeInterface.waitForInterface:', error);
    throw new Error(error);
  }

  private static async findButton(input: HTMLElement): Promise<HTMLButtonElement | null> {
    let button: HTMLButtonElement | null = null;

    // Helper function to check if button is usable
    const isUsableButton = (btn: Element): boolean => {
      if (!(btn instanceof HTMLButtonElement)) return false;
      const style = window.getComputedStyle(btn);
      return !btn.disabled && 
             style.display !== 'none' && 
             style.visibility !== 'hidden' &&
             style.opacity !== '0';
    };

    // Try to find button in parent first
    if (input.parentElement) {
      // Try specific button selectors
      const buttonSelectors = [
        'button[type="submit"]',
        'button[aria-label*="send" i]',
        'button[aria-label*="submit" i]',
        'button.send-button',
        'button.submit-button',
        'button.primary-button',
        'button:has(svg)',
        'button'
      ];

      for (const selector of buttonSelectors) {
        const buttons = Array.from(input.parentElement.querySelectorAll(selector));
        console.log(`ClaudeInterface.findButton: Found ${buttons.length} buttons with selector "${selector}" in parent`);

        const usableButton = buttons.find(isUsableButton);
        if (usableButton) {
          button = usableButton as HTMLButtonElement;
          console.log(`ClaudeInterface.findButton: Found usable button with selector "${selector}" in parent`);
          break;
        }
      }
    }

    // If no button found in parent, try siblings
    if (!button) {
      let sibling = input.nextElementSibling;
      while (sibling && !button) {
        if (isUsableButton(sibling)) {
          button = sibling as HTMLButtonElement;
          console.log('ClaudeInterface.findButton: Found button in siblings');
        } else {
          // Check for button within sibling
          const nestedButtons = Array.from(sibling.querySelectorAll('button'));
          const usableButton = nestedButtons.find(isUsableButton);
          if (usableButton) {
            button = usableButton as HTMLButtonElement;
            console.log('ClaudeInterface.findButton: Found button nested in sibling');
          }
        }
        sibling = sibling.nextElementSibling;
      }
    }

    return button;
  }

  private static simulateEnterKey(element: HTMLElement): void {
    console.log('ClaudeInterface.simulateEnterKey: Simulating Enter key press');
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    }));
  }

  private static setInputValue(input: HTMLElement, value: string): void {
    if (input instanceof HTMLTextAreaElement) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('ClaudeInterface.setInputValue: Set value on textarea');
    } else if (input.hasAttribute('contenteditable')) {
      input.textContent = value;
      // Trigger React synthetic events
      const events = ['beforeinput', 'input', 'change'];
      for (const eventName of events) {
        const event = new Event(eventName, { bubbles: true });
        Object.defineProperty(event, 'target', { value: input });
        Object.defineProperty(event, 'currentTarget', { value: input });
        input.dispatchEvent(event);
      }
      console.log('ClaudeInterface.setInputValue: Set content on contenteditable');
    }
  }

  private static async findInput(): Promise<HTMLElement | null> {
    console.log('ClaudeInterface.findInput: Starting to search for input element');
    
    // Updated selectors for Claude's modern interface
    const selectors = [
      'div[contenteditable="true"].ProseMirror',
      'textarea.claude-input',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Send a message"]',
      'div[role="textbox"]',
      '[data-message-author-role="user"] div[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      console.log('ClaudeInterface.findInput: Trying selector:', selector);
      const input = document.querySelector(selector) as HTMLElement;
      if (input && this.isEditable(input)) {
        console.log('ClaudeInterface.findInput: Found editable input with selector:', selector);
        return input;
      }
    }

    console.log('ClaudeInterface.findInput: No input element found');
    return null;
  }

  private static isEditable(element: HTMLElement): boolean {
    if (element instanceof HTMLTextAreaElement) {
      return !element.disabled && !element.readOnly;
    } else if (element.hasAttribute('contenteditable')) {
      return element.getAttribute('contenteditable') === 'true' && 
             window.getComputedStyle(element).display !== 'none';
    }
    return false;
  }

  static async handleUserInput(input: string): Promise<void> {
    try {
      // Send user's input and get response
      const response = await this.sendMessage(input);
      
      // Check if response contains questions
      if (response.includes('?')) {
        await this.handleFollowUpQuestions(response);
      } else {
        await this.handleDocumentCreation(response);
      }
    } catch (error) {
      console.error('Error handling user input:', error);
      throw error;
    }
  }

  private static async handleFollowUpQuestions(response: string): Promise<void> {
    // For now, just log that we received follow-up questions
    console.log('Handling follow-up questions:', response);
    // TODO: Implement follow-up question handling
  }

  private static async handleDocumentCreation(response: string): Promise<void> {
    // For now, just log that we're creating the document
    console.log('Creating document with response:', response);
    // TODO: Implement document creation
  }
}
