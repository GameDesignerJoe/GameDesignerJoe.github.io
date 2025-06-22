import { DocumentType } from '../shared/types';
import { TemplateManager } from '../templates/templateManager';

document.addEventListener('DOMContentLoaded', async () => {
    const messageInput = document.querySelector<HTMLTextAreaElement>('.message-input');
    const mainContent = document.querySelector<HTMLDivElement>('.main-content');
    const addDocumentBtn = document.querySelector<HTMLButtonElement>('.add-document-btn');
    const downloadBtn = document.querySelector<HTMLButtonElement>('.document-controls button[title="Download"]');
    const settingsBtn = document.querySelector<HTMLButtonElement>('.document-controls button[title="Settings"]');
    const templateModal = document.getElementById('templateSettings');
    const closeModalBtn = document.getElementById('closeModal');
    const saveChangesBtn = document.getElementById('saveChanges');
    const cancelChangesBtn = document.getElementById('cancelChanges');

    if (!messageInput || !mainContent || !templateModal) {
        console.error('Required elements not found');
        return;
    }

    let currentTemplate = null;

    // Load template settings
    async function loadTemplateSettings() {
        try {
            currentTemplate = await TemplateManager.getTemplate(DocumentType.GameVision);
            
            const purposeContent = document.querySelector<HTMLDivElement>('[data-section="purpose"] .template-section-content');
            if (purposeContent) {
                purposeContent.textContent = currentTemplate.settings.purpose;
            }

            const keyInfoList = document.querySelector<HTMLUListElement>('[data-section="keyInformation"] .bullet-list');
            if (keyInfoList) {
                keyInfoList.innerHTML = currentTemplate.settings.keyInformation
                    .map(item => `<li>${item}</li>`)
                    .join('');
            }

            const outputList = document.querySelector<HTMLUListElement>('[data-section="outputFormat"] .bullet-list');
            if (outputList) {
                outputList.innerHTML = `
                    ${currentTemplate.settings.outputFormat.sections
                        .map(item => `<li>${item}</li>`)
                        .join('')}
                    <li>One comprehensive paragraph containing:
                        <ul class="sub-bullet-list">
                            ${currentTemplate.settings.outputFormat.requirements
                                .map(item => `<li>${item}</li>`)
                                .join('')}
                        </ul>
                    </li>
                `;
            }
        } catch (error) {
            console.error('Error loading template settings:', error);
        }
    }

    // Handle settings button click
    settingsBtn?.addEventListener('click', () => {
        loadTemplateSettings();
        templateModal.style.display = 'flex';
    });

    // Handle modal close
    closeModalBtn?.addEventListener('click', () => {
        templateModal.style.display = 'none';
    });

    // Handle cancel changes
    cancelChangesBtn?.addEventListener('click', () => {
        templateModal.style.display = 'none';
    });

    // Handle save changes
    saveChangesBtn?.addEventListener('click', async () => {
        try {
            const purposeContent = document.querySelector<HTMLDivElement>('[data-section="purpose"] .template-section-content');
            const keyInformationItems = document.querySelectorAll<HTMLLIElement>('[data-section="keyInformation"] .bullet-list > li');
            const outputSectionItems = document.querySelectorAll<HTMLLIElement>('[data-section="outputFormat"] .bullet-list > li:not(:last-child)');
            const outputRequirementItems = document.querySelectorAll<HTMLLIElement>('[data-section="outputFormat"] .sub-bullet-list > li');

            if (!purposeContent) {
                throw new Error('Purpose content not found');
            }

            const purpose = purposeContent.textContent || '';
            const keyInformation = Array.from(keyInformationItems).map(li => li.textContent || '');
            const outputSections = Array.from(outputSectionItems).map(li => li.textContent || '');
            const outputRequirements = Array.from(outputRequirementItems).map(li => li.textContent || '');

            await TemplateManager.saveTemplate(DocumentType.GameVision, {
                purpose,
                keyInformation,
                outputFormat: {
                    sections: outputSections,
                    requirements: outputRequirements
                }
            });

            templateModal.style.display = 'none';
        } catch (error) {
            console.error('Error saving template settings:', error);
        }
    });

    // Handle message input
    messageInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (message) {
                try {
                    // Add user message to chat
                    addMessage(message, 'user');
                    messageInput.value = '';

                    // Show typing indicator
                    const typingIndicator = addTypingIndicator();

                    // Get current template settings
                    const template = await TemplateManager.getTemplate(DocumentType.GameVision);

                    // Send message to background script for processing
                    chrome.runtime.sendMessage({
                        type: 'process_message',
                        payload: {
                            message,
                            documentType: 'game_vision',
                            template: template.settings
                        }
                    }, (response) => {
                        // Remove typing indicator
                        typingIndicator.remove();

                        if (response && response.success) {
                            // Add AI response to chat
                            addMessage(response.data, 'assistant');
                        } else {
                            addMessage('Sorry, there was an error processing your message.', 'error');
                        }
                    });
                } catch (error) {
                    console.error('Error processing message:', error);
                    addMessage('Sorry, there was an error processing your message.', 'error');
                }
            }
        }
    });

    // Handle add document button
    addDocumentBtn?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            type: 'show_template_selection'
        });
    });

    // Handle download button
    downloadBtn?.addEventListener('click', async () => {
        try {
            const messages = Array.from(mainContent.querySelectorAll('.chat-message'))
                .map(msg => msg.textContent?.trim() || '');
            
            const content = messages.join('\n\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'game-vision-document.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading document:', error);
            addMessage('Error downloading document', 'error');
        }
    });

    // Function to add a message to the chat
    function addMessage(text: string, type: 'user' | 'assistant' | 'error') {
        if (!mainContent) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        messageDiv.textContent = text;
        mainContent.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    // Function to add typing indicator
    function addTypingIndicator() {
        if (!mainContent) throw new Error('Main content not found');
        
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'chat-message typing-indicator';
        indicatorDiv.innerHTML = '<span>AI is typing</span>';
        mainContent.appendChild(indicatorDiv);
        indicatorDiv.scrollIntoView({ behavior: 'smooth' });
        return indicatorDiv;
    }

    // Initialize
    loadTemplateSettings();
}); 