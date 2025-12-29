// Steam CDN image URL helpers

/**
 * Get Steam library capsule image (600x900)
 * This is the tall box art shown in Steam grid view
 */
export function getLibraryCapsule(appId: string | number): string {
  // Special case for our fake Vault Controller
  if (appId === 'vault-controller') {
    return '/vault-controller.jpg'; // We'll use a placeholder
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
