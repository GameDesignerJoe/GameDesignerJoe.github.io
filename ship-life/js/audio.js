// Ship Life - Audio Manager

/**
 * Audio Manager
 * Handles background music and sound effects
 * Ready for audio files to be added
 */

class AudioManager {
    constructor() {
        this.settings = {
            masterVolume: 0.7,
            musicVolume: 0.5,
            sfxVolume: 0.8,
            musicEnabled: true,
            sfxEnabled: true
        };
        
        this.currentMusic = null;
        this.musicFadeInterval = null;
        
        // Load settings from localStorage
        this.loadSettings();
        
        console.log('Audio Manager initialized');
    }
    
    /**
     * Load audio settings from localStorage
     */
    loadSettings() {
        const saved = localStorage.getItem('ship_life_audio_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                console.log('Audio settings loaded:', this.settings);
            } catch (e) {
                console.error('Failed to load audio settings:', e);
            }
        }
    }
    
    /**
     * Save audio settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('ship_life_audio_settings', JSON.stringify(this.settings));
        console.log('Audio settings saved');
    }
    
    /**
     * Play background music for a room
     * @param {string} musicId - ID of the music track
     */
    playMusic(musicId) {
        if (!this.settings.musicEnabled || !musicId) return;
        
        // Don't restart if already playing this track
        if (this.currentMusicId === musicId) return;
        
        this.fadeOutMusic(() => {
            console.log('[Audio] Playing music:', musicId);
            const audio = new Audio(`audio/music/${musicId}.mp3`);
            audio.loop = true;
            audio.volume = this.settings.masterVolume * this.settings.musicVolume;
            audio.play().catch(e => console.warn('Music play failed (browser may require user interaction first):', e));
            this.currentMusic = audio;
            this.currentMusicId = musicId;
        });
    }
    
    /**
     * Stop background music
     */
    stopMusic() {
        if (!this.currentMusic) return;
        
        console.log('[Audio] Stopping music');
        this.fadeOutMusic();
    }
    
    /**
     * Fade out current music
     * @param {function} callback - Called when fade is complete
     */
    fadeOutMusic(callback) {
        // Stop current music if playing
        if (this.currentMusic) {
            console.log('[Audio] Stopping current music');
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
            this.currentMusicId = null;
        }
        
        // Clear any existing fade interval
        if (this.musicFadeInterval) {
            clearInterval(this.musicFadeInterval);
            this.musicFadeInterval = null;
        }
        
        // Call callback immediately (could add fade effect later)
        if (callback) callback();
    }
    
    /**
     * Play a sound effect
     * @param {string} sfxId - ID of the sound effect
     */
    playSFX(sfxId) {
        if (!this.settings.sfxEnabled || !sfxId) return;
        
        const audio = new Audio(`audio/sfx/${sfxId}.mp3`);
        audio.volume = this.settings.masterVolume * this.settings.sfxVolume;
        audio.play().catch(e => console.warn('SFX play failed:', e));
    }
    
    /**
     * Set master volume
     * @param {number} volume - Volume level (0-1)
     */
    setMasterVolume(volume) {
        this.settings.masterVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        console.log('Master volume set to:', this.settings.masterVolume);
    }
    
    /**
     * Set music volume
     * @param {number} volume - Volume level (0-1)
     */
    setMusicVolume(volume) {
        this.settings.musicVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        console.log('Music volume set to:', this.settings.musicVolume);
    }
    
    /**
     * Set SFX volume
     * @param {number} volume - Volume level (0-1)
     */
    setSFXVolume(volume) {
        this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        console.log('SFX volume set to:', this.settings.sfxVolume);
    }
    
    /**
     * Toggle music on/off
     */
    toggleMusic() {
        this.settings.musicEnabled = !this.settings.musicEnabled;
        this.saveSettings();
        
        if (!this.settings.musicEnabled) {
            this.stopMusic();
        }
        
        console.log('Music enabled:', this.settings.musicEnabled);
        return this.settings.musicEnabled;
    }
    
    /**
     * Toggle SFX on/off
     */
    toggleSFX() {
        this.settings.sfxEnabled = !this.settings.sfxEnabled;
        this.saveSettings();
        console.log('SFX enabled:', this.settings.sfxEnabled);
        return this.settings.sfxEnabled;
    }
    
    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }
}

// Sound Effect IDs (ready for implementation)
const SFX = {
    CLICK: 'click',
    CRAFT: 'craft',
    MISSION_START: 'mission_start',
    MISSION_SUCCESS: 'mission_success',
    MISSION_FAIL: 'mission_fail',
    CONVERSATION: 'conversation',
    UNLOCK: 'unlock',
    ERROR: 'error',
    NOTIFICATION: 'notification'
};

// Initialize audio manager
window.audioManager = new AudioManager();

console.log('Audio system loaded (ready for audio files).');
