import { useState, useEffect } from 'react';
import type { DropdownOptions, FileListResponse, FileDataResponse, SaveResponse } from '../types';

const API_BASE = '/api';

export function useApi() {
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);

  useEffect(() => {
    loadDropdownOptions();
    loadFileList();
  }, []);

  const loadDropdownOptions = async () => {
    try {
      const response = await fetch(`${API_BASE}/files/meta/dropdown-options`);
      const data = await response.json();
      setDropdownOptions(data);
    } catch (error) {
      console.error('Failed to load dropdown options:', error);
    }
  };

  const loadFileList = async () => {
    try {
      const response = await fetch(`${API_BASE}/files`);
      const data: FileListResponse = await response.json();
      setAvailableFiles(data.files);
    } catch (error) {
      console.error('Failed to load file list:', error);
    }
  };

  const listFiles = async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE}/files`);
    const data: FileListResponse = await response.json();
    return data.files;
  };

  const loadFile = async (filename: string): Promise<FileDataResponse> => {
    const response = await fetch(`${API_BASE}/files/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    return response.json();
  };

  const saveFile = async (filename: string, data: any): Promise<SaveResponse> => {
    const response = await fetch(`${API_BASE}/files/${filename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save ${filename}`);
    }
    
    // Reload dropdown options after save (in case new items were added)
    await loadDropdownOptions();
    
    return response.json();
  };

  return {
    dropdownOptions,
    availableFiles,
    listFiles,
    loadFile,
    saveFile,
    reloadDropdownOptions: loadDropdownOptions,
    reloadFileList: loadFileList
  };
}
