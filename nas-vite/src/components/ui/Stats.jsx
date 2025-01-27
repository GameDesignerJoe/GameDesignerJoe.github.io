// src/components/ui/Stats.jsx

import React, { useEffect, useState } from 'react';
import { gameStore } from '../../state/store';

const Stats = () => {
    const [stats, setStats] = useState({
        health: 100,
        stamina: 100,
        food: 100
    });

    useEffect(() => {
        const updateInterval = setInterval(() => {
            setStats({ ...gameStore.player.stats });
        }, 50);

        return () => clearInterval(updateInterval);
    }, []);

    return (
        <div className="stats-container">
            <div className="stat">
                <img src="/art/health.svg" id="health-icon" alt="Health" className="stat-icon" />
                <div className="stat-bar">
                    <div 
                        className="stat-fill" 
                        id="health-bar" 
                        style={{ width: `${stats.health}%` }}
                    />
                </div>
            </div>
            <div className="stat">
                <img src="/art/stamina.svg" id="stamina-icon" alt="Stamina" className="stat-icon" />
                <div className="stat-bar">
                    <div 
                        className="stat-fill" 
                        id="stamina-bar" 
                        style={{ width: `${stats.stamina}%` }}
                    />
                </div>
            </div>
            <div className="stat">
                <img src="/art/food.svg" id="food-icon" alt="food" className="stat-icon" />
                <div className="stat-bar">
                    <div 
                        className="stat-fill" 
                        id="food-bar" 
                        style={{ width: `${stats.food}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default Stats;