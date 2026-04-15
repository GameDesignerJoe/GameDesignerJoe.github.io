import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Unregister any leftover service workers (e.g. the repo-root SW from the
// GameDesignerJoe portfolio, if it was ever registered on this origin).
// Without this, a reload during dev can get hijacked and serve a stale HTML
// from the portfolio cache instead of Murmur. See murmur_todo for context.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => {
      regs.forEach(r => {
        console.log('[Murmur] Unregistering stale service worker:', r.scope)
        r.unregister()
      })
    })
    .catch(() => { /* non-fatal */ })
  // Also blow away any caches the old SW left behind.
  if (typeof caches !== 'undefined' && caches.keys) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
