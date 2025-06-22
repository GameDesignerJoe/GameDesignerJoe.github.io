// Document types supported by the system
export enum DocumentType {
  GameVision = 'game_vision',
  CoreGameConcept = 'core_game_concept',
  TargetAudience = 'target_audience',
  CorePillarsValues = 'core_pillars_values',
  WhyPlayIt = 'why_play_it',
  WhatShouldTheyFeel = 'what_should_they_feel',
  UniqueSellingPoints = 'unique_selling_points',
  GameLoop = 'game_loop',
  PlayerJourney = 'player_journey',
  StoryOverview = 'story_overview',
  Presentation = 'presentation',
  KeyQuestions = 'key_questions',
  CoreDesignDetails = 'core_design_details',
  StrategicDirection = 'strategic_direction'
}

// Document status
export enum DocumentStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed'
}

// Project structure
export interface GameProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  documents: Record<string, GameDocument>;
}

// Document structure
export interface GameDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  title: string;
  content: string;
  status: DocumentStatus;
  createdAt: number;
  updatedAt: number;
  versions: DocumentVersion[];
}

// Document version
export interface DocumentVersion {
  versionNumber: number;
  content: string;
  createdAt: number;
  notes: string;
}

// Message types for communication between components
export enum MessageType {
  GetProjects = 'get_projects',
  CreateProject = 'create_project',
  UpdateProject = 'update_project',
  DeleteProject = 'delete_project',
  GetProject = 'get_project',
  CreateDocument = 'create_document',
  UpdateDocument = 'update_document',
  GetDocument = 'get_document',
  DeleteDocument = 'delete_document',
  StartDocumentCreation = 'start_document_creation'
}

// Message structure
export interface Message {
  type: MessageType;
  payload: any;
}

// Response structure
export interface Response {
  success: boolean;
  data?: any;
  error?: string;
}

// LLM Provider Types
export type LLMProvider = 'claude' | 'claude-api' | 'gpt4' | 'gemini' | 'local';
