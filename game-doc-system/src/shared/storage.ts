import { GameProject, GameDocument, DocumentType, DocumentStatus, DocumentVersion } from './types';

export class StorageManager {
  // Initialize storage
  public async initialize(): Promise<void> {
    const existingData = await this.getProjects();
    
    if (!existingData) {
      await chrome.storage.local.set({ projects: {} });
      console.log('Storage initialized with empty projects');
    }
  }
  
  // Get all projects
  public async getProjects(): Promise<Record<string, GameProject> | null> {
    const data = await chrome.storage.local.get('projects');
    return data.projects || null;
  }
  
  // Get specific project
  public async getProject(projectId: string): Promise<GameProject | null> {
    const projects = await this.getProjects();
    return projects && projects[projectId] ? projects[projectId] : null;
  }
  
  // Create new project
  public async createProject(name: string): Promise<GameProject> {
    const projects = await this.getProjects() || {};
    
    const projectId = 'project_' + Date.now();
    const timestamp = Date.now();
    
    const newProject: GameProject = {
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
  private createInitialDocuments(projectId: string): Record<string, GameDocument> {
    const documents: Record<string, GameDocument> = {};
    const timestamp = Date.now();
    
    // Create a document entry for each document type
    Object.values(DocumentType).forEach((type) => {
      const documentId = `${projectId}_${type}`;
      
      documents[documentId] = {
        id: documentId,
        projectId,
        type: type as DocumentType,
        title: this.getDefaultTitle(type as DocumentType),
        content: '',
        status: DocumentStatus.NotStarted,
        createdAt: timestamp,
        updatedAt: timestamp,
        versions: []
      };
    });
    
    return documents;
  }
  
  // Get default title for each document type
  private getDefaultTitle(type: DocumentType): string {
    const titles: Record<DocumentType, string> = {
      [DocumentType.GameVision]: 'Game Vision',
      [DocumentType.CoreGameConcept]: 'Core Game Concept',
      [DocumentType.TargetAudience]: 'Target Audience',
      [DocumentType.CorePillarsValues]: 'Core Pillars and Values',
      [DocumentType.WhyPlayIt]: 'Why Would They Play It?',
      [DocumentType.WhatShouldTheyFeel]: 'What Should They Feel?',
      [DocumentType.UniqueSellingPoints]: 'Unique Selling Points',
      [DocumentType.GameLoop]: 'Game Loop',
      [DocumentType.PlayerJourney]: 'Player Journey',
      [DocumentType.StoryOverview]: 'Story Overview',
      [DocumentType.Presentation]: 'Presentation',
      [DocumentType.KeyQuestions]: 'Key Questions',
      [DocumentType.CoreDesignDetails]: 'Core Design Details',
      [DocumentType.StrategicDirection]: 'Strategic Direction'
    };
    
    return titles[type] || 'Untitled Document';
  }
  
  // Update document
  public async updateDocument(document: GameDocument): Promise<GameDocument> {
    const projects = await this.getProjects();
    if (!projects) throw new Error('No projects found');
    
    const project = projects[document.projectId];
    if (!project) throw new Error('Project not found');
    
    // Create new version if content changed
    const existingDoc = project.documents[document.id];
    if (existingDoc && existingDoc.content !== document.content && existingDoc.content !== '') {
      const newVersion: DocumentVersion = {
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
  public async deleteProject(projectId: string): Promise<void> {
    const projects = await this.getProjects();
    if (!projects) return;
    
    delete projects[projectId];
    await chrome.storage.local.set({ projects });
  }
}

// Create a singleton instance
export const storageManager = new StorageManager();
