import React from 'react';

const Stats = () => {
  return (
    <div id="stats-container">
      <div className="stat">
        <img 
          src="/art/health.svg" 
          alt="Health" 
          className="stat-icon"
          style={{
            filter: "brightness(0) saturate(100%) invert(56%) sepia(65%) saturate(6320%) hue-rotate(336deg) brightness(101%) contrast(101%)"
          }}
        />
        <div className="stat-bar">
          <div className="stat-fill" id="health-bar" style={{ width: '100%' }}></div>
        </div>
      </div>
      <div className="stat">
        <img 
          src="/art/stamina.svg" 
          alt="Stamina" 
          className="stat-icon"
          style={{
            filter: "brightness(0) saturate(100%) invert(58%) sepia(87%) saturate(845%) hue-rotate(182deg) brightness(101%) contrast(101%)"
          }}
        />
        <div className="stat-bar">
          <div className="stat-fill" id="stamina-bar" style={{ width: '100%' }}></div>
        </div>
      </div>
      <div className="stat">
        <img 
          src="/art/food.svg" 
          alt="Hunger" 
          className="stat-icon"
          style={{
            filter: "brightness(0) saturate(100%) invert(77%) sepia(38%) saturate(836%) hue-rotate(334deg) brightness(101%) contrast(101%)"
          }}
        />
        <div className="stat-bar">
          <div className="stat-fill" id="hunger-bar" style={{ width: '100%' }}></div>
        </div>
      </div>
    </div>
  );
};

export default Stats;