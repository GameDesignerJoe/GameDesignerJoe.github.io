import { MessageType } from '../shared/types';

// When popup loads
document.addEventListener('DOMContentLoaded', () => {
  // Check connection status
  checkConnectionStatus();
  
  // Load project count
  loadProjectCount();
  
  // Setup open Claude button
  const openClaudeButton = document.getElementById('open-claude');
  if (openClaudeButton) {
    openClaudeButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://claude.ai' });
    });
  }
});

// Check if we're connected to Claude.ai
function checkConnectionStatus() {
  const statusElement = document.getElementById('connection-status');
  if (!statusElement) return;
  
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    if (tabs.length > 0) {
      statusElement.textContent = 'Connected to Claude.ai';
      statusElement.style.color = '#4caf50'; // Green
    } else {
      statusElement.textContent = 'Not connected to Claude.ai';
      statusElement.style.color = '#ff9800'; // Orange
    }
  });
}

// Get project count
function loadProjectCount() {
  const countElement = document.getElementById('project-count');
  if (!countElement) return;
  
  chrome.runtime.sendMessage(
    { type: MessageType.GetProjects, payload: {} },
    (response) => {
      if (response.success) {
        const projects = response.data || {};
        const count = Object.keys(projects).length;
        countElement.textContent = `Projects: ${count}`;
      } else {
        countElement.textContent = 'Error loading projects';
      }
    }
  );
}
