import { useEffect, useRef } from 'react';
import './CanvasTest.css';

interface CanvasTestProps {
  width: number;
  height: number;
}

const CanvasTest: React.FC<CanvasTestProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    ctx.fillStyle = '#3b82f6'; // blue-500
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 50, 0, Math.PI * 2);
    ctx.fill();

    // Draw a rectangle
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.fillRect(50, 50, 80, 80);

    // Draw a hexagon
    ctx.fillStyle = '#10b981'; // emerald-500
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

  }, [width, height]);

  return (
    <div className="canvas-container">
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="canvas-element"
      />
    </div>
  );
};

export default CanvasTest;
