const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, size, size);

  // Purple rectangle
  ctx.fillStyle = '#8c52ff';
  const padding = size * 0.2;
  ctx.fillRect(padding, padding, size - (padding * 2), size - (padding * 2));

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GD', size / 2, size / 2);

  return canvas.toBuffer();
}

// Create dist/assets directory if it doesn't exist
if (!fs.existsSync('dist/assets')) {
  fs.mkdirSync('dist/assets', { recursive: true });
}

// Generate icons
[16, 48, 128].forEach(size => {
  const buffer = createIcon(size);
  fs.writeFileSync(`dist/assets/icon${size}.png`, buffer);
});
