# Ship Life - Audio Implementation Guide

## Overview
The audio system is **ready to go** - it just needs MP3 files! The code is written, hooks are in place, you just need to add your audio files.

---

## 📁 File Structure

Create these folders and add your MP3 files:

```
ship-life/
├── audio/
│   ├── music/          ← Background music tracks
│   │   ├── landing.mp3
│   │   ├── mission_computer.mp3
│   │   ├── workstations.mp3
│   │   ├── planetfall.mp3
│   │   ├── observation_deck.mp3
│   │   └── quarters.mp3
│   │
│   └── sfx/            ← Sound effects
│       ├── click.mp3
│       ├── craft.mp3
│       ├── mission_start.mp3
│       ├── mission_success.mp3
│       ├── mission_fail.mp3
│       ├── conversation.mp3
│       ├── unlock.mp3
│       ├── error.mp3
│       └── notification.mp3
```

---

## 🎵 Step 1: Add Music Files

1. Create `ship-life/audio/music/` folder
2. Add MP3 files for each room (name them exactly as shown above)
3. Music will automatically loop when entering a room

**Recommended Music:**
- **Landing**: Ambient, mysterious
- **Mission Computer**: Energetic, tactical
- **Workstations**: Mechanical, industrial
- **Planetfall**: Tense, action
- **Observation Deck**: Calm, conversational
- **Quarters**: Relaxing, reflective

---

## 🔊 Step 2: Add Sound Effect Files

1. Create `ship-life/audio/sfx/` folder
2. Add MP3 files for each sound effect

**Sound Effects List:**
- `click.mp3` - UI button clicks
- `craft.mp3` - Crafting an item
- `mission_start.mp3` - Mission begins
- `mission_success.mp3` - Mission completed successfully
- `mission_fail.mp3` - Mission failed
- `conversation.mp3` - Dialogue advance
- `unlock.mp3` - New content unlocked
- `error.mp3` - Error/invalid action
- `notification.mp3` - Generic notification

---

## ⚙️ Step 3: Activate the Audio System

Once you've added your MP3 files, uncomment the code in `js/audio.js`:

### Enable Music Playback
Find this in `audio.js` (~line 40):
```javascript
playMusic(musicId) {
    if (!this.settings.musicEnabled || !musicId) return;
    
    console.log(`[Audio] Would play music: ${musicId}`);
    
    // TODO: Implement when audio files are added
    // UNCOMMENT THESE LINES:
    // if (this.currentMusic === musicId) return;
    // 
    // this.fadeOutMusic(() => {
    //     const audio = new Audio(`audio/music/${musicId}.mp3`);
    //     audio.loop = true;
    //     audio.volume = this.settings.masterVolume * this.settings.musicVolume;
    //     audio.play();
    //     this.currentMusic = musicId;
    // });
}
```

### Enable Sound Effects
Find this in `audio.js` (~line 90):
```javascript
playSFX(sfxId) {
    if (!this.settings.sfxEnabled || !sfxId) return;
    
    console.log(`[Audio] Would play SFX: ${sfxId}`);
    
    // TODO: Implement when audio files are added
    // UNCOMMENT THESE LINES:
    // const audio = new Audio(`audio/sfx/${sfxId}.mp3`);
    // audio.volume = this.settings.masterVolume * this.settings.sfxVolume;
    // audio.play().catch(e => console.error('SFX play failed:', e));
}
```

---

## 🎮 Step 4: Add Music to Rooms (JSON Configuration)

**Music is configured via JSON!** You control which track plays in each room by editing `data/rooms.json`.

Add a `"music"` field to each room. The value should match your MP3 filename (without the .mp3 extension):

```json
{
  "rooms": [
    {
      "id": "landing_page",
      "name": "Landing Page",
      "background": { "type": "color", "value": "#0a0e27" },
      "title_display": false,
      "music": "landing"    ← Plays audio/music/landing.mp3
    },
    {
      "id": "mission_computer",
      "name": "Mission Computer",
      "background": { "type": "color", "value": "#2c3e50" },
      "title_display": true,
      "music": "mission_computer"    ← Plays audio/music/mission_computer.mp3
    },
    {
      "id": "quarters",
      "name": "Quarters",
      "background": { "type": "color", "value": "#1f2833" },
      "title_display": true,
      "music": "quarters"    ← Plays audio/music/quarters.mp3
    }
    // ... repeat for all rooms
  ]
}
```

**How it works:**
- The `"music"` field is OPTIONAL - if omitted, no music plays
- The value references a file: `"landing"` → looks for `audio/music/landing.mp3`
- You can use the same track for multiple rooms: `"music": "mission_computer"` in two different rooms will play the same track
- Change the value anytime - just edit the JSON and reload!

**Example - Using one track for multiple rooms:**
```json
{
  "id": "workstation_room",
  "music": "ambient_work"
},
{
  "id": "knowledge_base", 
  "music": "ambient_work"    // Same track as workstations
}
```

---

## 🎛️ Using Audio in Code

The audio system is already hooked up in various places. Here's where audio is used:

### Background Music (Automatic)
Music automatically plays when switching rooms:
- `js/rooms.js` - `setRoomBackground()` calls `audioManager.playMusic()`

### Sound Effects (Manual Calls)
Sound effects are triggered in:
- **Button Clicks**: `js/ui.js` - All button creation
- **Crafting**: `js/workstations.js` - When crafting succeeds
- **Missions**: `js/missions.js` - Mission start/success/fail
- **Conversations**: `js/conversations.js` - Dialogue advancement
- **Unlocks**: Various files - When new content unlocks

**Example - Adding SFX to a button:**
```javascript
button.onclick = () => {
    audioManager.playSFX(SFX.CLICK);  // Play click sound
    // Rest of button logic...
};
```

---

## 🎚️ Audio Controls (Already Built!)

Players can control audio from the debug menu:
- **Toggle Music**: On/Off
- **Toggle SFX**: On/Off
- **Test Sound**: Play a test sound effect

Settings are saved to localStorage and persist across sessions.

---

## 🔧 Testing Your Audio

1. Add at least one music file (e.g., `audio/music/mission_computer.mp3`)
2. Add at least one SFX file (e.g., `audio/sfx/click.mp3`)
3. Uncomment the code in `audio.js` as described above
4. Reload the game
5. Navigate to Mission Computer → Music should play
6. Click any button → Click sound should play
7. Open debug menu → Toggle audio on/off to test

---

## 📝 Available Sound Effect Constants

Use these constants when calling `audioManager.playSFX()`:

```javascript
SFX.CLICK            // Button/UI clicks
SFX.CRAFT            // Crafting success
SFX.MISSION_START    // Mission launched
SFX.MISSION_SUCCESS  // Mission succeeded
SFX.MISSION_FAIL     // Mission failed
SFX.CONVERSATION     // Dialogue advance
SFX.UNLOCK           // Content unlocked
SFX.ERROR            // Error/invalid action
SFX.NOTIFICATION     // Generic notification
```

---

## 🎵 Audio File Recommendations

**File Format**: MP3 (best browser compatibility)
**Sample Rate**: 44.1kHz
**Bit Rate**: 128-192 kbps (good quality, reasonable file size)

**Music Lengths:**
- Background tracks: 2-5 minutes (they loop)
- Keep file sizes reasonable (<5MB per track)

**SFX Lengths:**
- Very short: 0.1-0.5 seconds (clicks, errors)
- Short: 0.5-2 seconds (craft, unlock, notification)
- Medium: 2-5 seconds (mission start/success/fail)

---

## 🚀 Quick Start Checklist

- [ ] Create `ship-life/audio/music/` folder
- [ ] Create `ship-life/audio/sfx/` folder
- [ ] Add your MP3 files
- [ ] Uncomment music code in `js/audio.js` (line ~40)
- [ ] Uncomment SFX code in `js/audio.js` (line ~90)
- [ ] Add `"music"` field to rooms in `data/rooms.json`
- [ ] Test in game!

---

## 💡 Tips

1. **Start Small**: Add just 1-2 tracks to test before adding all audio
2. **Volume Levels**: The system has master, music, and SFX volume controls
3. **Browser Autoplay**: Modern browsers require user interaction before playing audio. The game handles this automatically.
4. **File Size**: Keep total audio under 50MB for reasonable load times
5. **Fallback**: If an audio file is missing, the game still works (just silent)

---

## 🎵 Music vs Sound Effects Configuration

### Music (JSON Configurable ✅)
**Background music IS configured via JSON!**
- Edit `data/rooms.json` to change which track plays in each room
- Change the `"music"` field anytime
- No code editing required

### Sound Effects (JavaScript Only ❌)
**Sound effects are triggered from code, not JSON.**
- Button clicks, crafting, mission events, etc. trigger SFX from JavaScript
- To change which sound plays for an action, you need to edit the JavaScript file
- Example: To change the crafting sound, edit `js/workstations.js`

**Why this distinction?**
- Music is tied to **locations** (rooms) - easy to configure via JSON
- Sound effects are tied to **actions** (clicks, crafts, events) - triggered by code logic

**Can I add custom sounds without editing code?**
- Yes for music - just name your MP3 to match the `"music"` value in rooms.json
- No for SFX - the filename mapping is in JavaScript (e.g., `SFX.CLICK` → `click.mp3`)

---

## 🎯 That's It!

The audio system is fully implemented and waiting for your MP3 files. Just add the files, uncomment 2 code blocks, and you're done!

**Questions?** Check `js/audio.js` for the full implementation.
