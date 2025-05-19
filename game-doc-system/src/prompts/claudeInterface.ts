export class ClaudeInterface {
  private static async sendMessage(message: string, silent: boolean = false): Promise<void> {
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

      // Wait for message to be sent
      console.log('ClaudeInterface.sendMessage: Waiting for message to appear');
      await this.waitForResponse();
      console.log('ClaudeInterface.sendMessage: Message sent and appeared successfully');
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

      // Wait for initial messages to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('ClaudeInterface: Document creation completed successfully');
    } catch (error) {
      console.error('ClaudeInterface: Error during document creation:', error);
      throw error;
    }
  }

  static async sendMessageToClaude(message: string): Promise<void> {
    // Find Claude's input field
    const input = await this.findInput();
    if (!input) {
      throw new Error('Could not find input field');
    }

    // Set the message
    this.setInputValue(input, message);

    // Send the message
    const button = await this.findButton(input);
    if (button) {
      button.click();
    } else {
      this.simulateEnterKey(input);
    }

    // Wait for response
    await this.waitForResponse();

    // Get Claude's response
    const responseElements = document.querySelectorAll('div.prose, div.markdown');
    const lastResponse = responseElements[responseElements.length - 1];
    if (lastResponse) {
      // Add response to our interface
      const chatArea = document.querySelector('.gdds-chat-area');
      if (chatArea) {
        // Remove any existing messages with the same content
        const existingMessages = chatArea.querySelectorAll('.gdds-message');
        existingMessages.forEach(msg => {
          if (msg.textContent === lastResponse.textContent) {
            msg.remove();
          }
        });

        // Add the new response
        const responseMessage = document.createElement('div');
        responseMessage.className = 'gdds-message gdds-assistant-message';
        responseMessage.innerHTML = `
          <div class="prose dark:prose-invert">
            <p>${lastResponse.textContent || ''}</p>
          </div>
        `;
        chatArea.appendChild(responseMessage);
        chatArea.scrollTop = chatArea.scrollHeight;
      }
    } else {
      throw new Error('No response received from Claude');
    }
  }

  private static async waitForResponse(timeout = 10000): Promise<void> {
    console.log('ClaudeInterface.waitForResponse: Waiting for Claude to respond');
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      // Check for loading indicators
      if (this.checkLoadingState()) {
        console.log('ClaudeInterface.waitForResponse: Claude is still thinking...');
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Look for response elements
      const responseIndicators = [
        'div.prose',
        'div.markdown',
        'div[class*="message"]',
        'div[class*="response"]',
        'div[class*="assistant"]',
        'div[class*="claude"]'
      ];

      // Get initial state
      const initialMessages = responseIndicators.flatMap(selector => 
        Array.from(document.querySelectorAll(selector))
      );
      console.log('ClaudeInterface.waitForResponse: Initial message count:', initialMessages.length);

      // Wait for new message to appear
      let lastCheck = Date.now();
      while (Date.now() - start < timeout) {
        // Check for loading state
        if (this.checkLoadingState()) {
          console.log('ClaudeInterface.waitForResponse: Still loading...');
          await new Promise(resolve => setTimeout(resolve, 500));
          lastCheck = Date.now();
          continue;
        }

        // Get current state
        const currentMessages = responseIndicators.flatMap(selector => 
          Array.from(document.querySelectorAll(selector))
        );

        // Check for new messages
        if (currentMessages.length > initialMessages.length) {
          console.log('ClaudeInterface.waitForResponse: Found new message');
          // Wait a bit more to ensure response is complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }

        // Check if any existing messages changed
        const hasChanges = currentMessages.some((msg, i) => {
          const initial = initialMessages[i];
          return !initial || msg.textContent !== initial.textContent;
        });

        if (hasChanges) {
          console.log('ClaudeInterface.waitForResponse: Message content changed');
          // Wait a bit more to ensure response is complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }

        // Only sleep if we haven't just checked loading state
        if (Date.now() - lastCheck > 100) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('ClaudeInterface.waitForResponse: Timed out waiting for response');
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

  private static checkLoadingState(): boolean {
    const loadingIndicators = [
      'div[aria-label*="loading"]',
      'div[class*="loading"]',
      'div[class*="spinner"]',
      'div[role="progressbar"]'
    ];
    return loadingIndicators.some(selector => document.querySelector(selector) !== null);
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
    
    // Helper function to check if an element is truly editable
    const isEditable = (element: HTMLElement): boolean => {
      if (element instanceof HTMLTextAreaElement) {
        return !element.disabled && !element.readOnly;
      } else if (element.hasAttribute('contenteditable')) {
        return element.getAttribute('contenteditable') === 'true' && 
               window.getComputedStyle(element).display !== 'none';
      }
      return false;
    };

    const selectors = [
      // Primary Claude selectors
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"].text-input',
      'div[contenteditable="true"].chat-input',
      'div.claude-input[contenteditable="true"]',
      // Secondary Claude selectors
      'div[contenteditable="true"]',
      'div.ProseMirror[contenteditable="true"]',
      // Fallback selectors
      'textarea[placeholder*="Send a message"]',
      'textarea[placeholder*="message"]',
      'textarea.chat-input',
      'textarea[role="textbox"]'
    ];

    for (const selector of selectors) {
      console.log('ClaudeInterface.findInput: Trying selector:', selector);
      const input = document.querySelector(selector) as HTMLElement;
      if (input && isEditable(input)) {
        console.log('ClaudeInterface.findInput: Found editable input with selector:', selector);
        return input;
      } else if (input) {
        console.log('ClaudeInterface.findInput: Found input but not editable with selector:', selector);
      }
    }

    console.log('ClaudeInterface.findInput: No input element found with any selector');
    return null;
  }

}
