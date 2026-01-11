# 🎵 Filename Format Guide

**Enhanced Parser - Supports Multiple Formats**

The scanner now intelligently parses filenames to extract Artist, Album, Track Number, and Title regardless of how you format them!

---

## ✅ Supported Formats

### **Format 1: Full Detailed Format (Your Preference)**
```
"Artist - Album - Track - Title.mp3"
```

**Examples:**
- `Joe Smith - My Album - 01 - My Song.mp3`
- `Joe Smith - My Album - Track 01 - My Song.mp3`

**Extracts:**
- Artist: Joe Smith
- Album: My Album
- Track: 01
- Title: My Song

**Perfect for:**
- Organizing by artist → album → track order
- Files that sort perfectly in file explorer
- Complete metadata in filename

---

### **Format 2: Artist & Title**
```
"Artist - Title.mp3"
```

**Examples:**
- `Joe Smith - My Song.mp3`
- `The Beatles - Hey Jude.mp3`

**Extracts:**
- Artist: Joe Smith
- Album: (from folder name)
- Track: null
- Title: My Song

**Perfect for:**
- Singles or standalone tracks
- When folder name represents the album

---

### **Format 3: Track & Title**
```
"TrackNum - Title.mp3"
```

**Examples:**
- `01 - My Song.mp3`
- `Track 01 - My Song.mp3`
- `#01 - My Song.mp3`

**Extracts:**
- Artist: (from folder name)
- Album: (from folder name)
- Track: 01
- Title: My Song

**Perfect for:**
- Album folders where all tracks are by same artist
- Numbered track lists

---

### **Format 4: Artist, Track, & Title**
```
"Artist - TrackNum - Title.mp3"
```

**Examples:**
- `Joe Smith - 01 - My Song.mp3`
- `Joe Smith - Track 01 - My Song.mp3`

**Extracts:**
- Artist: Joe Smith
- Album: (from folder name)
- Track: 01
- Title: My Song

**Perfect for:**
- Artist compilations
- When folder name represents the album

---

### **Format 5: Title Only**
```
"Title.mp3"
```

**Examples:**
- `My Song.mp3`
- `Great Track.mp3`

**Extracts:**
- Artist: Unknown Artist
- Album: (from folder name)
- Track: null
- Title: My Song

**Perfect for:**
- Quick/temporary files
- When all metadata comes from folder structure

---

## 🎯 Track Number Recognition

The parser recognizes these track number formats:
- `01`, `1`, `001` (just digits)
- `Track 01`, `Track 1` (with "Track" prefix)
- `#01`, `#1` (with hash symbol)
- `01.`, `1.` (with period)

All extract the numeric part: `01` or `1`

---

## 📁 Folder Structure Integration

### **Album from Filename vs Folder**

**Filename includes album:**
```
/Dropbox/Music/Joe Smith - My Album - 01 - Song.mp3
                         ^^^^^^^^
                         Used as album name
```

**Filename doesn't include album:**
```
/Dropbox/Music/My Album Folder/Joe Smith - 01 - Song.mp3
               ^^^^^^^^^^^^^^^^
               Used as album name
```

**Priority:**
1. Album in filename (if present)
2. Parent folder name (fallback)

---

## 🎨 Cover Art

### **Folder Cover Art**

Place an image file named `cover` in any album folder:
- `cover.jpg`
- `cover.png`
- `cover.jpeg`

The scanner will automatically use it as album art for all songs in that folder!

**Example structure:**
```
/Music/
  /My Album/
    cover.jpg           ← Album art for all songs!
    01 - Song One.mp3
    02 - Song Two.mp3
    03 - Song Three.mp3
```

---

## 🔄 Smart Parsing Examples

| Filename | Artist | Album | Track | Title |
|----------|--------|-------|-------|-------|
| `Joe - Album - 01 - Song.mp3` | Joe | Album | 01 | Song |
| `Joe - Song.mp3` | Joe | (folder) | null | Song |
| `01 - Song.mp3` | (folder) | (folder) | 01 | Song |
| `Song.mp3` | Unknown | (folder) | null | Song |
| `Joe - 05 - Song.mp3` | Joe | (folder) | 05 | Song |
| `Track 12 - Song.mp3` | (folder) | (folder) | 12 | Song |

---

## 💡 Best Practices

### **For Your Detailed Format:**

✅ **DO:**
```
Joe Smith - Tantamount - 01 - Opening Theme.mp3
Joe Smith - Tantamount - 02 - Main Melody.mp3
```

This gives you:
- Perfect sorting by artist → album → track → title
- Complete metadata without ID3 extraction
- Readable filenames in file explorer
- Works great on mobile!

### **For Singles (Not Part of an Album):**

✅ **DO:**
```
Joe Smith - My Single Track.mp3
```

Or put in a folder:
```
/Singles/
  Joe Smith - Track One.mp3
  Joe Smith - Track Two.mp3
```

### **For Quick Organization:**

✅ **DO:**
```
/Artist Name/
  /Album Name/
    01 - Song.mp3
    02 - Song.mp3
```

The scanner will use folder names for Artist/Album.

---

## 🚀 After Renaming Files

1. **Remove old folders from Sources:**
   - Go to Sources screen
   - Click checkmarks to deselect folders

2. **Re-add the folders:**
   - Click "+" on the folder
   - Wait for scan to complete

3. **Check Home screen:**
   - All metadata should now be correct!
   - Artist, Album, Track numbers displayed

4. **Verify in Library:**
   - Songs should sort by artist → album → track
   - All info properly filled in

---

## 📝 Notes

- **Separator:** Always use ` - ` (space-dash-space) between parts
- **Dropbox files:** Only filename parsing (no ID3 download)
- **Local files:** Full ID3 extraction with embedded art!
- **Track numbers:** Can be 1-3 digits (1, 01, 001)
- **Case insensitive:** "Track" or "track" both work

---

## 🎉 Your Format is Fully Supported!

Your detailed format:
```
"Joe Smith - Tantamount - 01 - Opening Theme.mp3"
```

Will perfectly extract:
- ✅ Artist: Joe Smith
- ✅ Album: Tantamount
- ✅ Track: 01
- ✅ Title: Opening Theme

And files will sort exactly how you want:
1. By artist name
2. By album name
3. By track number
4. By title

**Happy organizing!** 🎵
