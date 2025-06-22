import { MessageType, GameProject, DocumentType, DocumentStatus } from '../shared/types';
import { PromptManager } from '../prompts/promptManager';
import { ClaudeInterface } from '../prompts/claudeInterface';

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
}).observe(document, {subtree: true, childList: true});

// Add a message to Claude's interface
function addClaudeMessage(message: string) {
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
    const input = document.querySelector('textarea.ProseMirror, [contenteditable="true"]') as HTMLElement;
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
function showNewProjectDialog(): void {
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
  const nameInput = document.getElementById('project-name') as HTMLInputElement;
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

interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: any;
}

// Create new project
async function createProject(name: string) {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, reloading page');
      window.location.reload();
      return;
    }

    const response = await new Promise<ExtensionResponse>((resolve) => {
      try {
  chrome.runtime.sendMessage(
    { type: MessageType.CreateProject, payload: { name } },
          (response: ExtensionResponse) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError });
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        resolve({ success: false, error });
      }
    });

      if (response.success) {
        console.log('Project created:', response.data);
      await loadProjects();
      } else {
        console.error('Failed to create project:', response.error);
        showNotification('Error creating project', 'error');
      }
  } catch (error) {
    console.error('Error in createProject:', error);
    showNotification('Error creating project. Please refresh the page and try again.', 'error');
    }
}

// Load projects from storage
async function loadProjects() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime) {
      console.log('Extension context invalid, reloading page');
      window.location.reload();
      return;
    }

  const projectsContainer = document.querySelector('.gdds-projects-container');
    if (!projectsContainer) return;

    projectsContainer.innerHTML = '<div class="gdds-loading">Loading projects...</div>';
    
    const response = await new Promise<ExtensionResponse>((resolve) => {
      try {
    chrome.runtime.sendMessage(
      { type: MessageType.GetProjects, payload: {} },
          (response: ExtensionResponse) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError });
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        resolve({ success: false, error });
      }
    });

        if (response.success) {
          renderProjects(response.data || {});
        } else {
          console.error('Failed to load projects:', response.error);
      projectsContainer.innerHTML = `
        <div class="gdds-error">
          Error loading projects
          <button class="gdds-button secondary" onclick="window.location.reload()">Refresh Page</button>
        </div>
      `;
        }
  } catch (error) {
    console.error('Error in loadProjects:', error);
    const projectsContainer = document.querySelector('.gdds-projects-container');
    if (projectsContainer) {
      projectsContainer.innerHTML = `
        <div class="gdds-error">
          Error loading projects
          <button class="gdds-button secondary" onclick="window.location.reload()">Refresh Page</button>
        </div>
      `;
    }
  }
}

// Render projects list
function renderProjects(projects: Record<string, GameProject>) {
  const projectsContainer = document.querySelector('.gdds-projects-container');
  if (!projectsContainer) return;
  
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
  const sortedProjects = Object.values(projects).sort((a, b) => 
    b.createdAt - a.createdAt
  );
  
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
function toggleProjectDocuments(projectId: string) {
  const projectElement = document.querySelector(`[data-project-id="${projectId}"]`);
  if (!projectElement) return;
  
  const documentsContainer = projectElement.querySelector('.gdds-project-documents') as HTMLElement;
  if (!documentsContainer) return;
  
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
function loadProjectDocuments(projectId: string) {
  chrome.runtime.sendMessage(
    { type: MessageType.GetProject, payload: { projectId } },
    (response) => {
      if (response.success && response.data) {
        renderProjectDocuments(response.data);
      } else {
        console.error('Failed to load project documents:', response.error);
      }
    }
  );
}

// Render documents for a project
function renderProjectDocuments(project: GameProject) {
  const projectElement = document.querySelector(`[data-project-id="${project.id}"]`);
  if (!projectElement) return;
  
  const documentsContainer = projectElement.querySelector('.gdds-project-documents');
  if (!documentsContainer) return;
  
  // Clear previous content
  documentsContainer.innerHTML = '';
  
  // Define the document type order
  const documentTypeOrder = [
    DocumentType.GameVision,
    DocumentType.CoreGameConcept,
    DocumentType.TargetAudience,
    DocumentType.CorePillarsValues,
    DocumentType.WhyPlayIt,
    DocumentType.WhatShouldTheyFeel,
    DocumentType.UniqueSellingPoints,
    DocumentType.GameLoop,
    DocumentType.PlayerJourney,
    DocumentType.StoryOverview,
    DocumentType.Presentation,
    DocumentType.KeyQuestions,
    DocumentType.CoreDesignDetails,
    DocumentType.StrategicDirection
  ];
  
  // Sort documents by the defined order
  const sortedDocuments = Object.values(project.documents).sort((a, b) => {
    return documentTypeOrder.indexOf(a.type as DocumentType) -
           documentTypeOrder.indexOf(b.type as DocumentType);
  });
  
  // Create document list
  sortedDocuments.forEach(doc => {
    const documentElement = document.createElement('div');
    documentElement.className = `gdds-document-item status-${doc.status}`;
    documentElement.dataset.documentId = doc.id;
    
    // Status text based on document status
    const statusText = {
      [DocumentStatus.NotStarted]: 'Not Started',
      [DocumentStatus.InProgress]: 'In Progress',
      [DocumentStatus.Completed]: 'Completed'
    }[doc.status] || 'Unknown';
    
    documentElement.innerHTML = `
      <div class="gdds-document-info">
        <span class="gdds-document-title">${doc.title}</span>
        <span class="gdds-document-status">${statusText}</span>
      </div>
      <div class="gdds-document-actions">
        ${doc.status === DocumentStatus.NotStarted 
          ? '<button class="gdds-button small create-doc">Create</button>'
          : '<button class="gdds-button small view-doc">View</button>'}
        ${doc.status === DocumentStatus.Completed 
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
function injectDocumentInterface(documentTitle: string) {
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
          ClaudeInterface.sendMessageToClaude(message)
            .then(() => {
              // Message sent and response received successfully
              console.log('Message handled by Claude');
            })
            .catch((error: Error) => {
              console.error('Error sending message to Claude:', error);
              showNotification('Error communicating with Claude', 'error');
            });
        }
      }
    });
  }
}

// Add a message to our chat
function addMessage(text: string, type: 'user' | 'assistant') {
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
    } else {
      message.textContent = text;
    }
    
    chatArea.appendChild(message);
    chatArea.scrollTop = chatArea.scrollHeight;
  }
}

// Start document creation process
async function startDocumentCreation(projectId: string, documentId: string) {
  console.log(`Starting document creation: Project ${projectId}, Document ${documentId}`);
  
  // Get the project and document
  chrome.runtime.sendMessage(
    { type: MessageType.GetProject, payload: { projectId } },
    async (response) => {
      if (response.success && response.data) {
        const project = response.data;
        const gameDoc = project.documents[documentId];
        
        if (gameDoc) {
          try {
            console.log('Starting document creation with type:', gameDoc.type);
            
            // Inject our custom interface
            injectDocumentInterface(gameDoc.title);
            
            // Let the promptManager handle system prompt and welcome message
            await PromptManager.startDocumentCreation(gameDoc.type as DocumentType);
            console.log('Document creation started successfully');
            
            // Update document status
            gameDoc.status = DocumentStatus.InProgress;
            chrome.runtime.sendMessage(
              { 
                type: MessageType.UpdateDocument, 
                payload: { document: gameDoc }
              }
            );

            showNotification('Document creation started', 'success');
          } catch (error) {
            console.error('Error during document creation:', error);
            showNotification('Error starting document creation', 'error');
          }
        } else {
          showNotification('Error: Document not found', 'error');
        }
      } else {
        showNotification('Error: Could not load project', 'error');
      }
    }
  );
}

// View document
function viewDocument(projectId: string, documentId: string) {
  console.log(`Viewing document: Project ${projectId}, Document ${documentId}`);
  
  // Will be implemented in next phase - for now just show notification
  showNotification('Document viewing will be implemented in the next phase', 'info');
}

// Export document
function exportDocument(projectId: string, documentId: string) {
  console.log(`Exporting document: Project ${projectId}, Document ${documentId}`);
  
  // Will be implemented in next phase - for now just show notification
  showNotification('Document export will be implemented in the next phase', 'info');
}

// Show delete confirmation dialog
function showDeleteConfirmation(project: GameProject) {
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
function deleteProject(projectId: string) {
  chrome.runtime.sendMessage(
    { type: MessageType.DeleteProject, payload: { projectId } },
    (response) => {
      if (response.success) {
        console.log('Project deleted:', projectId);
        loadProjects();
        showNotification('Project deleted successfully', 'success');
      } else {
        console.error('Failed to delete project:', response.error);
        showNotification('Error deleting project', 'error');
      }
    }
  );
}

// Show notification
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
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
