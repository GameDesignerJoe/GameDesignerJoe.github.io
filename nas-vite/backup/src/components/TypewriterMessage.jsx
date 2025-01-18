import { useState, useEffect } from 'react';

const TypewriterMessage = ({ message = '', speed = 50 }) => {
  const [displayedMessage, setDisplayedMessage] = useState('');
  
  useEffect(() => {
    setDisplayedMessage('');
    
    if (!message) return;
    
    let currentIndex = 0;
    let fullMessage = message; // Store the complete message
    
    const intervalId = setInterval(() => {
      if (currentIndex <= fullMessage.length - 1) { // Changed condition
        setDisplayedMessage(fullMessage.substring(0, currentIndex + 1)); // Use substring
        currentIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, speed);
    
    return () => clearInterval(intervalId);
  }, [message, speed]);
  
  return (
    <p id="game-message" className="game-message">
      {displayedMessage || '\u00A0'}
    </p>
  );
};

export default TypewriterMessage;