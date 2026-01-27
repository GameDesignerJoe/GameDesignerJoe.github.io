# Item Icons

Place item icon images here (equipment, aspects, resources, blueprints).

**Recommended size:** 128x128px or 256x256px
**Format:** .png (transparent background recommended)

**Example files:**
- `plasma_rifle.png`
- `shield_generator.png`
- `rare_alloy.png`

Then update `data/items.json`:
```json
"icon": {
  "type": "image",
  "value": "items/plasma_rifle.png",
  "show_name": false
}
```
