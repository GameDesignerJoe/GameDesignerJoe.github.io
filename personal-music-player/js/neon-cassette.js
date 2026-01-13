// Neon Cassette Utility
// Creates the sick neon cassette art for tracks without album art
// 🎸 Rock and roll! 🎸

/**
 * Create a neon cassette element
 * @param {string} size - Size variant: 'default', 'compact', 'mini'
 * @returns {HTMLElement} The neon cassette div
 */
export function createNeonCassette(size = 'default') {
  const div = document.createElement('div');
  div.className = 'neon-cassette-art';
  
  // Add size-specific class
  if (size === 'compact') {
    div.classList.add('compact');
  } else if (size === 'mini') {
    div.classList.add('mini');
  }
  
  return div;
}

/**
 * Check if an image source is a default/fallback icon
 * @param {string} src - Image source URL
 * @returns {boolean} True if it's a default icon
 */
export function isDefaultIcon(src) {
  if (!src) return true;
  
  const defaultIcons = [
    'icon-song-black..png',
    'icon-tape-black.png',
    'assets/icons/icon-song-black..png',
    'assets/icons/icon-tape-black.png'
  ];
  
  return defaultIcons.some(icon => src.includes(icon));
}

/**
 * Replace an img element with neon cassette if it's a default icon
 * @param {HTMLImageElement} imgElement - The image element to potentially replace
 * @param {string} size - Size variant: 'default', 'compact', 'mini'
 * @returns {boolean} True if replaced, false if not
 */
export function replaceWithNeonIfDefault(imgElement, size = 'default') {
  if (!imgElement) return false;
  
  const src = imgElement.src || imgElement.getAttribute('src');
  
  if (isDefaultIcon(src)) {
    // Create neon cassette
    const neonCassette = createNeonCassette(size);
    
    // Replace the image with the neon cassette
    if (imgElement.parentNode) {
      // If parent is a container, replace the img
      imgElement.parentNode.replaceChild(neonCassette, imgElement);
      return true;
    }
  }
  
  return false;
}

/**
 * Apply neon cassette to an image element (convert it in place)
 * @param {HTMLImageElement} imgElement - The image element
 * @param {string} size - Size variant
 */
export function applyNeonCassette(imgElement, size = 'default') {
  if (!imgElement) return;
  
  const src = imgElement.src || imgElement.getAttribute('src');
  
  if (isDefaultIcon(src)) {
    // Hide the image
    imgElement.style.display = 'none';
    
    // Create neon cassette
    const neonCassette = createNeonCassette(size);
    
    // Insert after the image
    if (imgElement.parentNode) {
      imgElement.parentNode.insertBefore(neonCassette, imgElement.nextSibling);
    }
  }
}

/**
 * Get appropriate album art HTML (neon cassette or regular image)
 * @param {string} albumArt - Album art URL
 * @param {string} alt - Alt text
 * @param {string} size - Size variant: 'default', 'compact', 'mini'
 * @returns {string} HTML string
 */
export function getAlbumArtHTML(albumArt, alt = 'Album Art', size = 'default') {
  if (!albumArt || isDefaultIcon(albumArt)) {
    // Return neon cassette HTML
    const sizeClass = size !== 'default' ? ` ${size}` : '';
    return `<div class="neon-cassette-art${sizeClass}"></div>`;
  } else {
    // Return regular image
    return `<img src="${escapeHtml(albumArt)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update all album art images on the page to use neon cassette
 * (useful for dynamic content that loads after page load)
 */
export function updateAllAlbumArt() {
  // Find all images that might be album art
  const albumArtImages = document.querySelectorAll(
    '.track-item-cover img, ' +
    '.mini-player-art, ' +
    '.album-art, ' +
    '.folder-card-image img, ' +
    '.playlist-collage img'
  );
  
  albumArtImages.forEach(img => {
    const src = img.src || img.getAttribute('src');
    if (isDefaultIcon(src)) {
      // Determine size based on context
      let size = 'default';
      if (img.classList.contains('mini-player-art')) {
        size = 'mini';
      } else if (img.closest('.track-item-cover')) {
        size = 'compact';
      }
      
      replaceWithNeonIfDefault(img, size);
    }
  });
}

export default {
  createNeonCassette,
  isDefaultIcon,
  replaceWithNeonIfDefault,
  applyNeonCassette,
  getAlbumArtHTML,
  updateAllAlbumArt
};
