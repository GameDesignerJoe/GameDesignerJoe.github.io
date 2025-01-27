import React, { useState, useEffect, useCallback } from 'react';

const PlayerMessage = () => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const showMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  useEffect(() => {
    // Expose the showMessage function globally so the game engine can use it
    window.showPlayerMessage = showMessage;
  }, [showMessage]);

  useEffect(() => {
    if (messages.length > 0 && !currentMessage) {
      setCurrentMessage(messages[0]);
      setIsVisible(true);
      setMessages(prev => prev.slice(1));

      // Hide message after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Wait for slide-up animation to complete before clearing message
        setTimeout(() => {
          setCurrentMessage(null);
        }, 300); // Match the CSS transition duration
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [messages, currentMessage]);

  if (!currentMessage) return null;

  return (
    <div 
      className={`
        fixed top-0 left-0 right-0 
        bg-black/50 
        text-white 
        p-4
        text-center
        italic
        transition-transform duration-300
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}
      `}
    >
      {currentMessage}
    </div>
  );
};

export default PlayerMessage;