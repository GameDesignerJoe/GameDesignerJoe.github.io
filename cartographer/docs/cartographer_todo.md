TODO:
PRI1:
- Need a debug that shows where a valid spot to survey would be (I might just need to have us pick fixed locations on the map that are good spots to survey). I'm finding more and more that depending on where I put down a sextant marking, I can screw myself out of getting all the numbers. So, we either need to determine that 'you've found enough and give them to you or we need to start dropping in 'Sextant Stones' that have you take a reading from that location. You find all 5 of them and use the sextant you get the coordinates. 
- Need a noise for when the location comes up at the start. Just use the one you're using for when you discover a landmark.
- The quest completion popups don't look as good as the location name popup. The location name popup is in the style of the game, where as the completion popups are boring boxes and fonts. This is also true with the menu popup and the quest background box. Please update these to match the style of the location popup. 
- You should look at making treasure maps where you have to check the distance between two points to draw a line, then the distance between two othe intersecting points to draw an X. Where the two lines meet, is where you can then collect something important (like our journals), but for now, we'll just have it be gold. 
- On mobile you should think about creating a 'virtual controller in the bottom right that lets you steer the player around. 
Control improvements:
    - Make left click move
    - Make double click on the left Survey
    - Make right sextant
    - Make double right click collect if you are clicking on the object and close enough. 
    - mouse wheel does measure
    - All of these return to 'walk' once you've done them. 
- You're starting to see 'islands' that you can get to. they'll have a single land tile and it isn't connected to the mainland so you can't get to it. Worse, one of them had a collectible out there. 

PRI2:
- The Discovered locations should use the same popup we're using for quest completion and new locations. 
- Add a little more mechanics into the gameplay buttons you have:
    - Survey brings up a circle and you have to drag, clockwise around it to 'survey' the space. Then it fills it all in. 
    - Sextant brings up a picture of the sun over a horizon line. There's a circle that you need to click on and drag it over the sun to get a measurement. Numbers that look like coordinates/measurements appear on the size and change as you move the circle. 
- Look at getting the square tiles to take on more of the curved shape like the border so it feels more natural. The bessver curve or whatever.
- Take another swing at getting rid of the hard straight lines on the island border.
- Feel like we should have areas that the players can't walk, step cliffs and they have to find their way around them. This would mean we'd need to keep an eye on pathing so the player doesn't get trapped in a space or can't get to certain areas. 
- Add the locations to measure to a new indented line.
- You're going to eventually want to come up with things that can happen on the maps that make it slightly more interesting to solve the quests. Right now, while everything is in different locations and the island is a different shape, you're not doing anything different gameplay wise. 
- Consider some sort of measure mechanics where you have to place a marker down and then go to another location and then 'look' for that marker to see it and measure its distance. So, the look at would be you dragging and holding a circle over the marker as the distance simulates being calculated. This is closer to actual measuring. 
- Need some opening text while on the boat about 'the map of my heart is like the map of the world' or 'I will find you my love, even if I must map the whole damn world.' This is written out with pen scratching 
noises on a piece of parchment popup. 

PRI3:
- Figure out how to get actual animation in for some sprites to see about making a chracter with a walk cycle.
- Explore topographical options for map display.
- Need to add some magic to the collecting of the samples. Maybe a happy sigh from the character. 
- Need to look into a journal entries for the samples you collect. The writing of lines that appear somewhere "The ancient shell of nanatoto said to bear whisper of a lost love if you put your ear to it."
- If we could pop the landmark names when you discover them along with the landmakrk themselves a bit that will draw the eye to it for the player to see what they just discovered. 
- I think all the tiles should have a texture on them so they stand out more than just the flat color. 
- you should do custom sounds for each of the collectibles. 
- Music and sound plays despite my phone being muted. 
- ui in mobile issues, clip in the top, interact button bar too high and had extra space, the text clips over the ui buttons
- Measure doesn’t work
- move, survey, etc. is awkward at the moment
- movement around corners isn’t smooth
- Add an appreciate button on the bar, maybe it’s the same. Look and record. 
- help text says WASD when on mobile 
- Quest text can be smaller on mobile
- We should let you go to the ship and leave the island if you want (or if there's a bug).