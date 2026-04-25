import { state } from '../state.js';

let containerEl = null;

export function initWordDisplay() {
  containerEl = document.getElementById('word-display');
  renderWord();
}

export function renderWord() {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  if (!state.currentWord) return;
  for (let i = 0; i < state.currentWord.length; i++) {
    const span = document.createElement('span');
    span.className = 'word-letter';
    if (i < state.completedLetters) span.classList.add('completed');
    span.textContent = state.currentWord[i];
    containerEl.appendChild(span);
  }
}
