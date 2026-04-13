== High priority — things that directly serve teaching: ==
- [DONE] A settings option somewhere that has a handful of controls:
    - [DONE] Flats Sharps toggle
    - [DONE] Left-Handed flip
    - [DONE] Color themes
    - [DONE] Instructions
    - [DONE] Archives
    - [DONE] Feedback/Bugs

- [DONE] Flats and sharps note names. Some of the notes are actually the same, but are the sharp or flat version. The teacher wants to have a toggle that displays either the flat or sharp option depending on the gottle. It changes all those notes that could go one way or the other. 
- [DONE] Left-handed flip — Mirror the fretboard. Lefty students exist. (Includes Right-handed, Left-handed, and Upside-down Lefty.)
- [DONE] Instructions: A help or instruction page or option that explains what everything is and how it all works with included visuals. (Text-based Help tab shipped — visuals can come later if needed.)
- [DONE] Bug: when you take away the 0 fret then some other frets and add the 0 fret back in, the circles that show the 0 fret are oval and squished. I would like them to stay circles and maintain their size. However, I do want them overall to be about half the size as the regular notes. 
== Medium priority — quality of life:==
- The position number isn't how the teach likes it. We need a way to set a default state or change it up. 1 is actually 4. The rest of the sequence is the same. We need to shift them down by four and look the rest around. Honestly, the teacher just needs to come over and sit down with me and we can do this part together.     
- [DONE] Archive: Save/load library — LocalStorage or simple JSON export so the teacher can build a collection of diagrams they use repeatedly across lessons, rather than rebuilding from URLs each time. A folder system for student. We talked about getting access to a google drive where the teacher could have student folders and add in different scales in them. However, that might be tricky to set up in a 'develop and walk away' dynamic that this is likely turning into. I dont want to always make sure I'm supporting this thing for him. If there's an easier way for that, that would be great. (Shipped file-based Save/Load using native Windows Save As / Open dialogs via the File System Access API, with download/upload fallback for Firefox/Safari. Files use the .gscale extension. Teacher can organize with any folder structure — Students folder with per-student subfolders, etc.)
- [DONE] Color themes as well. We put together a couple different color pallets that range from Light Mode, Black & White, White & Black, High Contrast, and one or two others to give some variety to what the thing can look like. (Shipped six themes: Midnight, Slate, Light, Sepia, High Contrast, Blueprint. Applied on-screen, in canvas exports, and in print.)
 

== Low Priority ==
- Editor: Being able to have the teach add scales themselves directly into the program. Perhaps an editor mode. My thought is that there's an editor mode, likely in the settings option. You can toggle on editor mode, the screen gets a red outline with text on the top that says editor mode. The teacher can select scales, keys, chords and change them. This saves it to default settings going forward. They hit the toggle to get out of Editor mode and back to normal. We'd likely want to lock this down with a simple passphrase so the kids don't do it by accident. Most of the drop downs that make sense, would have an "Add" option next to it where you could create a new scale for example. This would bring up a popup for what the scale would be called and then provide a blank fretboard for them to fill out. Once editor mode is turned off, that new option is now in the drop down. If you select a scale while in editor mode, there's a delete button somewhere that lets you delete that scale. This works for position as well. 
- Add a default finger positioning into the Labels dropdown. This puts the finger positions of the choards and what not automatically on it. 

== Less Important or Part of Another App ==
- A midi player that plays the fret, either as a full strum or as sequence?
- A strumming program like 8Strummer
- A way to translate a progression of frets to a more standard sheet music?
- A way to do some sort of training based off of the selected scales, like a guitar hero sort of experience where notes come up and the student has to play them?
- Is it possible to have the microphone active and to actually be able to detect that the correct note or chord was selected?
