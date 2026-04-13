== High priority — things that directly serve teaching: ==
- [DONE] The sequence feature. - Looks at the sequence/arpeggio order line that goes from dot to dot.
    We'd like to draw a line from the first note to the second, and so on. A green line that marks the path the student is supposed to press and in what order. We should have a new Label mode called Arpeggio/Sequence and when you're in this mode it does the line draw. The Teacher click on the first dot they want, then the second. When the first dot is clicked, we give it a green highlight. Then when the second one is selected, we draw a line to it and select the second dot, and so on.
- Add up to a 24 fret version. Let the teacher pick how many frets they want to show. Let the user add or subtract frets by turning the fret number into a add/remove button similar to what we do with the string letters. However, we only want to add or remove on the ends of the fret line. So, for example you can remove fret one, but not fret two until fret one is removed. You can add a 13 fret to the board. There's a small "+" at the very end of the fretboard (currently the 12th fret). Clicking this adds a 13th fret. If the 13th fret number is selected, it removes that fret. If then the 12th is selected, it removes the 12, if the 11th is selected it removes that one, and so on. But you can only add or remove from either end. With the additional frets, we will also be able to naturally extend the notes displaying on the fret as well. 

== Medium priority — quality of life:==
- A help or instruction page or option that explains what everything is and how it all works with included visuals.
- Left-handed flip — Mirror the fretboard. Lefty students exist.
- Highlight a path/sequence — Number the dots 1-2-3-4... to show a specific practice sequence or lick, not just "here are the notes." Add a 4th mode: "Sequence." When active, clicking dots assigns sequential numbers (1, 2, 3...) in the order you click them. Click a numbered dot again to remove it from the sequence (and renumber the rest). This keeps shift-click for fingers and uses a different interaction mode entirely. The teacher switches to "Labels: Sequence" mode, clicks dots in the order they want them played, done. Or Make the existing Shift+Click to represent both finger position and sequence. Downside is the sequence numbers could go high and there isn't a quick way to sequence through them if you're off.
- Save/load library — LocalStorage or simple JSON export so the teacher can build a collection of diagrams they use repeatedly across lessons, rather than rebuilding from URLs each time. A folder system for student. 
- Add a default finger positioning into the Labels dropdown
- Look at a locked url of a thing
- Being able to add scales, maybe it's all a text file.

== Guessing at other features ==
- A midi player that plays the fret, either as a full strum or as sequence?
- A way to translate a progression of frets to a more standard sheet music?
- A way to do some sort of training based off of the selected scales, like a guitar hero sort of experience where notes come up and the student has to play them?
- Is it possible to have the microphone active and to actually be able to detect that the correct note or chord was selected?
- [DONE] Ensure that when we export more than four frets we can scale to fit four frets on a portait page, since 4 time is pretty common. Or maybe some other features for how the scales fit on a page options during the export to pdf style?