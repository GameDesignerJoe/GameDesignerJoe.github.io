import { useState } from 'react';
import CanvasTest from './components/CanvasTest';
import './App.css';

function App(): JSX.Element {
  const [count, setCount] = useState<number>(0);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Map Visualization Tool - Pre-MVP</h1>
        <p>React Setup Validation with TypeScript</p>
      </header>
      <main className="app-main">
        <div className="card">
          <h2>React State Test</h2>
          <button 
            className="primary-button"
            onClick={() => setCount((count) => count + 1)}
          >
            Count is {count}
          </button>
          <p>
            This is a simple React component with TypeScript to verify that the setup is working correctly.
          </p>
        </div>
        
        <div className="card">
          <h2>Canvas API Test</h2>
          <p>
            This tests the HTML5 Canvas API by drawing a grid, circle, rectangle, and hexagon.
          </p>
          <CanvasTest width={600} height={400} />
        </div>
      </main>
    </div>
  );
}

export default App;
