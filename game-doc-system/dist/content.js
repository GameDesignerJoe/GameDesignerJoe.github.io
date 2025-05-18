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

const DOCUMENT_PROMPTS = {
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameVision]: {
        welcomeMessage: "Let's define your game vision. Why don't you tell me about your game?",
        placeholderText: "Write whatever feels natural - paragraphs, bullets, catch phrases, etc."
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CoreGameConcept]: {
        welcomeMessage: "Let's outline your core game concept. What's the fundamental gameplay experience?",
        placeholderText: "Describe the core gameplay loop, key mechanics, or main activities"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.TargetAudience]: {
        welcomeMessage: "Let's identify your target audience. Who are you making this game for?",
        placeholderText: "Consider age groups, interests, gaming experience, platforms they use"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CorePillarsValues]: {
        welcomeMessage: "Let's establish your core pillars and values. What principles guide your game design?",
        placeholderText: "List key values, design pillars, or guiding principles"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.WhyPlayIt]: {
        welcomeMessage: "Let's explore why players will love your game. What makes it compelling?",
        placeholderText: "Think about player motivations, rewards, and satisfaction"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.WhatShouldTheyFeel]: {
        welcomeMessage: "Let's define the emotional journey. How should players feel while playing?",
        placeholderText: "Describe emotions, moods, or feelings you want to evoke"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.UniqueSellingPoints]: {
        welcomeMessage: "Let's identify what makes your game unique. What sets it apart?",
        placeholderText: "List unique features, innovations, or special qualities"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameLoop]: {
        welcomeMessage: "Let's detail your game loop. What keeps players engaged moment to moment?",
        placeholderText: "Describe core activities, feedback loops, and progression"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.PlayerJourney]: {
        welcomeMessage: "Let's map the player's journey. How do they progress through your game?",
        placeholderText: "Outline key stages, milestones, or story beats"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.StoryOverview]: {
        welcomeMessage: "Let's craft your story overview. What tale does your game tell?",
        placeholderText: "Share plot points, character arcs, or narrative themes"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.Presentation]: {
        welcomeMessage: "Let's plan your game's presentation. How will it look and feel?",
        placeholderText: "Describe art style, audio direction, or visual themes"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.KeyQuestions]: {
        welcomeMessage: "Let's address key questions about your game. What needs to be resolved?",
        placeholderText: "List critical questions, concerns, or decisions to make"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CoreDesignDetails]: {
        welcomeMessage: "Let's detail your core design. What are the essential mechanics?",
        placeholderText: "Describe key systems, rules, or gameplay elements"
    },
    [_shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.StrategicDirection]: {
        welcomeMessage: "Let's plan your strategic direction. Where is this game headed?",
        placeholderText: "Outline goals, milestones, or development priorities"
    }
};
class PromptManager {
    static getPromptForDocument(type) {
        return DOCUMENT_PROMPTS[type] || null;
    }
    static async startDocumentCreation(type) {
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
        });
        if (welcomeElement) {
            // Store the original styles
            const styles = window.getComputedStyle(welcomeElement);
            const originalColor = styles.color;
            const originalFont = styles.font;
            const originalSize = styles.fontSize;
            // Update text while preserving styling
            welcomeElement.innerHTML = `<span style="color: ${originalColor}; font: ${originalFont}; font-size: ${originalSize};">${prompt.welcomeMessage}</span>`;
        }
        else {
            console.error('Could not find welcome message element');
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
                    // Update welcome message for this document type
                    await _prompts_promptManager__WEBPACK_IMPORTED_MODULE_1__.PromptManager.startDocumentCreation(document.type);
                    // Update document status
                    document.status = _shared_types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.InProgress;
                    chrome.runtime.sendMessage({
                        type: _shared_types__WEBPACK_IMPORTED_MODULE_0__.MessageType.UpdateDocument,
                        payload: { document }
                    });
                    showNotification('Document creation started', 'success');
                }
                catch (error) {
                    console.error('Error during document creation:', error);
                    showNotification('Error updating welcome message', 'error');
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