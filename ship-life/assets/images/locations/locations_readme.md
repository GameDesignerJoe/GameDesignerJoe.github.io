# Location Images

Place location images here.

**Recommended size:** 1920x1080px or similar widescreen format
**Format:** .jpg or .png

**Example files:**
- `frozen_wastes.png`
- `burning_plains.png`
- `crystal_caves.png`

Then update `data/locations.json`:
```json
"location_image": {
  "type": "image",
  "value": "locations/frozen_wastes.png"
}
```

Or use a color:
```json
"location_image": {
  "type": "color",
  "value": "#4a5f8c"
}
```
