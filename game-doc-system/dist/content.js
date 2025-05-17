/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/prompts/promptManager.ts":
/*!**************************************!*\
  !*** ./src/prompts/promptManager.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PromptManager: () => (/* binding */ PromptManager)
/* harmony export */ });
/* harmony import */ var _shared_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/types */ "./src/shared/types.ts");

const GAME_VISION_PROMPT = {
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
class PromptManager {
    static getPromptForDocument(type) {
        return this.prompts[type] || null;
    }
    static async injectClaudeMessage(text) {
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
    static async injectPrompt(prompt) {
        // Send the initial prompt as a Claude message
        await this.injectClaudeMessage(prompt.initialPrompt);
        this.currentPromptStage = 'initial';
    }
    static async startDocumentCreation(type) {
        const prompt = this.getPromptForDocument(type);
        if (!prompt) {
            console.error(`No prompt template found for document type: ${type}`);
            return;
        }
        try {
            await this.injectPrompt(prompt);
            this.monitorResponse(prompt);
        }
        catch (error) {
            console.error('Error starting document creation:', error);
        }
    }
    static monitorResponse(prompt) {
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
    static async processResponse(content, prompt) {
        console.log('Captured response:', content);
        // Determine next prompt based on current stage
        let nextPrompt;
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
PromptManager.prompts = {
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameVision]: GAME_VISION_PROMPT,
    // Other document types will be added here
};
PromptManager.currentPromptStage = 'initial';


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
}
window.addEventListener('load', () => {
    // Check if we're on Claude.ai
    if (window.location.href.includes('claude.ai')) {
        console.log('Game Development Document System loaded on Claude.ai');
        // Inject styles
        injectStyles();
        // Give the UI time to render completely
        setTimeout(injectSidebar, 2000);
    }
});
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
    // Create sidebar element
    const sidebar = document.createElement('div');
    sidebar.id = 'gdds-sidebar';
    sidebar.className = 'gdds-sidebar';
    // Position sidebar after the main content
    mainContent.parentElement?.insertBefore(sidebar, mainContent.nextSibling);
    // Initial HTML for sidebar
    sidebar.innerHTML = `
    <div class="gdds-sidebar-header">
      <h3>Game Documents</h3>
      <button id="gdds-new-project" class="gdds-button primary">New Project</button>
      <button id="gdds-toggle-sidebar" class="gdds-button icon-only">
        <span class="gdds-icon">◀</span>
      </button>
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
        newProjectButton.addEventListener('click', showNewProjectDialog);
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
        // Update toggle button icon
        const toggleButton = document.getElementById('gdds-toggle-sidebar');
        if (toggleButton) {
            const icon = toggleButton.querySelector('.gdds-icon');
            if (icon) {
                icon.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
            }
        }
    }
}
// Show dialog to create new project
function showNewProjectDialog() {
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
          <button class="gdds-button icon-only project-expand">
            <span class="gdds-icon">▼</span>
          </button>
        </div>
      </div>
      <div class="gdds-project-documents" style="display: none;"></div>
    `;
        projectsList.appendChild(projectElement);
        // Add event listener for expand/collapse
        const expandButton = projectElement.querySelector('.project-expand');
        if (expandButton) {
            expandButton.addEventListener('click', () => {
                toggleProjectDocuments(project.id);
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
            createButton.addEventListener('click', () => {
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

// Start document creation process
async function startDocumentCreation(projectId, documentId) {
    console.log(`Starting document creation: Project ${projectId}, Document ${documentId}`);
    // Get the project and document
    chrome.runtime.sendMessage({ type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.GetProject, payload: { projectId } }, async (response) => {
        if (response.success && response.data) {
            const project = response.data;
            const document = project.documents[documentId];
            if (document) {
                try {
                    // Start the document creation process
                    await _prompts_promptManager__WEBPACK_IMPORTED_MODULE_1__.PromptManager.startDocumentCreation(document.type);
                    // Get the prompt template again since we need it for monitoring
                    const promptTemplate = _prompts_promptManager__WEBPACK_IMPORTED_MODULE_1__.PromptManager.getPromptForDocument(document.type);
                    if (promptTemplate) {
                        // Start monitoring for responses
                        _prompts_promptManager__WEBPACK_IMPORTED_MODULE_1__.PromptManager.monitorResponse(promptTemplate);
                    }
                    // Update document status
                    document.status = _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.InProgress;
                    chrome.runtime.sendMessage({
                        type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.UpdateDocument,
                        payload: { document }
                    });
                }
                catch (error) {
                    console.error('Error during document creation:', error);
                    showNotification('Error creating document', 'error');
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