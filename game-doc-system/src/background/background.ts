import { StorageManager, storageManager } from '../shared/storage';
import { MessageType, Response } from '../shared/types';

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Game Development Document System installed/updated');
  await storageManager.initialize();
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
async function handleMessage(message: any): Promise<Response> {
  console.log('Background received message:', message);
  
  const { type, payload } = message;
  
  try {
    switch (type) {
      case MessageType.GetProjects:
        const projects = await storageManager.getProjects();
        return { success: true, data: projects };
        
      case MessageType.CreateProject:
        const project = await storageManager.createProject(payload.name);
        return { success: true, data: project };
        
      case MessageType.GetProject:
        const foundProject = await storageManager.getProject(payload.projectId);
        return { success: true, data: foundProject };
        
      case MessageType.UpdateDocument:
        const updatedDoc = await storageManager.updateDocument(payload.document);
        return { success: true, data: updatedDoc };
        
      case MessageType.DeleteProject:
        await storageManager.deleteProject(payload.projectId);
        return { success: true };
        
      default:
        return { success: false, error: `Unknown message type: ${type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
