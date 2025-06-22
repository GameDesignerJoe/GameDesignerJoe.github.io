import { DocumentType } from '../shared/types';

export interface DocumentTemplate {
    id: string;
    type: DocumentType;
    name: string;
    description: string;
    version: string;
    isCustom: boolean;
    lastModified: number;
    settings: {
        purpose: string;
        keyInformation: string[];
        outputFormat: {
            sections: string[];
            requirements: string[];
        };
    };
}

export interface TemplateSection {
    id: string;
    title: string;
    content: string;
    isEditable: boolean;
}

export interface TemplateSettings {
    purpose: string;
    keyInformation: string[];
    outputFormat: {
        sections: string[];
        requirements: string[];
    };
} 