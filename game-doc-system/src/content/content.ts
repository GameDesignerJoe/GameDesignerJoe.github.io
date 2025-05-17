import { MessageType, GameProject, DocumentType, DocumentStatus } from '../shared/types';

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

// Create new project
function createProject(name: string) {
  chrome.runtime.sendMessage(
    { type: MessageType.CreateProject, payload: { name } },
    (response) => {
      if (response.success) {
        console.log('Project created:', response.data);
        loadProjects();
      } else {
        console.error('Failed to create project:', response.error);
        showNotification('Error creating project', 'error');
      }
    }
  );
}

// Load projects from storage
function loadProjects() {
  const projectsContainer = document.querySelector('.gdds-projects-container');
  if (projectsContainer) {
    projectsContainer.innerHTML = '<div class="gdds-loading">Loading projects...</div>';
    
    chrome.runtime.sendMessage(
      { type: MessageType.GetProjects, payload: {} },
      (response) => {
        if (response.success) {
          renderProjects(response.data || {});
        } else {
          console.error('Failed to load projects:', response.error);
          projectsContainer.innerHTML = '<div class="gdds-error">Error loading projects</div>';
        }
      }
    );
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

import { PromptManager } from '../prompts/promptManager';

// Start document creation process
async function startDocumentCreation(projectId: string, documentId: string) {
  console.log(`Starting document creation: Project ${projectId}, Document ${documentId}`);
  
  // Get the project and document
  chrome.runtime.sendMessage(
    { type: MessageType.GetProject, payload: { projectId } },
    async (response) => {
      if (response.success && response.data) {
        const project = response.data;
        const document = project.documents[documentId];
        
        if (document) {
          try {
            // Start the document creation process
            await PromptManager.startDocumentCreation(document.type);
            
                    // Get the prompt template again since we need it for monitoring
                    const promptTemplate = PromptManager.getPromptForDocument(document.type);
                    if (promptTemplate) {
                      // Start monitoring for responses
                      PromptManager.monitorResponse(promptTemplate);
                    }
            
            // Update document status
            document.status = DocumentStatus.InProgress;
            chrome.runtime.sendMessage(
              { 
                type: MessageType.UpdateDocument, 
                payload: { document }
              }
            );
          } catch (error) {
            console.error('Error during document creation:', error);
            showNotification('Error creating document', 'error');
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
