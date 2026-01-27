# Planet Map Images

Place planet map images here.

**Recommended size:** 1920x1080px or similar widescreen format
**Format:** .jpg or .png

**Example files:**
- `crux_map.jpg`
- `earth_map.png`
- `terminus_shoal_map.jpg`

Then update `data/planets.json`:
```json
"map_image": {
  "type": "image",
  "value": "planets/crux_map.jpg"
}
```

Or use a color:
```json
"map_image": {
  "type": "color",
  "value": "#1a2332"
}
```
