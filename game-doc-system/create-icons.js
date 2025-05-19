const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const assetsDir = path.join(__dirname, 'src', 'assets');

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = 'rgb(26, 27, 30)';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.125);
  ctx.fill();

  // Draw text
  ctx.fillStyle = 'rgb(231, 143, 117)';
  ctx.font = `600 ${size/2}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GD', size/2, size/2);

  // Save file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(assetsDir, `gd_icon${size}.png`), buffer);
  console.log(`Created icon${size}.png`);
});
