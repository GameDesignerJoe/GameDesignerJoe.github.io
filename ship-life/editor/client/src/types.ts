export interface DropdownOptions {
  guardians: string[];
  items: string[];
  missions: string[];
  workstations: string[];
  blueprints: string[];
  rooms: string[];
  anomalies: string[];
  trophies: string[];
  conversationTypes: string[];
  playerCharReq: string[];
}

export interface OpenFile {
  name: string;
  data: any;
  activeTab: number;
  isDirty: boolean;
  saveStatus?: 'saving' | 'saved' | 'error';
}

export interface FileListResponse {
  files: string[];
}

export interface FileDataResponse {
  filename: string;
  data: any;
}

export interface SaveResponse {
  success: boolean;
  filename: string;
}
