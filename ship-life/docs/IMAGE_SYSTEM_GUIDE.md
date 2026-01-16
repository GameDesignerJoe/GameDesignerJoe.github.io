# Image System Guide - Ship Life

## 📁 Folder Structure

The image system is **already built into the code** and ready to use!

```
ship-life/
├── assets/
│   └── images/
│       ├── guardians/      ← Guardian portraits
│       ├── rooms/          ← Room backgrounds
│       ├── missions/       ← Mission card visuals
│       ├── items/          ← Item icons
│       └── workstations/   ← Workstation visuals
```

---

## 🎨 How to Add Images

### Step 1: Add Your Image Files

Place your image files in the appropriate subfolder:
- **Guardian portraits:** `assets/images/guardians/stella.jpg`
- **Room backgrounds:** `assets/images/rooms/bridge.jpg`
- **Mission visuals:** `assets/images/missions/rescue_op.jpg`

**Supported formats:** `.jpg`, `.png`, `.gif`, `.webp`

---

### Step 2: Update JSON Files

Change the `visual` or `portrait` from `color` type to `image` type:

#### **Before (Color):**
```json
{
  "id": "stella",
  "name": "Stella",
  "portrait": {
    "type": "color",
    "value": "#FFD700",
    "show_name": true
  }
}
```

#### **After (Image):**
```json
{
  "id": "stella",
  "name": "Stella",
  "portrait": {
    "type": "image",
    "value": "guardians/stella.jpg",
    "show_name": false
  }
}
```

**Note:** Set `show_name` to `false` when using images (no need to overlay text)

---

## 📋 What Can Use Images?

### ✅ Guardians (portraits)
**File:** `data/guardians.json`
```json
"portrait": {
  "type": "image",
  "value": "guardians/stella.jpg",
  "show_name": false
}
```

### ✅ Rooms (backgrounds)
**File:** `data/rooms.json`
```json
"background": {
  "type": "image",
  "value": "rooms/bridge.jpg"
}
```

### ✅ Missions (card visuals)
**File:** `data/missions.json`
```json
"visual": {
  "type": "image",
  "value": "missions/rescue_operation.jpg",
  "show_name": false
}
```

### ✅ Items (icons)
**File:** `data/items.json`
```json
"icon": {
  "type": "image",
  "value": "items/plasma_rifle.png",
  "show_name": false
}
```

### ✅ Workstations (visuals)
**File:** `data/workstations.json`
```json
"visual": {
  "type": "image",
  "value": "workstations/fabricator.jpg",
  "show_name": false
}
```

---

## 🎯 Quick Start Example

### Add Stella's Portrait

1. **Add image file:**
   - Place `stella.jpg` in `ship-life/assets/images/guardians/`

2. **Update `data/guardians.json`:**
```json
{
  "id": "stella",
  "name": "Stella",
  "role": "Commander",
  "portrait": {
    "type": "image",
    "value": "guardians/stella.jpg",
    "show_name": false
  }
}
```

3. **Refresh game** - Stella now has her portrait!

---

## 💡 Tips

- **Image sizes:**
  - Guardian portraits: 200x200px recommended
  - Room backgrounds: 1920x1080px recommended
  - Mission cards: 600x400px recommended
  - Item icons: 128x128px recommended

- **File names:** Use lowercase with underscores (e.g., `stellar_forge.jpg`)

- **Mix & Match:** You can use images for some things and colors for others!

- **Testing:** Use the debug menu to quickly test changes

---

## 🔧 The Code (Already Works!)

The `renderVisual()` function in `js/ui.js` automatically handles both types:

```javascript
function renderVisual(visual, element) {
    if (visual.type === 'color') {
        element.style.backgroundColor = visual.value;
    } else if (visual.type === 'image') {
        element.style.backgroundImage = `url(assets/images/${visual.value})`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
    }
}
```

**No code changes needed!** Just add images and update JSON files.

---

## ✅ Ready to Use!

The image system is fully implemented and waiting for your art assets!
