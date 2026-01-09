// ID3 Tag Reader Module
// Reads ID3 tags from local audio files to extract metadata and album art

// Extract ID3 tags from a file
export async function readID3Tags(file) {
  return new Promise((resolve, reject) => {
    // jsmediatags is loaded globally from CDN
    if (typeof window.jsmediatags === 'undefined') {
      reject(new Error('jsmediatags library not loaded'));
      return;
    }
    
    window.jsmediatags.read(file, {
      onSuccess: (tag) => {
        resolve(tag.tags);
      },
      onError: (error) => {
        console.warn('[ID3] Error reading tags:', error.type, error.info);
        reject(error);
      }
    });
  });
}

// Extract album art from ID3 tags
export function extractAlbumArt(tags) {
  if (!tags || !tags.picture) {
    return null;
  }
  
  const picture = tags.picture;
  
  try {
    // Convert byte array to base64
    const base64String = arrayBufferToBase64(picture.data);
    const mimeType = picture.format || 'image/jpeg';
    
    // Create data URL
    const dataUrl = `data:${mimeType};base64,${base64String}`;
    
    return {
      dataUrl,
      format: mimeType
    };
  } catch (error) {
    console.error('[ID3] Error converting album art to base64:', error);
    return null;
  }
}

// Convert array buffer to base64 string
function arrayBufferToBase64(data) {
  // Handle different input types
  let bytes;
  
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (Array.isArray(data)) {
    // jsmediatags returns a regular array
    bytes = new Uint8Array(data);
  } else {
    throw new Error('Unsupported data type for image conversion');
  }
  
  // Use a more efficient method for larger images
  const len = bytes.byteLength || bytes.length;
  
  // For smaller images, use the string concatenation method
  if (len < 50000) {
    let binary = '';
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  
  // For larger images, use chunks to avoid call stack size exceeded
  const chunkSize = 8192;
  let binary = '';
  
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return window.btoa(binary);
}

// Extract all relevant metadata from ID3 tags
export function extractMetadata(tags) {
  return {
    title: tags.title || null,
    artist: tags.artist || null,
    album: tags.album || null,
    year: tags.year || null,
    genre: tags.genre || null,
    track: tags.track || null,
    albumArtist: tags.album_artist || null
  };
}

// Read ID3 tags and extract everything
export async function readAudioFileMetadata(file) {
  try {
    const tags = await readID3Tags(file);
    
    const metadata = extractMetadata(tags);
    const albumArt = extractAlbumArt(tags);
    
    return {
      ...metadata,
      albumArt: albumArt ? albumArt.dataUrl : null,
      albumArtFormat: albumArt ? albumArt.format : null,
      hasAlbumArt: !!albumArt
    };
  } catch (error) {
    console.warn('[ID3] Could not read metadata from file:', error);
    return {
      title: null,
      artist: null,
      album: null,
      albumArt: null,
      hasAlbumArt: false
    };
  }
}

export default {
  readID3Tags,
  extractAlbumArt,
  extractMetadata,
  readAudioFileMetadata
};
