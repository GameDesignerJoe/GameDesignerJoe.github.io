// src/game/visibility.js

export const VisibilityManager = {
    updateVisibility(isBlizzard = false) {
        visibleHexes.clear();
        visibleHexes.add(`${playerPosition.q},${playerPosition.r}`);
        
        // During whiteout, only show current hex and adjacents
        if (!WEATHER.state.whiteoutPhase) {
            this.getAdjacentHexes(playerPosition).forEach(hex => {
                visibleHexes.add(`${hex.q},${hex.r}`);
            });
        }
        
        // Handle fog transitions
        document.querySelectorAll('.fog').forEach(fogHex => {
            const q = parseInt(fogHex.getAttribute('data-q'));
            const r = parseInt(fogHex.getAttribute('data-r'));
            const hexId = `${q},${r}`;
            const isCurrentPosition = hexId === `${playerPosition.q},${playerPosition.r}`;
            
            if (WEATHER.state.whiteoutPhase) {
                // During whiteout, everything including current position should be fogged
                fogHex.setAttribute('fill-opacity', '1');
            } else if (isBlizzard) {
                // During blizzard, everything except current position should be fogged
                if (!isCurrentPosition) {
                    if (!fogHex.classList.contains('blizzard-fade')) {
                        fogHex.classList.add('blizzard-fade');
                    }
                    fogHex.setAttribute('fill-opacity', '1');
                } else {
                    fogHex.setAttribute('fill-opacity', '0');
                }
            } else {
                // Normal visibility rules
                fogHex.classList.remove('blizzard-fade');
                fogHex.classList.add('movement-fade');
                if (visibleHexes.has(hexId) || 
                    (!WEATHER.state.blizzardActive && visitedHexes.has(hexId))) {
                    fogHex.setAttribute('fill-opacity', '0');
                } else {
                    fogHex.setAttribute('fill-opacity', '1');
                }
            }
        });

        // Handle player visibility during whiteout
        const player = document.getElementById('player');
        if (WEATHER.state.whiteoutPhase) {
            player.style.opacity = '0';  // Hide player during whiteout
        } else {
            player.style.opacity = '1';  // Show player otherwise
        }
    },

    getAdjacentHexes(hex) {
        const directions = [
            {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
            {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
        ];
        
        return directions.map(dir => ({
            q: hex.q + dir.q,
            r: hex.r + dir.r
        }));
    }
};