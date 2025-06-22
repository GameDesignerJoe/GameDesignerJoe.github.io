import { DocumentType } from '../shared/types';
import { DocumentTemplate, TemplateSettings } from './types';
import { defaultGameVisionTemplate } from './gameVisionTemplate';

export class TemplateManager {
    private static readonly STORAGE_KEY = 'gdds_templates';
    private static readonly DEFAULT_TEMPLATES: Partial<Record<DocumentType, DocumentTemplate>> = {
        [DocumentType.GameVision]: defaultGameVisionTemplate,
        // Add other default templates here as they're created
    };

    static async getTemplate(type: DocumentType): Promise<DocumentTemplate> {
        try {
            const templates = await this.getAllTemplates();
            return templates[type] || this.DEFAULT_TEMPLATES[type] as DocumentTemplate;
        } catch (error) {
            console.error('Error getting template:', error);
            return this.DEFAULT_TEMPLATES[type] as DocumentTemplate;
        }
    }

    static async getAllTemplates(): Promise<Partial<Record<DocumentType, DocumentTemplate>>> {
        try {
            const result = await chrome.storage.sync.get(this.STORAGE_KEY);
            return result[this.STORAGE_KEY] || this.DEFAULT_TEMPLATES;
        } catch (error) {
            console.error('Error getting templates:', error);
            return this.DEFAULT_TEMPLATES;
        }
    }

    static async saveTemplate(type: DocumentType, settings: TemplateSettings): Promise<void> {
        try {
            const templates = await this.getAllTemplates();
            const template = templates[type] || this.DEFAULT_TEMPLATES[type];

            if (!template) {
                throw new Error(`No template found for type: ${type}`);
            }

            const updatedTemplate: DocumentTemplate = {
                ...template,
                settings,
                lastModified: Date.now(),
                isCustom: true
            };

            await chrome.storage.sync.set({
                [this.STORAGE_KEY]: {
                    ...templates,
                    [type]: updatedTemplate
                }
            });
        } catch (error) {
            console.error('Error saving template:', error);
            throw error;
        }
    }

    static async resetTemplate(type: DocumentType): Promise<void> {
        try {
            const templates = await this.getAllTemplates();
            const defaultTemplate = this.DEFAULT_TEMPLATES[type];

            if (!defaultTemplate) {
                throw new Error(`No default template found for type: ${type}`);
            }

            await chrome.storage.sync.set({
                [this.STORAGE_KEY]: {
                    ...templates,
                    [type]: defaultTemplate
                }
            });
        } catch (error) {
            console.error('Error resetting template:', error);
            throw error;
        }
    }

    static async exportTemplate(type: DocumentType): Promise<string> {
        try {
            const template = await this.getTemplate(type);
            return JSON.stringify(template, null, 2);
        } catch (error) {
            console.error('Error exporting template:', error);
            throw error;
        }
    }

    static async importTemplate(templateJson: string): Promise<void> {
        try {
            const template: DocumentTemplate = JSON.parse(templateJson);
            
            if (!template.type || !template.settings) {
                throw new Error('Invalid template format');
            }

            await this.saveTemplate(template.type, template.settings);
        } catch (error) {
            console.error('Error importing template:', error);
            throw error;
        }
    }
} 