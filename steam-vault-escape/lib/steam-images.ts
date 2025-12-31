// Steam CDN image URL helpers
import { markImageAsFailed } from './image-retry-manager';

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
 * Handle image load errors by showing placeholder with game name
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>) {
  const img = event.currentTarget;
  const gameName = img.alt || 'Unknown Game';
  
  // Extract appId from the image src and track the failure
  const srcMatch = img.src.match(/\/apps\/(\d+)\//);
  if (srcMatch) {
    const appId = parseInt(srcMatch[1]);
    markImageAsFailed(appId);
  }
  
  // Escape HTML characters
  const escapedName = gameName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Split name into words for better wrapping
  const words = escapedName.split(' ');
  let lines: string[] = [];
  let currentLine = '';
  
  // Simple word wrapping - max 20 chars per line
  words.forEach(word => {
    if ((currentLine + ' ' + word).length > 20 && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  });
  if (currentLine) lines.push(currentLine.trim());
  
  // Limit to 4 lines max
  if (lines.length > 4) {
    lines = lines.slice(0, 4);
    lines[3] = lines[3].substring(0, 17) + '...';
  }
  
  // Calculate vertical positioning (upper third of card)
  const fontSize = 64;
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = 200 + fontSize; // Start at 200px from top instead of centered
  
  // Generate text elements
  const textElements = lines.map((line, index) => 
    `<text x="300" y="${startY + (index * lineHeight)}" text-anchor="middle" fill="rgb(203,213,225)" font-size="${fontSize}" font-weight="bold" font-family="'Segoe UI', 'Arial Black', Arial, sans-serif" letter-spacing="1">${line}</text>`
  ).join('\n    ');
  
  // Create an SVG with the game name in Impact font
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900">
    <defs>
      <linearGradient id="placeholderBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(30,41,59);stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgb(15,23,42);stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="600" height="900" fill="url(#placeholderBg)"/>
    ${textElements}
  </svg>`;
  
  img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  img.style.display = 'block';
}
