# Mission Card Visuals

Place mission card header images here.

**Recommended size:** 600x400px or 800x533px
**Format:** .jpg or .png

**Example files:**
- `rescue_operation.jpg`
- `training_exercise.png`
- `salvage_run.jpg`

Then update `data/missions.json`:
```json
"visual": {
  "type": "image",
  "value": "missions/rescue_operation.jpg",
  "show_name": false
}
```
