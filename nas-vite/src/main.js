// src/main.js
import { GameInit } from './services/gameInit.js';
import { LoadingScreen } from './core/loadingScreen.js';

document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = new LoadingScreen();
    loadingScreen.onComplete = () => {
        GameInit.init();
    };
});