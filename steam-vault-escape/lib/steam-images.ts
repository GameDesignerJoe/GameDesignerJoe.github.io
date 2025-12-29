// Steam CDN image URL helpers

/**
 * Get Steam library capsule image (600x900)
 * This is the tall box art shown in Steam grid view
 */
export function getLibraryCapsule(appId: string | number): string {
  // Special case for our fake Vault Controller - use inline SVG with large emoji
  if (appId === 'vault-controller') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"><defs><linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:rgb(30,41,59);stop-opacity:1" /><stop offset="100%" style="stop-color:rgb(15,23,42);stop-opacity:1" /></linearGradient></defs><rect width="300" height="450" fill="url(#cardBg)"/><text x="150" y="60" text-anchor="middle" fill="rgb(96,165,250)" font-size="24" font-weight="bold" font-family="Arial">THE VAULT</text><text x="150" y="90" text-anchor="middle" fill="rgb(96,165,250)" font-size="20" font-weight="bold" font-family="Arial">CONTROLLER</text><text x="150" y="225" text-anchor="middle" font-size="140">🎮</text><text x="150" y="330" text-anchor="middle" fill="rgb(148,163,184)" font-size="18" font-family="monospace">5.0 hours played</text><text x="150" y="375" text-anchor="middle" fill="rgb(250,204,21)" font-size="36" font-weight="bold" font-family="Arial">👆 +1</text><text x="150" y="410" text-anchor="middle" fill="rgb(148,163,184)" font-size="16" font-family="Arial">Passive: +0.5/sec</text></svg>`;
    // Use encodeURIComponent to properly handle emojis
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`;
}

/**
 * Get Steam header image (460x215)
 * Fallback if library capsule doesn't exist
 */
export function getHeaderImage(appId: string | number): string {
  if (appId === 'vault-controller') {
    return '/vault-controller.jpg';
  }
  
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`;
}

/**
 * Handle image load errors by showing placeholder
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>) {
  const img = event.currentTarget;
  // Show a fallback gradient or placeholder
  img.style.background = 'linear-gradient(135deg, #1a1d29 0%, #2a2d3a 100%)';
  img.style.display = 'block';
  img.alt = 'No image available';
}
