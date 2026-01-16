// Ship Life - UI Utilities

/**
 * Show notification message
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

/**
 * Lock navigation (disable all nav buttons)
 */
function lockNavigation() {
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(btn => {
        btn.disabled = true;
    });
}

/**
 * Unlock navigation (enable all nav buttons)
 */
function unlockNavigation() {
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(btn => {
        btn.disabled = false;
    });
}

/**
 * Enter fullscreen mode
 */
function enterFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
}

/**
 * Exit fullscreen mode
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

/**
 * Update active Guardian display
 */
function updateGuardianDisplay(guardian) {
    const display = document.getElementById('active-guardian-display');
    const portrait = document.getElementById('guardian-portrait');
    const name = document.getElementById('guardian-name');
    
    if (!guardian) {
        display.classList.add('hidden');
        return;
    }
    
    display.classList.remove('hidden');
    
    // Set portrait using renderVisual (handles both color and image types)
    renderVisual(guardian.portrait, portrait);
    if (guardian.portrait.show_name) {
        portrait.textContent = guardian.name;
    }
    
    name.textContent = guardian.name;
}

/**
 * Render visual element (portrait, icon, mission card visual)
 */
function renderVisual(visual, element) {
    if (visual.type === 'color') {
        element.style.backgroundColor = visual.value;
        if (visual.show_name) {
            element.style.display = 'flex';
            element.style.justifyContent = 'center';
            element.style.alignItems = 'center';
        }
    } else if (visual.type === 'image') {
        element.style.backgroundImage = `url(assets/images/${visual.value})`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
    }
}

/**
 * Close workstation sidebar
 */
function closeSidebar() {
    const sidebar = document.getElementById('workstation-sidebar');
    sidebar.classList.add('hidden');
}

/**
 * Show quit dialog
 */
function showQuitDialog() {
    lockNavigation();
    const dialog = document.getElementById('quit-dialog');
    dialog.classList.remove('hidden');
}

/**
 * Confirm quit
 */
function confirmQuit() {
    exitFullscreen();
    window.location.href = 'index.html';
}

/**
 * Cancel quit
 */
function cancelQuit() {
    const dialog = document.getElementById('quit-dialog');
    dialog.classList.add('hidden');
    unlockNavigation();
}

/**
 * Clear room container
 */
function clearRoom() {
    const container = document.getElementById('room-container');
    container.innerHTML = '';
}

/**
 * Set room background
 */
function setRoomBackground(background) {
    if (background.type === 'color') {
        document.body.style.backgroundColor = background.value;
        document.body.style.backgroundImage = 'none';
    } else if (background.type === 'image') {
        document.body.style.backgroundImage = `url(assets/images/${background.value})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    }
}

/**
 * Set room title
 */
function setRoomTitle(title, show = true) {
    const titleElement = document.getElementById('room-title');
    if (show) {
        titleElement.textContent = title;
        titleElement.style.display = 'block';
    } else {
        titleElement.style.display = 'none';
    }
}

/**
 * Create button element
 */
function createButton(text, className, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = className;
    button.onclick = onClick;
    return button;
}

/**
 * Format item name with quantity
 */
function formatItemQuantity(itemName, quantity) {
    return `${itemName} x${quantity}`;
}

/**
 * ESC key handler
 */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Check if we're in game (not on landing page)
        const navBar = document.getElementById('navigation-bar');
        if (!navBar.classList.contains('hidden')) {
            showQuitDialog();
        }
    }
});

/**
 * Animate progress bar
 */
async function animateProgressBar(fillElement, targetPercent, duration) {
    const startPercent = parseFloat(fillElement.style.width) || 0;
    const startTime = Date.now();
    
    return new Promise(resolve => {
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            const currentPercent = startPercent + (targetPercent - startPercent) * progress;
            fillElement.style.width = `${currentPercent}%`;
            fillElement.textContent = `${Math.floor(currentPercent)}%`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        animate();
    });
}

/**
 * Sleep/delay function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Click outside sidebar to close
 */
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('workstation-sidebar');
    if (!sidebar.classList.contains('hidden')) {
        // Check if click is outside sidebar
        if (!sidebar.contains(e.target) && 
            !e.target.closest('.workstation-card') &&
            !e.target.closest('.guardian-npc-card')) {
            closeSidebar();
        }
    }
});

/**
 * Initialize mute button state on load
 */
function initializeMuteButton() {
    const button = document.getElementById('mute-toggle');
    
    if (!window.audioManager || !button) {
        return;
    }
    
    // Check if audio is muted
    const isMuted = !window.audioManager.settings.musicEnabled && !window.audioManager.settings.sfxEnabled;
    
    if (isMuted) {
        button.textContent = '🔇';
        button.classList.add('muted');
        button.title = 'Unmute All Audio';
    } else {
        button.textContent = '🔊';
        button.classList.remove('muted');
        button.title = 'Mute All Audio';
    }
}

/**
 * Toggle mute for all audio (music + SFX)
 */
function toggleMute() {
    const button = document.getElementById('mute-toggle');
    
    if (!window.audioManager) {
        console.warn('Audio manager not available');
        return;
    }
    
    // Get current state (if either is enabled, we consider it unmuted)
    const currentlyMuted = !window.audioManager.settings.musicEnabled && !window.audioManager.settings.sfxEnabled;
    
    if (currentlyMuted) {
        // Unmute - turn both on
        window.audioManager.settings.musicEnabled = true;
        window.audioManager.settings.sfxEnabled = true;
        window.audioManager.saveSettings();
        
        button.textContent = '🔊';
        button.classList.remove('muted');
        button.title = 'Mute All Audio';
        
        console.log('Audio unmuted');
    } else {
        // Mute - turn both off
        window.audioManager.settings.musicEnabled = false;
        window.audioManager.settings.sfxEnabled = false;
        window.audioManager.saveSettings();
        window.audioManager.stopMusic();
        
        button.textContent = '🔇';
        button.classList.add('muted');
        button.title = 'Unmute All Audio';
        
        console.log('Audio muted');
    }
}

console.log('UI utilities loaded.');
