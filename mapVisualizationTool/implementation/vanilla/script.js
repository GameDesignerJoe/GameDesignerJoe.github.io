// Counter functionality
let count = 0;
const counterButton = document.getElementById('counter-button');

counterButton.addEventListener('click', () => {
  count++;
  counterButton.textContent = `Count is ${count}`;
});

// Canvas functionality
const canvas = document.getElementById('test-canvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

function drawCanvas() {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  
  // Vertical lines
  for (let x = 0; x <= width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let y = 0; y <= height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw a circle
  ctx.fillStyle = '#3b82f6'; // blue
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 50, 0, Math.PI * 2);
  ctx.fill();

  // Draw a rectangle
  ctx.fillStyle = '#ef4444'; // red
  ctx.fillRect(50, 50, 80, 80);

  // Draw a hexagon
  ctx.fillStyle = '#10b981'; // green
  const hexSize = 40;
  const hexX = width - 100;
  const hexY = height - 100;
  
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = hexX + hexSize * Math.cos(angle);
    const y = hexY + hexSize * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
}

// Initialize the canvas when the page loads
window.addEventListener('load', drawCanvas);
