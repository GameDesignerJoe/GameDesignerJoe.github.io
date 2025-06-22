import { DocumentType } from '../shared/types';
import { DocumentTemplate } from './types';

export const defaultGameVisionTemplate: DocumentTemplate = {
    id: 'default_game_vision',
    type: DocumentType.GameVision,
    name: 'Game Vision',
    description: 'Capture the creative essence and high-level concept of your game',
    version: '1.0.0',
    isCustom: false,
    lastModified: Date.now(),
    settings: {
        purpose: 'Capture the creative essence and high-level concept of your game in a clear, inspiring format.',
        keyInformation: [
            'Game type and core gameplay',
            'Unique features and innovations',
            'Emotional impact on players',
            'Core promise to players'
        ],
        outputFormat: {
            sections: [
                'Title of the game',
                'Single inspirational line description',
                'One comprehensive paragraph containing the game overview'
            ],
            requirements: [
                'Game type, player count, and platform',
                'Core gameplay and player fantasy',
                'Main gameplay experience',
                'Player motivation and rewards',
                'Unique elements and lasting impact'
            ]
        }
    }
}; 