// This is a simplified JavaScript version of main.tsx for direct HTML loading
// It creates a basic placeholder to show the page is loading

document.addEventListener('DOMContentLoaded', function() {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; text-align: center;">
        <h1>Map Visualization Tool</h1>
        <p>This is a simplified version of the application.</p>
        <p>For full functionality, please run the application using the Vite development server:</p>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; text-align: left;">cd mapVisualizationTool/implementation/mvp-simple
npm run dev</pre>
        <p>Then open <a href="http://localhost:5173">http://localhost:5173</a> in your browser.</p>
        
        <div style="margin-top: 40px;">
          <h2>Map Configuration</h2>
          <p>Width: 60 | Height: 50 | Cell Size: 10px</p>
          <button style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Generate Map
          </button>
        </div>
      </div>
    `;
  }
});
