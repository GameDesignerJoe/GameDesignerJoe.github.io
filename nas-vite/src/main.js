// src/main.js
import { GameInit } from './services/gameInit.js';
import { LoadingScreen } from './core/loadingScreen.js';
import { ExplorerSelection } from './core/explorerSelection.js';

document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = new LoadingScreen();
    loadingScreen.onComplete = () => {
        const explorerSelection = new ExplorerSelection();
        explorerSelection.onComplete = () => {
            GameInit.init();
        };
    };
});
