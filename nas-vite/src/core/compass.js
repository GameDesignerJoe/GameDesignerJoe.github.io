// src/core/compass.js

import { hexDistance } from '../components/game/utils/grid.js';
import { GRID } from '../config/constants.js';

export class CompassSystem {
    constructor(gameStore, messageSystem) {
        this.store = gameStore;
        this.messageSystem = messageSystem;
        this.isActive = false;
        this.animationFrame = null;
        this.settling = false;
        this.swayAmount = 0;
        this.currentRotation = 0;
        
        this.initCompass();
        this.initCompassButton();
    }

    initCompass() {
        const gameGrid = document.getElementById('gameGrid');
        if (!gameGrid) return;

        // Create compass container
        const compass = document.createElementNS("http://www.w3.org/2000/svg", "g");
        compass.setAttribute("id", "compass");
        compass.setAttribute("class", "compass hidden");
        
        // Position it in the top middle
        compass.setAttribute("transform", "translate(-40, -130) scale(0.75)"); // Reduced size by 25% and positioned up top
        
        // Inline SVG content
        compass.innerHTML = `
            <!-- Base circle -->
            <circle cx="50" cy="50" r="45" fill="#e5e5e5" stroke="#333" stroke-width="2"/>
            
            <!-- Compass ring -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#666" stroke-width="1"/>
            
            <!-- Cardinal direction marks -->
            <line x1="50" y1="15" x2="50" y2="25" stroke="#333" stroke-width="2"/>
            <line x1="50" y1="75" x2="50" y2="85" stroke="#333" stroke-width="2"/>
            <line x1="15" y1="50" x2="25" y2="50" stroke="#333" stroke-width="2"/>
            <line x1="75" y1="50" x2="85" y2="50" stroke="#333" stroke-width="2"/>
            
            <!-- Compass needle -->
            <g id="needle" transform="translate(50,50)">
                <!-- North half (Silver) -->
                <path d="M0,-35 L5,-5 L0,0 L-5,-5 Z" fill="#C0C0C0"/>
                <!-- South half (Red) -->
                <path d="M0,35 L5,5 L0,0 L-5,5 Z" fill="#FF0000"/>
            </g>
            
            <!-- Center pin -->
            <circle cx="50" cy="50" r="3" fill="#333"/>
        `;
        
        gameGrid.appendChild(compass);
        
        gameGrid.appendChild(compass);
    }

    initCompassButton() {
        const campButton = document.querySelector('.camp-button');
        if (!campButton) return;

        const compassButton = document.createElement('button');
        compassButton.className = 'compass-button';
        compassButton.innerHTML = `
            <img src="/art/compass-icon.svg" alt="Compass" />
            <span>Compass</span>
        `;
        
        compassButton.addEventListener('click', () => this.toggleCompass());
        
        // Insert after camp button
        campButton.parentNode.insertBefore(compassButton, campButton.nextSibling);
    }

    toggleCompass() {
        if (this.isActive) {
            this.deactivateCompass();
        } else {
            this.activateCompass();
        }
    }

    activateCompass() {
        if (this.isActive) return;
        
        this.isActive = true;
        const compass = document.getElementById('compass');
        if (!compass) return;

        compass.classList.remove('hidden');
        this.messageSystem.showPlayerMessage(
            "You pull out your compass to help navigate.",
            "STATUS"
        );

        // Calculate initial sway based on distance to South Pole
        const distance = hexDistance(
            this.store.playerPosition,
            this.store.southPole
        );
        this.swayAmount = Math.min(45, distance * 5); // Max 45 degrees of sway
        
        this.settling = true;
        this.startNeedleAnimation();
    }

    deactivateCompass() {
        if (!this.isActive) return;
        
        this.isActive = false;
        const compass = document.getElementById('compass');
        if (!compass) return;

        compass.classList.add('hidden');
        this.messageSystem.showPlayerMessage(
            "You put away your compass.",
            "STATUS"
        );

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    startNeedleAnimation() {
        const compass = document.getElementById('compass');
        const needle = compass?.querySelector('#needle');
        if (!needle) return;

        let startTime = performance.now();
        const settlingDuration = 7000; // 7 seconds to settle

        const updateNeedle = (currentTime) => {
            if (!this.isActive) return;

            const elapsed = currentTime - startTime;
            
            // Calculate base target angle first
            const targetAngle = this.calculateTargetAngle();
            // console.log('Target angle:', targetAngle, 'Current position:', this.store.playerPosition, 'South Pole:', this.store.southPole);
            
            if (this.isAtSouthPole()) {
                // console.log('At South Pole - spinning');
                this.currentRotation = (this.currentRotation + 2) % 360;
            } else if (this.settling && elapsed < settlingDuration) {
                const progress = elapsed / settlingDuration;
                const currentSway = this.swayAmount * (1 - progress);
                const swayAngle = Math.sin(elapsed / 100) * currentSway;
                this.currentRotation = targetAngle + swayAngle;
            } else {
                this.currentRotation = targetAngle;
                if (this.settling) {
                    this.settling = false;
                }
            }

            // Apply weather effects
            let finalRotation = this.currentRotation;
            if (this.store.weather.effects.blizzardActive) {
                finalRotation += (Math.random() - 0.5) * 20;
            }

            if (this.store.weather.effects.whiteoutActive) {
                needle.style.opacity = "0";
            } else {
                needle.style.opacity = "1";
                // Update needle rotation
                needle.setAttribute('transform', `translate(50,50) rotate(${finalRotation})`);
            }
            
            this.animationFrame = requestAnimationFrame(updateNeedle);
        };

        this.animationFrame = requestAnimationFrame(updateNeedle);
    }

    calculateTargetAngle() {
        const playerPos = this.store.playerPosition;
        const polePos = this.store.southPole;
        
        // Convert hex coordinates to 2D space with hex grid correction
        const dx = polePos.q - playerPos.q;
        const dr = polePos.r - playerPos.r;
        
        // Apply hex grid correction (since r-axis is at 60° angle)
        const correctedDx = dx + (dr / 2);
        const correctedDy = dr * Math.sqrt(3)/2;
        
        // Calculate angle in radians and convert to degrees
        let angle = Math.atan2(correctedDy, correctedDx) * (180 / Math.PI);
        
        // Adjust angle so 0 is north (negative Y in SVG) and positive rotation is clockwise
        angle = (-angle + 90 + 360) % 360;
        
        // console.log('Direction to pole:', {
        //     raw: { dx, dr },
        //     corrected: { x: correctedDx, y: correctedDy },
        //     angle,
        //     player: playerPos,
        //     pole: polePos
        // });
        
        return angle;
    }

    calculateTargetAngle() {
        const player = this.store.playerPosition;
        const pole = this.store.southPole;
        
        // Get basic direction
        const angle = Math.atan2(
            pole.r - player.r,  // y difference
            pole.q - player.q   // x difference
        ) * 180 / Math.PI;
    
        // Simple 90-degree adjustment to fix the rotation
        const correctedAngle = (angle - 90 + 360) % 360;
    
        // console.log('Direction:', { 
        //     raw: angle,
        //     corrected: correctedAngle,
        //     player,
        //     pole 
        // });
        
        return correctedAngle;
    }

    isAtSouthPole() {
        return this.store.playerPosition.q === this.store.southPole.q &&
               this.store.playerPosition.r === this.store.southPole.r;
    }
}

export default CompassSystem;