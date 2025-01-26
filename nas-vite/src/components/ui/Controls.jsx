import React from 'react';

const RestartButton = ({ visible, onClick }) => {
  // console.log('RestartButton render, visible:', visible); // Debug log

  if (!visible) return null;

  return (
    <div className="restart-button-container" style={{ 
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10
    }}>
      <button 
        onClick={(e) => {
          // console.log('Restart button clicked'); // Debug log
          onClick(e);
        }}
        style={{
          backgroundColor: '#1B4B7C',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '4px',
          fontFamily: 'Old Standard TT, serif',
          fontSize: '1.2rem',
          cursor: 'pointer',
        }}
      >
        Begin A New Expedition
      </button>
    </div>
  );
};

export default RestartButton;