# Maze Game — Joe's working notes

*Snapshot of Joe's live notes doc, taken 2026-09-09. The Drive doc is where
these are actually kept and edited; this copy exists so a session without
Drive access can read them. The to-do list at the top is the real backlog.*

## Maze Game

- The Dad spawns should walk into the fog of war after being there for awhile. Even if they aren't in a path.
- We should have o let one compass arrow per map.
- Make charcoal last 10 more tiles.
- We should scale the map fragments to the size of the map. 20% isn't bad for medium but for x-large it's way too big. It should be like 5-10%.
- Do we scale up the drops based off the size of the map?
- When we introduce new mechanics, we need to make a better performance out of it.
- I don't understand the puddle and the caretaker and the rock but visually in the pools. I think you should tap the rock and maybe drag it onto the pool then it creates a ripple effect.
- We should show the transition in the lighting at the start of the next level when you finish the child part. Show it slowly get brighter and pull out and play some cheerful music when we do it.
- I find I don't use chalk. Maybe others will. We should have something that requires it. Maybe.
- Make the kid smaller
- We should block the path final path at the main room until the player picks up the stone. "I haven't brought my burden"
- More squeeze throughs, those are fun, can even make a multi section that goes in Different directions.
- More moving pieces like we have.
- Don't need to shrink the character more when going through a squeeze.
- The chalk is huge now because of the character size. Maybe make the character a bit bigger like 10 percent.

## DONE?

## To Consider

- I want to know how many books I've collected this run.
- Kind of want to let you map the whole place and give you something for it.
- Would be nice to have little pets in the room that you can collect.
- The controls when doing a screen share are jittery.

## THOUGHTS

- I think we might need to go back to making the maps really big. I wanna capture the feeling of being lost in a maze and having to use the tools you find at your disposal to get out. Right now you can just brute force everything. This should make the chalk more useful.
- What if there was a couple of statues on the map, each representing something to the burdens. The players need to remember where these are at because they have to get something and bring it to them. Maybe a precursor to the conversation you have at the end. You make an offering and ask a question and get one answer back. Then the final pool room is the confrontation.
- The big levels get repetitious. It really does just feel like a lot more of the same. I think we need to think about set pieces or points of interest, things that makes up the space and make it feel different. We may also want to start to think about different biomes. That means we have to solve what is our first biome. Right now it is simply generic grayscale maze.
- What if chalk actually lets you draw in a little box and then that gets placed like a decal on the ground?
- We are still missing something special here. What's the mantra? "What's the mazest thing we can do, we do that."
- I think the story needs more form and structure to it. Answer some questions about what you want the player to feel. Then work backwards from that.
- A man wakes up in a maze. He's put himself here. He's forgotten everything he was and why he ended up here. He has to discover who he was by collecting the journals he left behind in previous years and versions of himself. The end of each level or collection of books he has an epiphany about something. In the end he finds his way out and back to the people who love him.
    - Does he start finding other stories that aren't about himself, but the people he loves, but he knows so little about them, too lost in his own mind. He has some way to talk to them. Pools you come across of light. Ask it a question. Feels like a fairy thing. It asks when you are coming home. Maybe their are a few of them. A spouse, a child, a parent, a friend. Each has a take on things or an arc. The child longs for you. The spouse is distant. The parent is guilty or makes you feel guilty. The friend is mad.

## IDEAS

- As we move through the different characters we should do a chapter break page that shows the name of the new character you are exploring.
- A map that you can look at to see where you've been.
    - There is something kind of cool about you just having a bunch of maps and not knowing exactly how they line up with each other.
    - We could make a little mini game of you having different squares of Maps that you could slide next to each other to figure out exactly how they go together. Cool idea.
    - Though again in a more hard-core mode would be that we don't let you know where you are on the map and let you figure it out.
- There are other things in the maze that are afraid of you. You can see an opposite version of yourself on the other side of walls you can't get to. They move out of frame and disappear.
- You can find thread in levels that's already been used. It runs for about 20 tiles. Can't be picked up.
- You can zoom into the maze and get a better look at things.
- There are pictures or writing on the walls. You tap and they are displayed on the screen as a window.
- We need different biomes that you move through. Well, I think you need to bring this biome to life more before you do that.
    - Small rocks scattered around. Stains in the corner. Broken crates.
- We should change the character avatar a little each character. Kid is smaller no black part on them. Next is bigger and no scars. We have ones that a grey, maybe.

## NOTES TO REMEMBER

- Each character is a wound that drove him away:
    - The abandoned child
    - the one who tried to control
    - the one who hardened
    - the one who filed everything instead of feeling it
    - the one who gave himself to something so he wouldn't have to be someone
    - the one who blamed himself
    - the one who got comfortable being lost.
- Somehow each story is a fantasy version of what happened to you or what you did to someone else. Like Where the Wild Things Are and how it dealt with trauma. It's "make believe". But when you get to the last levels, that gets stripped away. It's modern times. Phone calls, texts, conversations that you have to process in order to come out.

## Kid stuff

- **Smaller character** — we make the kid smaller.
- **Crawl gaps** — the small-spaces mechanic. Some walls have a low gap only the Child fits through: a shortcut between corridors, drawn as a dark notch in the wall. This is the tunnel system re-skinned, so it's nearly free. And it pays off for the rest of the game: in later phases the same gaps are still drawn, but sealed. Standing at one as the Soldier: *"I used to fit through here."* Growing up as a maze mechanic.
- **The swing** — a tile that slides back and forth on its own between two corridors, and you time stepping on and off. That's the slider code with a clock instead of a push. One or two per maze.
- **Ladder and slide** — you climb onto the wall tops, walk along them, and come down a slide somewhere else, fast and one-way. This is the biggest: it's a second walkable layer on top of the wall grid. Very kid, very good, and I'd hold it until the cheaper ones prove the phase — if crawl gaps already make the Child feel like a Child, the ladder may be more than needed.
- **Kid decor that does a little** — hopscotch squares chalked down a corridor (step them in order and the narrator counts); a ball lying in a dead end that rolls away when you approach; scribbles on walls at kid height. Cheap, and it makes the emptiness feel *like a child's* emptiness rather than nothing.
- **Smaller** — an XS size (7×10) for the Child so the density of these things is high. You're right that Small feels big when nothing's in it.

## Abandonment

- **The man walking away.** Yes — this is the one. A figure appears at the far edge of your light, in a corridor ahead, already walking away from you at about your speed; he turns a corner and is gone. If you chase, he's gone before you get there, every time. Never nearer, never reachable, never acknowledges you. Once or twice a maze. He should show up disproportionately when you've just found something — you look up and there he is, leaving. In later phases this becomes the Caretaker's "tall shape that recedes," so the same system carries all the way through.
- **"Wait here" as a rule of the room.** The first time you play, the room's door is *open* and the narrator says wait. Nothing happens if you wait — the composer plays its unfinished phrase, the man never comes. Only leaving does anything. Then *"but i didnt."* — which you already wrote, and which now has a reason.
- **Calling out.** Standing still for a while as the Child: *"hello?"* — with the sound actually echoing down the corridor and no answer. Small, and it lands the theme every time.
- **The trail that ends.** One corridor has someone else's chalk marks — an adult hand, arrows — that lead somewhere and simply stop. Nothing there.
