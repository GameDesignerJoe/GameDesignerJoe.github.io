/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/shared/storage.ts":
/*!*******************************!*\
  !*** ./src/shared/storage.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   StorageManager: () => (/* binding */ StorageManager),
/* harmony export */   storageManager: () => (/* binding */ storageManager)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./types */ "./src/shared/types.ts");

class StorageManager {
    // Initialize storage
    async initialize() {
        const existingData = await this.getProjects();
        if (!existingData) {
            await chrome.storage.local.set({ projects: {} });
            console.log('Storage initialized with empty projects');
        }
    }
    // Get all projects
    async getProjects() {
        const data = await chrome.storage.local.get('projects');
        return data.projects || null;
    }
    // Get specific project
    async getProject(projectId) {
        const projects = await this.getProjects();
        return projects && projects[projectId] ? projects[projectId] : null;
    }
    // Create new project
    async createProject(name) {
        const projects = await this.getProjects() || {};
        const projectId = 'project_' + Date.now();
        const timestamp = Date.now();
        const newProject = {
            id: projectId,
            name,
            createdAt: timestamp,
            updatedAt: timestamp,
            documents: this.createInitialDocuments(projectId)
        };
        projects[projectId] = newProject;
        await chrome.storage.local.set({ projects });
        return newProject;
    }
    // Create the initial document set for a new project
    createInitialDocuments(projectId) {
        const documents = {};
        const timestamp = Date.now();
        // Create a document entry for each document type
        Object.values(_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType).forEach((type) => {
            const documentId = `${projectId}_${type}`;
            documents[documentId] = {
                id: documentId,
                projectId,
                type: type,
                title: this.getDefaultTitle(type),
                content: '',
                status: _types__WEBPACK_IMPORTED_MODULE_0__.DocumentStatus.NotStarted,
                createdAt: timestamp,
                updatedAt: timestamp,
                versions: []
            };
        });
        return documents;
    }
    // Get default title for each document type
    getDefaultTitle(type) {
        const titles = {
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameVision]: 'Game Vision',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CoreGameConcept]: 'Core Game Concept',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.TargetAudience]: 'Target Audience',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CorePillarsValues]: 'Core Pillars and Values',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.WhyPlayIt]: 'Why Would They Play It?',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.WhatShouldTheyFeel]: 'What Should They Feel?',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.UniqueSellingPoints]: 'Unique Selling Points',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.GameLoop]: 'Game Loop',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.PlayerJourney]: 'Player Journey',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.StoryOverview]: 'Story Overview',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.Presentation]: 'Presentation',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.KeyQuestions]: 'Key Questions',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.CoreDesignDetails]: 'Core Design Details',
            [_types__WEBPACK_IMPORTED_MODULE_0__.DocumentType.StrategicDirection]: 'Strategic Direction'
        };
        return titles[type] || 'Untitled Document';
    }
    // Update document
    async updateDocument(document) {
        const projects = await this.getProjects();
        if (!projects)
            throw new Error('No projects found');
        const project = projects[document.projectId];
        if (!project)
            throw new Error('Project not found');
        // Create new version if content changed
        const existingDoc = project.documents[document.id];
        if (existingDoc && existingDoc.content !== document.content && existingDoc.content !== '') {
            const newVersion = {
                versionNumber: existingDoc.versions.length + 1,
                content: existingDoc.content,
                createdAt: Date.now(),
                notes: 'Automatic version created'
            };
            document.versions = [...existingDoc.versions, newVersion];
        }
        document.updatedAt = Date.now();
        project.documents[document.id] = document;
        project.updatedAt = Date.now();
        await chrome.storage.local.set({ projects });
        return document;
    }
    // Delete project
    async deleteProject(projectId) {
        const projects = await this.getProjects();
        if (!projects)
            return;
        delete projects[projectId];
        await chrome.storage.local.set({ projects });
    }
}
// Create a singleton instance
const storageManager = new StorageManager();


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
/*!**************************************!*\
  !*** ./src/background/background.ts ***!
  \**************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _shared_storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/storage */ "./src/shared/storage.ts");
/* harmony import */ var _shared_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/types */ "./src/shared/types.ts");


// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Game Development Document System installed/updated');
    await _shared_storage__WEBPACK_IMPORTED_MODULE_0__.storageManager.initialize();
});
// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
        .then(sendResponse)
        .catch(error => {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    });
    // Return true to indicate we'll respond asynchronously
    return true;
});
// Handle messages based on their type
async function handleMessage(message) {
    console.log('Background received message:', message);
    const { type, payload } = message;
    try {
        switch (type) {
            case _shared_types__WEBPACK_IMPORTED_MODULE_1__.MessageType.GetProjects:
                const projects = await _shared_storage__WEBPACK_IMPORTED_MODULE_0__.storageManager.getProjects();
                return { success: true, data: projects };
            case _shared_types__WEBPACK_IMPORTED_MODULE_1__.MessageType.CreateProject:
                const project = await _shared_storage__WEBPACK_IMPORTED_MODULE_0__.storageManager.createProject(payload.name);
                return { success: true, data: project };
            case _shared_types__WEBPACK_IMPORTED_MODULE_1__.MessageType.GetProject:
                const foundProject = await _shared_storage__WEBPACK_IMPORTED_MODULE_0__.storageManager.getProject(payload.projectId);
                return { success: true, data: foundProject };
            case _shared_types__WEBPACK_IMPORTED_MODULE_1__.MessageType.UpdateDocument:
                const updatedDoc = await _shared_storage__WEBPACK_IMPORTED_MODULE_0__.storageManager.updateDocument(payload.document);
                return { success: true, data: updatedDoc };
            case _shared_types__WEBPACK_IMPORTED_MODULE_1__.MessageType.DeleteProject:
                await _shared_storage__WEBPACK_IMPORTED_MODULE_0__.storageManager.deleteProject(payload.projectId);
                return { success: true };
            default:
                return { success: false, error: `Unknown message type: ${type}` };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

})();

/******/ })()
;
//# sourceMappingURL=background.js.map