import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header>
        <h1>Map Visualization Tool - Pre-MVP</h1>
        <p>React Setup Validation</p>
      </header>
      <main>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            Count is {count}
          </button>
          <p>
            This is a simple React component to verify that React is working correctly.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
