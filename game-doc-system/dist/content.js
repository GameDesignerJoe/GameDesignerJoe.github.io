/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/prompts/claudeInterface.ts":
/*!****************************************!*\
  !*** ./src/prompts/claudeInterface.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ClaudeInterface: () => (/* binding */ ClaudeInterface)
/* harmony export */ });
class ClaudeInterface {
    static async sendMessage(message, silent = false) {
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
            }
            else {
                // Fallback to Enter key if no button found
                console.log('ClaudeInterface.sendMessage: No button found, trying Enter key');
                this.simulateEnterKey(input);
            }
            // Wait for message to be sent
            console.log('ClaudeInterface.sendMessage: Waiting for message to appear');
            await this.waitForResponse();
            console.log('ClaudeInterface.sendMessage: Message sent and appeared successfully');
        }
        catch (error) {
            console.error('ClaudeInterface.sendMessage: Error sending message:', error);
            throw error;
        }
    }
    static async clearInput() {
        const input = await this.findInput();
        if (!input) {
            throw new Error('Could not find input field');
        }
        // Clear the input field
        this.setInputValue(input, '');
    }
    static async startDocumentCreation() {
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
        }
        catch (error) {
            console.error('ClaudeInterface: Error during document creation:', error);
            throw error;
        }
    }
    static async sendMessageToClaude(message) {
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
        }
        else {
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
        }
        else {
            throw new Error('No response received from Claude');
        }
    }
    static async waitForResponse(timeout = 10000) {
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
            const initialMessages = responseIndicators.flatMap(selector => Array.from(document.querySelectorAll(selector)));
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
                const currentMessages = responseIndicators.flatMap(selector => Array.from(document.querySelectorAll(selector)));
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
    static async waitForInterface(timeout = 30000) {
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
                }
                else {
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
    static checkLoadingState() {
        const loadingIndicators = [
            'div[aria-label*="loading"]',
            'div[class*="loading"]',
            'div[class*="spinner"]',
            'div[role="progressbar"]'
        ];
        return loadingIndicators.some(selector => document.querySelector(selector) !== null);
    }
    static async findButton(input) {
        let button = null;
        // Helper function to check if button is usable
        const isUsableButton = (btn) => {
            if (!(btn instanceof HTMLButtonElement))
                return false;
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
                    button = usableButton;
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
                    button = sibling;
                    console.log('ClaudeInterface.findButton: Found button in siblings');
                }
                else {
                    // Check for button within sibling
                    const nestedButtons = Array.from(sibling.querySelectorAll('button'));
                    const usableButton = nestedButtons.find(isUsableButton);
                    if (usableButton) {
                        button = usableButton;
                        console.log('ClaudeInterface.findButton: Found button nested in sibling');
                    }
                }
                sibling = sibling.nextElementSibling;
            }
        }
        return button;
    }
    static simulateEnterKey(element) {
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
    static setInputValue(input, value) {
        if (input instanceof HTMLTextAreaElement) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('ClaudeInterface.setInputValue: Set value on textarea');
        }
        else if (input.hasAttribute('contenteditable')) {
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
    static async findInput() {
        console.log('ClaudeInterface.findInput: Starting to search for input element');
        // Helper function to check if an element is truly editable
        const isEditable = (element) => {
            if (element instanceof HTMLTextAreaElement) {
                return !element.disabled && !element.readOnly;
            }
            else if (element.hasAttribute('contenteditable')) {
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
            const input = document.querySelector(selector);
            if (input && isEditable(input)) {
                console.log('ClaudeInterface.findInput: Found editable input with selector:', selector);
                return input;
            }
            else if (input) {
                console.log('ClaudeInterface.findInput: Found input but not editable with selector:', selector);
            }
        }
        console.log('ClaudeInterface.findInput: No input element found with any selector');
        return null;
    }
}


/***/ }),

/***/ "./src/prompts/promptManager.ts":
/*!**************************************!*\
  !*** ./src/prompts/promptManager.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PromptManager: () => (/* binding */ PromptManager)
/* harmony export */ });
/* harmony import */ var _claudeInterface__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./claudeInterface */ "./src/prompts/claudeInterface.ts");

const DOCUMENT_PROMPTS = {
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
class PromptManager {
    static getPromptForDocument(type) {
        return DOCUMENT_PROMPTS[type] || null;
    }
    static getSystemPrompt(type) {
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
    static async startDocumentCreation(type) {
        console.log('PromptManager: Starting document creation for type:', type);
        const prompt = this.getPromptForDocument(type);
        if (!prompt) {
            console.error(`PromptManager: No prompt found for document type: ${type}`);
            return;
        }
        console.log('PromptManager: Found prompt:', prompt);
        try {
            // Start the document creation process using Claude interface
            console.log('PromptManager: Starting Claude interface');
            await _claudeInterface__WEBPACK_IMPORTED_MODULE_0__.ClaudeInterface.startDocumentCreation();
            console.log('PromptManager: Document creation started successfully');
        }
        catch (error) {
            console.error('PromptManager: Error during document creation:', error);
            throw error;
        }
    }
}


/***/ }),

/***/ "./src/shared/types.ts":
/*!*****************************!*\
  !*** ./src/shared/types.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DocumentStatus: () => (/* binding */ DocumentStatus),
/* harmony export */   DocumentType: () => (/* binding */ DocumentType),
/* harmony export */   MessageType: () => (/* binding */ MessageType)
/* harmony export */ });
// Document types supported by the system
var DocumentType;
(function (DocumentType) {
    DocumentType["GameVision"] = "game_vision";
    DocumentType["CoreGameConcept"] = "core_game_concept";
    DocumentType["TargetAudience"] = "target_audience";
    DocumentType["CorePillarsValues"] = "core_pillars_values";
    DocumentType["WhyPlayIt"] = "why_play_it";
    DocumentType["WhatShouldTheyFeel"] = "what_should_they_feel";
    DocumentType["UniqueSellingPoints"] = "unique_selling_points";
    DocumentType["GameLoop"] = "game_loop";
    DocumentType["PlayerJourney"] = "player_journey";
    DocumentType["StoryOverview"] = "story_overview";
    DocumentType["Presentation"] = "presentation";
    DocumentType["KeyQuestions"] = "key_questions";
    DocumentType["CoreDesignDetails"] = "core_design_details";
    DocumentType["StrategicDirection"] = "strategic_direction";
})(DocumentType || (DocumentType = {}));
// Document status
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["NotStarted"] = "not_started";
    DocumentStatus["InProgress"] = "in_progress";
    DocumentStatus["Completed"] = "completed";
})(DocumentStatus || (DocumentStatus = {}));
// Message types for communication between components
var MessageType;
(function (MessageType) {
    MessageType["GetProjects"] = "get_projects";
    MessageType["CreateProject"] = "create_project";
    MessageType["UpdateProject"] = "update_project";
    MessageType["DeleteProject"] = "delete_project";
    MessageType["GetProject"] = "get_project";
    MessageType["CreateDocument"] = "create_document";
    MessageType["UpdateDocument"] = "update_document";
    MessageType["GetDocument"] = "get_document";
    MessageType["DeleteDocument"] = "delete_document";
    MessageType["StartDocumentCreation"] = "start_document_creation";
})(MessageType || (MessageType = {}));


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!********************************!*\
  !*** ./src/content/content.ts ***!
  \********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _shared_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/types */ "./src/shared/types.ts");
/* harmony import */ var _prompts_promptManager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../prompts/promptManager */ "./src/prompts/promptManager.ts");
/* harmony import */ var _prompts_claudeInterface__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../prompts/claudeInterface */ "./src/prompts/claudeInterface.ts");



// Wait until page fully loaded
// Inject CSS into the page
function injectStyles() {
    const styleLinks = [
        chrome.runtime.getURL('css/sidebar.css'),
        chrome.runtime.getURL('css/claude-messages.css')
    ];
    styleLinks.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = href;
        document.head.appendChild(link);
    });
    // Add custom styles for our interface
    const customStyles = document.createElement('style');
    customStyles.textContent = `
    /* Hide Claude's default interface when in document mode */
    body.gdds-document-mode main {
      display: none !important;
    }

    /* Our custom interface */
    .gdds-document-interface {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: rgb(17, 18, 19);
      color: rgb(236, 236, 241);
      max-width: 48rem;
      margin: 0 auto;
      padding: 0 2rem;
      position: relative;
    }

    .gdds-header {
      padding: 2rem 0;
      margin-bottom: 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .gdds-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: rgb(236, 236, 241);
    }

    .gdds-chat-area {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 0;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .gdds-input-area {
      padding: 2rem 0;
      margin-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    .gdds-input-area {
      position: relative;
    }

    .gdds-input-area textarea {
      width: 100%;
      min-height: 3rem;
      padding: 0.75rem;
      background: rgb(52, 53, 65);
      color: rgb(236, 236, 241);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem;
      resize: none;
      font-size: 1rem;
      line-height: 1.5;
    }

    .gdds-input-area::after {
      content: "⏎";
      position: absolute;
      right: 1rem;
      bottom: 1.25rem;
      color: rgb(172, 172, 190);
      font-size: 1.5rem;
      pointer-events: none;
      opacity: 0.8;
      font-family: system-ui;
    }

    .gdds-input-area textarea:focus {
      outline: none;
      border-color: rgba(255,255,255,0.2);
    }

    .gdds-message {
      padding: 1.5rem 0;
      line-height: 1.6;
      width: 100%;
    }

    .gdds-user-message {
      background: rgb(52, 53, 65);
      padding: 1rem;
      border-radius: 0.5rem;
    }

    .gdds-assistant-message {
      background: transparent;
      color: rgb(209, 213, 219);
    }

    .gdds-assistant-message .prose {
      max-width: none;
      width: 100%;
    }

    .gdds-assistant-message .prose p {
      margin: 0;
      padding: 0;
    }
  `;
    document.head.appendChild(customStyles);
}
// Initialize when the page loads
window.addEventListener('load', () => {
    if (window.location.href.includes('claude.ai')) {
        console.log('Game Development Document System loaded on Claude.ai');
        injectStyles();
        // Wait for chat interface to be ready
        const observer = new MutationObserver((mutations, obs) => {
            const chatInterface = document.querySelector('main');
            if (chatInterface) {
                console.log('Chat interface found, injecting sidebar');
                obs.disconnect();
                // Check if sidebar already exists
                if (!document.getElementById('gdds-sidebar-wrapper')) {
                    injectSidebar();
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
});
// Also check on URL changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (url.includes('claude.ai')) {
            // Re-inject sidebar if needed
            if (!document.getElementById('gdds-sidebar-wrapper')) {
                injectStyles();
                injectSidebar();
            }
        }
    }
}).observe(document, { subtree: true, childList: true });
// Add a message to Claude's interface
function addClaudeMessage(message) {
    // Create a new message that looks like it came from Claude
    const messageContainer = document.createElement('div');
    messageContainer.className = 'prose dark:prose-invert';
    messageContainer.style.cssText = 'max-width: none; width: 100%;';
    messageContainer.innerHTML = `
    <div class="markdown prose w-full break-words dark:prose-invert light">
      <p>${message}</p>
    </div>
  `;
    // Find Claude's message container and add our message
    const messagesContainer = document.querySelector('main .flex.flex-col.items-center');
    if (messagesContainer) {
        messagesContainer.appendChild(messageContainer);
        // Find and scroll to the input
        const input = document.querySelector('textarea.ProseMirror, [contenteditable="true"]');
        if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}
// Inject the sidebar into Claude's UI
function injectSidebar() {
    console.log('Attempting to inject sidebar');
    // Find main chat container to position relative to
    const mainContent = document.querySelector('main');
    if (!mainContent) {
        console.log('Claude main content not found, retrying in 2 seconds');
        setTimeout(injectSidebar, 2000);
        return;
    }
    // Create sidebar wrapper and elements
    const sidebarWrapper = document.createElement('div');
    sidebarWrapper.id = 'gdds-sidebar-wrapper';
    sidebarWrapper.className = 'collapsed';
    const sidebar = document.createElement('div');
    sidebar.id = 'gdds-sidebar';
    sidebar.className = 'gdds-sidebar';
    const sidebarTab = document.createElement('div');
    sidebarTab.id = 'gdds-sidebar-tab';
    sidebarTab.className = 'gdds-sidebar-tab';
    sidebarTab.innerHTML = `
    <button class="gdds-button icon-only" id="gdds-toggle-sidebar">
      <span class="gdds-icon">→</span>
    </button>
  `;
    // Add elements to wrapper
    sidebarWrapper.appendChild(sidebar);
    sidebarWrapper.appendChild(sidebarTab);
    // Position wrapper after the main content
    mainContent.parentElement?.insertBefore(sidebarWrapper, mainContent.nextSibling);
    // Initial HTML for sidebar
    sidebar.innerHTML = `
    <div class="gdds-gd-text">GD</div>
    <div class="gdds-sidebar-header">
      <h3>Game Documents</h3>
      <button id="gdds-new-project" class="gdds-button primary">New Project</button>
    </div>
    <div class="gdds-projects-container">
      <div class="gdds-loading">Loading projects...</div>
    </div>
  `;
    // Setup event listeners
    setupEventListeners();
    // Load projects
    loadProjects();
    console.log('Sidebar injected successfully');
}
// Setup event listeners for sidebar
function setupEventListeners() {
    // New project button
    const newProjectButton = document.getElementById('gdds-new-project');
    if (newProjectButton) {
        newProjectButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('New Project button clicked');
            showNewProjectDialog();
        });
    }
    // Toggle sidebar button
    const toggleButton = document.getElementById('gdds-toggle-sidebar');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
    }
}
// Toggle sidebar visibility
function toggleSidebar() {
    const sidebar = document.getElementById('gdds-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}
// Show dialog to create new project
function showNewProjectDialog() {
    console.log('Showing new project dialog');
    // Create dialog element
    const dialog = document.createElement('div');
    dialog.className = 'gdds-dialog';
    dialog.innerHTML = `
    <div class="gdds-dialog-content">
      <h3>Create New Project</h3>
      <form id="gdds-new-project-form">
        <div class="gdds-form-group">
          <label for="project-name">Project Name:</label>
          <input type="text" id="project-name" required>
        </div>
        <div class="gdds-form-actions">
          <button type="button" class="gdds-button secondary" id="gdds-cancel-project">Cancel</button>
          <button type="submit" class="gdds-button primary">Create Project</button>
        </div>
      </form>
    </div>
  `;
    // Add to DOM
    document.body.appendChild(dialog);
    // Focus the input field
    const nameInput = document.getElementById('project-name');
    if (nameInput) {
        nameInput.focus();
    }
    // Setup form submission
    const form = document.getElementById('gdds-new-project-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (nameInput && nameInput.value.trim()) {
                createProject(nameInput.value.trim());
                closeDialog();
            }
        });
    }
    // Setup cancel button
    const cancelButton = document.getElementById('gdds-cancel-project');
    if (cancelButton) {
        cancelButton.addEventListener('click', closeDialog);
    }
    // Close dialog function
    function closeDialog() {
        document.body.removeChild(dialog);
    }
}
// Create new project
function createProject(name) {
    chrome.runtime.sendMessage({ type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.CreateProject, payload: { name } }, (response) => {
        if (response.success) {
            console.log('Project created:', response.data);
            loadProjects();
        }
        else {
            console.error('Failed to create project:', response.error);
            showNotification('Error creating project', 'error');
        }
    });
}
// Load projects from storage
function loadProjects() {
    const projectsContainer = document.querySelector('.gdds-projects-container');
    if (projectsContainer) {
        projectsContainer.innerHTML = '<div class="gdds-loading">Loading projects...</div>';
        chrome.runtime.sendMessage({ type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.GetProjects, payload: {} }, (response) => {
            if (response.success) {
                renderProjects(response.data || {});
            }
            else {
                console.error('Failed to load projects:', response.error);
                projectsContainer.innerHTML = '<div class="gdds-error">Error loading projects</div>';
            }
        });
    }
}
// Render projects list
function renderProjects(projects) {
    const projectsContainer = document.querySelector('.gdds-projects-container');
    if (!projectsContainer)
        return;
    if (Object.keys(projects).length === 0) {
        projectsContainer.innerHTML = `
      <div class="gdds-empty-state">
        <p>No projects yet</p>
        <p>Click "New Project" to get started</p>
      </div>
    `;
        return;
    }
    // Create projects list
    const projectsList = document.createElement('div');
    projectsList.className = 'gdds-projects-list';
    // Sort projects by creation date (newest first)
    const sortedProjects = Object.values(projects).sort((a, b) => b.createdAt - a.createdAt);
    // Add each project
    sortedProjects.forEach(project => {
        const projectElement = document.createElement('div');
        projectElement.className = 'gdds-project-item';
        projectElement.dataset.projectId = project.id;
        projectElement.innerHTML = `
      <div class="gdds-project-header">
        <h4>${project.name}</h4>
        <div class="gdds-project-actions">
          <button class="gdds-button icon-only project-delete" title="Delete Project">
            <img src="${chrome.runtime.getURL('assets/icon_trash.png')}" alt="Delete" width="16" height="16">
          </button>
          <button class="gdds-button icon-only project-expand">
            <span class="gdds-icon">▼</span>
          </button>
        </div>
      </div>
      <div class="gdds-project-documents" style="display: none;"></div>
    `;
        projectsList.appendChild(projectElement);
        // Add event listeners for project actions
        const expandButton = projectElement.querySelector('.project-expand');
        if (expandButton) {
            expandButton.addEventListener('click', () => {
                toggleProjectDocuments(project.id);
            });
        }
        const deleteButton = projectElement.querySelector('.project-delete');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                showDeleteConfirmation(project);
            });
        }
    });
    // Replace loading indicator with projects list
    projectsContainer.innerHTML = '';
    projectsContainer.appendChild(projectsList);
}
// Toggle project documents visibility
function toggleProjectDocuments(projectId) {
    const projectElement = document.querySelector(`[data-project-id="${projectId}"]`);
    if (!projectElement)
        return;
    const documentsContainer = projectElement.querySelector('.gdds-project-documents');
    if (!documentsContainer)
        return;
    const isVisible = documentsContainer.style.display !== 'none';
    documentsContainer.style.display = isVisible ? 'none' : 'block';
    // Update expand/collapse icon
    const expandButton = projectElement.querySelector('.project-expand');
    if (expandButton) {
        const icon = expandButton.querySelector('.gdds-icon');
        if (icon) {
            icon.textContent = isVisible ? '▼' : '▲';
        }
    }
    // If expanding, load and render documents
    if (!isVisible) {
        loadProjectDocuments(projectId);
    }
}
// Load document list for a project
function loadProjectDocuments(projectId) {
    chrome.runtime.sendMessage({ type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.GetProject, payload: { projectId } }, (response) => {
        if (response.success && response.data) {
            renderProjectDocuments(response.data);
        }
        else {
            console.error('Failed to load project documents:', response.error);
        }
    });
}
// Render documents for a project
function renderProjectDocuments(project) {
    const projectElement = document.querySelector(`[data-project-id="${project.id}"]`);
    if (!projectElement)
        return;
    const documentsContainer = projectElement.querySelector('.gdds-project-documents');
    if (!documentsContainer)
        return;
    // Clear previous content
    documentsContainer.innerHTML = '';
    // Define the document type order
    const documentTypeOrder = [
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameVision,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CoreGameConcept,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.TargetAudience,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CorePillarsValues,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.WhyPlayIt,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.WhatShouldTheyFeel,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.UniqueSellingPoints,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameLoop,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.PlayerJourney,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.StoryOverview,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.Presentation,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.KeyQuestions,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CoreDesignDetails,
        _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.StrategicDirection
    ];
    // Sort documents by the defined order
    const sortedDocuments = Object.values(project.documents).sort((a, b) => {
        return documentTypeOrder.indexOf(a.type) -
            documentTypeOrder.indexOf(b.type);
    });
    // Create document list
    sortedDocuments.forEach(doc => {
        const documentElement = document.createElement('div');
        documentElement.className = `gdds-document-item status-${doc.status}`;
        documentElement.dataset.documentId = doc.id;
        // Status text based on document status
        const statusText = {
            [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.NotStarted]: 'Not Started',
            [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.InProgress]: 'In Progress',
            [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.Completed]: 'Completed'
        }[doc.status] || 'Unknown';
        documentElement.innerHTML = `
      <div class="gdds-document-info">
        <span class="gdds-document-title">${doc.title}</span>
        <span class="gdds-document-status">${statusText}</span>
      </div>
      <div class="gdds-document-actions">
        ${doc.status === _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.NotStarted
            ? '<button class="gdds-button small create-doc">Create</button>'
            : '<button class="gdds-button small view-doc">View</button>'}
        ${doc.status === _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.Completed
            ? '<button class="gdds-button small icon-only export-doc"><span class="gdds-icon">⬇</span></button>'
            : ''}
      </div>
    `;
        documentsContainer.appendChild(documentElement);
        // Add event listeners for document actions
        const createButton = documentElement.querySelector('.create-doc');
        if (createButton) {
            createButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startDocumentCreation(project.id, doc.id);
            });
        }
        const viewButton = documentElement.querySelector('.view-doc');
        if (viewButton) {
            viewButton.addEventListener('click', () => {
                viewDocument(project.id, doc.id);
            });
        }
        const exportButton = documentElement.querySelector('.export-doc');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                exportDocument(project.id, doc.id);
            });
        }
    });
}
// Inject our custom document interface
function injectDocumentInterface(documentTitle) {
    // Add document mode class to body
    document.body.classList.add('gdds-document-mode');
    // Create our interface
    const interfaceElement = document.createElement('div');
    interfaceElement.className = 'gdds-document-interface';
    interfaceElement.innerHTML = `
    <div class="gdds-header">
      <h1>${documentTitle}</h1>
    </div>
    <div class="gdds-chat-area">
      <div class="gdds-message gdds-assistant-message">
        <div class="prose dark:prose-invert">
          <p>Hi, I'm here to help you find the vision of your game. Feel free to explain it to me however works best for you. Afterwards, I'll ask you some questions and we'll figure it out together.</p>
        </div>
      </div>
    </div>
    <div class="gdds-input-area">
      <textarea placeholder="Tell me about your game idea..." rows="3"></textarea>
    </div>
  `;
    // Find Claude's main content area
    const mainContent = document.querySelector('main');
    if (mainContent) {
        // Add class to hide Claude's interface
        mainContent.classList.add('claude-default-interface');
        // Insert our interface before Claude's
        mainContent.parentElement?.insertBefore(interfaceElement, mainContent);
    }
    // Setup input handling
    const textarea = interfaceElement.querySelector('textarea');
    if (textarea) {
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = textarea.value.trim();
                if (message) {
                    // Add user message to chat
                    addMessage(message, 'user');
                    textarea.value = '';
                    // Clear the prompt text
                    const promptText = document.querySelector('.gdds-chat-area > .gdds-message:first-child');
                    if (promptText) {
                        promptText.remove();
                    }
                    // Send to Claude and handle response
                    _prompts_claudeInterface__WEBPACK_IMPORTED_MODULE_2__.ClaudeInterface.sendMessageToClaude(message)
                        .then(() => {
                        // Message sent and response received successfully
                        console.log('Message handled by Claude');
                    })
                        .catch((error) => {
                        console.error('Error sending message to Claude:', error);
                        showNotification('Error communicating with Claude', 'error');
                    });
                }
            }
        });
    }
}
// Add a message to our chat
function addMessage(text, type) {
    const chatArea = document.querySelector('.gdds-chat-area');
    if (chatArea) {
        const message = document.createElement('div');
        message.className = `gdds-message gdds-${type}-message`;
        if (type === 'assistant') {
            message.innerHTML = `
        <div class="prose dark:prose-invert">
          <p>${text}</p>
        </div>
      `;
        }
        else {
            message.textContent = text;
        }
        chatArea.appendChild(message);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}
// Start document creation process
async function startDocumentCreation(projectId, documentId) {
    console.log(`Starting document creation: Project ${projectId}, Document ${documentId}`);
    // Get the project and document
    chrome.runtime.sendMessage({ type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.GetProject, payload: { projectId } }, async (response) => {
        if (response.success && response.data) {
            const project = response.data;
            const gameDoc = project.documents[documentId];
            if (gameDoc) {
                try {
                    console.log('Starting document creation with type:', gameDoc.type);
                    // Inject our custom interface
                    injectDocumentInterface(gameDoc.title);
                    // Let the promptManager handle system prompt and welcome message
                    await _prompts_promptManager__WEBPACK_IMPORTED_MODULE_1__.PromptManager.startDocumentCreation(gameDoc.type);
                    console.log('Document creation started successfully');
                    // Update document status
                    gameDoc.status = _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.InProgress;
                    chrome.runtime.sendMessage({
                        type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.UpdateDocument,
                        payload: { document: gameDoc }
                    });
                    showNotification('Document creation started', 'success');
                }
                catch (error) {
                    console.error('Error during document creation:', error);
                    showNotification('Error starting document creation', 'error');
                }
            }
            else {
                showNotification('Error: Document not found', 'error');
            }
        }
        else {
            showNotification('Error: Could not load project', 'error');
        }
    });
}
// View document
function viewDocument(projectId, documentId) {
    console.log(`Viewing document: Project ${projectId}, Document ${documentId}`);
    // Will be implemented in next phase - for now just show notification
    showNotification('Document viewing will be implemented in the next phase', 'info');
}
// Export document
function exportDocument(projectId, documentId) {
    console.log(`Exporting document: Project ${projectId}, Document ${documentId}`);
    // Will be implemented in next phase - for now just show notification
    showNotification('Document export will be implemented in the next phase', 'info');
}
// Show delete confirmation dialog
function showDeleteConfirmation(project) {
    const dialog = document.createElement('div');
    dialog.className = 'gdds-dialog';
    dialog.innerHTML = `
    <div class="gdds-dialog-content">
      <h3>Delete Project</h3>
      <p>Are you sure you want to delete "${project.name}"? This action cannot be undone.</p>
      <div class="gdds-form-actions">
        <button type="button" class="gdds-button secondary" id="gdds-cancel-delete">Cancel</button>
        <button type="button" class="gdds-button danger" id="gdds-confirm-delete">Delete</button>
      </div>
    </div>
  `;
    // Add to DOM
    document.body.appendChild(dialog);
    // Setup cancel button
    const cancelButton = document.getElementById('gdds-cancel-delete');
    if (cancelButton) {
        cancelButton.addEventListener('click', closeDialog);
    }
    // Setup confirm button
    const confirmButton = document.getElementById('gdds-confirm-delete');
    if (confirmButton) {
        confirmButton.addEventListener('click', () => {
            deleteProject(project.id);
            closeDialog();
        });
    }
    // Close dialog function
    function closeDialog() {
        document.body.removeChild(dialog);
    }
}
// Delete project
function deleteProject(projectId) {
    chrome.runtime.sendMessage({ type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.DeleteProject, payload: { projectId } }, (response) => {
        if (response.success) {
            console.log('Project deleted:', projectId);
            loadProjects();
            showNotification('Project deleted successfully', 'success');
        }
        else {
            console.error('Failed to delete project:', response.error);
            showNotification('Error deleting project', 'error');
        }
    });
}
// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gdds-notification ${type}`;
    notification.innerHTML = `
    <div class="gdds-notification-content">
      <span class="gdds-notification-message">${message}</span>
      <button class="gdds-notification-close">✕</button>
    </div>
  `;
    // Add to DOM
    document.body.appendChild(notification);
    // Add close button listener
    const closeButton = notification.querySelector('.gdds-notification-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            document.body.removeChild(notification);
        });
    }
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

})();

/******/ })()
;
//# sourceMappingURL=content.js.map