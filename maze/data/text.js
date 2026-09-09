// The Maze — everything the player reads
//
// All of it in the interior voice: first person, half-remembered. The
// Child never speaks in an adult voice. Rewrite freely — the engine only
// ever displays these, it never reads them for meaning.
//
// Loaded by maze-topdown.html before the engine, as a plain script. These
// are the same consts the game has always had, just in their own file.

// what the shelves and the basin say, in the voice of the self whose pages you're finding.
// index climbs with how many of their pages you hold: little truth, some, most.
const ROOM_LINES = {
  'The Child':          { shelf: ["books. i cant reach the top ones.", "somebody put these here for me maybe.", "i think i know who wrote these. i dont want to say."], basin: ["rocks in a bowl. heavy ones.", "i tried to pick one up. its stuck to me.", "the man gave me these to hold. i think i can put them down now."] },
  'The Cartographer':   { shelf: ["Shelving. Someone indexed this place before me.", "The spines are ordered. Not by author — by need.", "These are surveys of the same territory. Mine included. All of them wrong in the same way."], basin: ["Seven stones. Weight, catalogued.", "A stone for each survey that failed. That is a reading, not a fact.", "I have been carrying the map's mistakes as if they were mine."] },
  'The Soldier':        { shelf: ["Inventory: shelves, five. Contents, unknown.", "Field notes from other units. Same terrain.", "Every one of them was me on a different rotation. I would follow any of them."], basin: ["Ballast. Something to steady a hand.", "You don't put down what keeps you upright. That's what I was taught.", "What I was taught was wrong. These aren't ballast. They're what I couldn't set down in front of anyone."] },
  'The Archivist':      { shelf: ["The shelving is sound. I know because I built it.", "Filed by hand. Not my hand. Nearly.", "I have read every page in this room. I know whose they are. I am not ready to file that."], basin: ["Seven items, stone, unlabelled. Unusual for me.", "I have never catalogued these. I think I refused to.", "Entry: each stone is a thing I recorded instead of felt."] },
  'The Priest':         { shelf: ["Scripture, or something like it. Written by the lost.", "Each of these gave themselves to something. Only one of them to God.", "The same soul on every shelf, praying in different words."], basin: ["An offering bowl. The offerings were never made.", "I fasted rather than set these down. It felt like devotion.", "What I called devotion was a way to keep holding on."] },
  'The Criminal':       { shelf: ["Books. Somebody's confession, probably. Everyone's got one.", "I read a page. Kid's handwriting. I put it back fast.", "They're all mine. Every shelf. I don't know how to be sorry to that many people."], basin: ["Rocks. Fine. I'll carry rocks.", "Heavier than they look. Like most things I did.", "Nobody handed me these. I picked every one of them up myself."] },
  'The One Who Stayed': { shelf: ["I dust these. I have for years.", "I know the order they go in. I know why.", "I have read them so many times I could have written them. I did write them."], basin: ["I keep the stones here. It's tidy.", "Some days I take one out and hold it. Then I put it back.", "There is no reason to keep them except that keeping them means staying."] },
  'You':                { shelf: ["I wrote these.", "I wrote these.", "I wrote these."], basin: ["It's empty. It's just water.", "It's empty. It's just water.", "It's empty. It's just water."] },
};

const LIGHTER = ["Feels lighter now.", "One fewer. I can tell.", "I set something down. I remember doing it.", "The pile is smaller. So am I, somehow.", "Lighter. Not light. Lighter.", "Almost nothing left to carry.", "The water. I can see the water."];

const EMPTY_SHELF = [
  "An empty shelf. What is its purpose?",
  "Nothing here. Not yet, or not anymore.",
  "A shelf built for something. I don't know what.",
  "Dust, and the shape of where books would go.",
];

const SHELF_LINES = [
  "A collection of notes. Where did these come from?",
  "Someone has been keeping these. I don't remember starting.",
  "Five shelves. I know the hands that filled them, and I don't.",
  "Pages stacked with care. Not mine. Almost mine.",
  "The books are arranged the way I would arrange them. That should worry me more than it does.",
];

// what each self says to themselves while walking (the timed narrator). No repeats until all have played.
const SELF_LINES = {
  'The Child':          ["is anybody there?", "i counted to a hundred. then i counted again.", "the walls are warm if you put your face on them.", "im not scared. im not.", "if i keep walking the man will see me walking and be sad.", "i left a mark so i can find me later."],
  'The Cartographer':   ["Grid holds. For now.", "This corridor was not here yesterday. I am confident in the instruments.", "A map is a promise the ground doesn't have to keep.", "I have indexed this junction twice. It has two different numbers.", "If I cannot map it, I can at least describe how it refuses."],
  'The Soldier':        ["Water, half. Light, failing. Discipline, holding.", "Mark the junction. Move. Don't think about the count.", "Rooms make you feel found. Keep moving.", "The place isn't the enemy. That's harder.", "Things I will see again: nothing yet. Keep walking."],
  'The Archivist':      ["Entry: corridor, unremarkable. Cross-reference pending.", "I have not read them for meaning. I keep telling myself that.", "Procedure is a way of not standing still long enough to notice.", "Note to file: I stood here longer than the entry required.", "Everything is catalogued. Nothing is understood."],
  'The Priest':         ["I take each turning as it is given.", "The dark has a texture. Like cloth.", "I believe I am being held. I have to believe it.", "To mark is to doubt. I have marked anyway.", "There is a room at the center. I feel it the way the blind feel a window."],
  'The Criminal':       ["Walked in on purpose. Remember that.", "Wall won. Wall always wins.", "Kid's marks again. Whoever left a child down here.", "Nobody's coming. Good. Nobody should.", "Tired. Not the sleeping kind."],
  'The One Who Stayed': ["I know this turn. I know the next one.", "It's quiet. Nothing asked of me. That used to be the point.", "Someone is still waiting. I have made a room out of their waiting.", "I sweep these halls. Whose halls did I think they were?", "The way out is that way. It has always been that way."],
  'You':                ["I know this room.", "I know these halls. I walked them as everyone.", "There is nothing left to carry.", "The door is open. It has been for a while."],
};

const NARRATOR = [
  "How did I get here?",
  "Why is this so familiar?",
  "This maze — is it real?",
  "The Labyrinth shifts for those who move through it, molding itself to the mind of the visitor.",
  "I have counted these halls before. The number is never the same.",
  "The walls are patient. They have outlasted everyone who tried to remember them.",
  "Someone marked this floor once. Perhaps it was me.",
  "The House does not want me lost. It simply does not want me found.",
  "Every corridor leads somewhere. That was never the problem.",
  "I am not the first to walk here. I may be the first to notice.",
  "The dark is not empty. It is only unlit.",
  "If I am the visitor, who is the host?",
  "The exit is a door, and every door is also an entrance.",
  "I keep expecting to meet myself coming the other way.",
];

// Five past selves. Each maze picks one; its pages are scattered through the rooms, in order.
const CAST = [
  { name: 'The Child', summary: 'Hope someone came back for them.', wake: "the man said wait here.", leave: "but i didnt.", pages: [
    "i dont no this place. the man said wait here and he wud come back. i am waiting.",
    "i made a X on the floor so the man can find me. i made lots of X. now i am out of chalk.",
    "the walls are warm if you put your face on them. i think the maze is sleeping.",
    "i am not scared any more. i think the man is not coming. thats ok. i am ok.",
    "if you find this you are doing good. keep going. i left the light on for you.",
  ]},
  { name: 'The Cartographer', summary: 'Hope she found the map she was looking for.', wake: "This is a solvable place.", pages: [
    "Day 1. Grid established from the entrance. Every corridor can be indexed. Every index can be walked. This is a solvable place.",
    "Day 4. Sector C does not match yesterday's survey. I have checked my instruments twice. I am confident in the instruments.",
    "Day 9. I followed someone's twine for an hour. It led back to my own first marks. The handwriting was not mine. It was very nearly mine.",
    "Day 16. The map is finished. It is beautiful. It is wrong. I am no longer certain which of those matters.",
    "I have stopped correcting it. Whoever comes next: the map is a portrait, not a plan. Read it that way.",
  ]},
  { name: 'The Soldier', summary: 'He counted everything. Hope the count came out.', wake: "Mark every junction. Move at first light.", pages: [
    "Inventory: water, four days. Rations, six. Chalk, one stick. Discipline, sufficient. Mark every junction. Move at first light.",
    "Rations, two. The chalk ran out before the corridors did. I have started marking with what I have. I do not recommend it.",
    "Rested in a wide room. Rooms are dangerous; they make you feel found. Kept moving.",
    "No supplies. Learned something: this place is not the enemy. It does not want anything. That is harder.",
    "Things I will not see again: the river behind the barracks. My mother's kitchen. Rain on a tent. Whoever reads this — see them for me.",
  ]},
  { name: 'The Archivist', summary: 'He wrote everything down. Hope he read it back.', wake: "Item: one man, waking. Condition: unknown.", pages: [
    "Catalogue, entry 1. Five shelves in the first room. I built them. Whoever comes after will need somewhere to put what they find.",
    "Entry 40. The Cartographer's sheets, 31 pages, water-damaged. The Soldier's list, one page, folded eleven times. Filed by author. I have not read them for meaning. Meaning is not my department.",
    "Entry 112. A child's marks in chalk, corridor C-9 through C-14. Cross-referenced. Note: I stood at C-14 for some time. This is not procedure.",
    "Last entry. I have read them. All of them. I know whose they are now. I am going to put this pen down and sit with that for as long as it takes.",
  ]},
  { name: 'The Priest', summary: 'Hope the emptiness was worth it.', wake: "I came here to be emptied.", pages: [
    "I came here to be emptied. The corridors are patient teachers. I take each turning as it is given.",
    "Fasted three days. The dark has a texture now, like cloth. I believe I am being held.",
    "Marked no junctions today. To mark is to doubt. To doubt is to carry. I have put down the chalk.",
    "There is a room at the center. I have not found it. I feel it the way the blind feel a window.",
    "And the walls said: you were never lost, only unwilling. And I said yes. And the way was open.",
  ]},
  { name: 'The Criminal', summary: 'Hope he made peace with it. Hope that was enough.', wake: "Don't know who built this. Don't care.", pages: [
    "Don't know who built this. Don't care. Walked in on purpose. Better than what was behind me.",
    "Found a kid's chalk marks. Dozens of them. Whoever left a child down here deserves worse than this place.",
    "Kicked a wall for an hour. Wall won. Everything wins against me eventually. That's the whole story.",
    "Tired. Not the sleeping kind. The kind where you stop arguing with the floor about who's right.",
    "If anyone finds this: I did it. All of it. Nobody put me here. That's the first true thing I've written.",
  ]},
  { name: 'The One Who Stayed', summary: 'He knew the way out. He knew everyone here.', wake: "I have been here longer than I have been anywhere.", pages: [
    "I know where the exit is. I have known for a long time. The child, the mapmaker, the soldier, the clerk, the monk, the thief — I've read them all. I sweep their halls.",
    "It is quiet here and the walls ask nothing. Out there someone is still waiting, and I have made them wait so long that the waiting has become a room of its own.",
    "I am going to write my name. Not here. At the door.",
  ]},
  { name: 'You', summary: '', wake: "I know this room.", pages: [] },
];

// ── the pools: between phases. One stone, one gate, one person who loves you. Caretaker hosts. ──
// index = stone being put down. Each exchange: they speak, you choose, they answer. Then you set the stone in the water.
const POOLS = [
  { who: 'Father', stone: 'Sight', approach: ["He said wait here. I waited. That is the whole of what I did wrong.", "If he's at the water I don't know if I'll go to him or hit him."],
    open: "I told you to wait. I was going to come back. I want to say that first, because it's true, and it doesn't matter.",
    ex: [ { say: "You did nothing wrong. Hear me. Nothing. I left a child in the dark and called it a minute.", choices: ["I hate you.", "Why didn't you come back?"], reply: ["Good. Say it as long as you need. I'll still be here when you're done.", "Because I was a coward, and then because I was ashamed, and then because too much time had gone. None of those were you."] },
          { say: "You've been standing where I put you for a very long time.", choices: ["I thought if I moved you'd never find me.", "I stopped waiting for you years ago."], reply: ["I know. That's the part I'll carry. Not you. Me.", "Then you were the brave one. Let me be the one who came anyway."] } ],
    close: "It was never you. It was me. You can see a little further now." },
  { who: 'Wife', stone: 'Pace', approach: ["Every plan I drew for us had a line through it by the second year.", "She is going to ask why I needed the map. I don't have an answer that isn't the map."], open: "You drew me a map once, of how our life would go. It was beautiful. It was wrong.",
    ex: [ { say: "Every turn you couldn't plan, you took as a failure. Mine too.", choices: ["I wanted it to hold still.", "I was afraid of getting it wrong."], reply: ["Nothing holds still. You knew that. You loved that, before.", "You did get it wrong. So did I. We were still here."] },
          { say: "What would you do if you didn't have the map?", choices: ["Walk anyway.", "Ask you."], reply: ["Then walk. I'll keep up.", "Then ask. I've been waiting to be asked."] } ],
    close: "Slower isn't safer. You can move now." },
  { who: 'Brother', stone: 'Memory', approach: ["I put him on the list. Things I won't see again. He was alive when I wrote it.", "Rations, none. Discipline, none. Just this hall and whatever's at the end."], open: "You made a list of everything you'd never see again. I was on it. I'm right here.",
    ex: [ { say: "You rationed everything. Even the parts of you I wanted.", choices: ["I thought discipline would get me out.", "I didn't know how else to be."], reply: ["It got you far. It didn't get you home.", "You knew once. You were the kid who laughed too loud."] },
          { say: "Tell me one thing you'd put back on the list. The good one.", choices: ["Rain on a tent.", "Mom's kitchen."], reply: ["I'll take you camping. Bring nothing.", "Sunday. She's already cooking."] } ],
    close: "You don't have to hold it all in your head. Some of it we hold for you." },
  { who: 'Daughter', stone: 'Fear', approach: ["Entry: the year she stopped calling. I filed it. I did not call back.", "I have every fact about her and I could not tell you what she wanted from me."], open: "Dad. You wrote everything down and read none of it. I read it. All of it.",
    ex: [ { say: "You catalogued me too. Height, grades, the year I stopped calling.", choices: ["I didn't know what else to do with it.", "I was afraid of what it meant."], reply: ["You could have asked me what it meant.", "It meant I missed you. That's all it ever meant."] },
          { say: "What's the one entry you never filed?", choices: ["That I was proud of you.", "That I was sorry."], reply: ["File it now. Out loud.", "Filed. Received. Come on."] } ],
    close: "It's less dark than you kept telling yourself." },
  { who: 'Father', stone: 'Direction', approach: ["I prayed for an hour every night in the room next to his and never once knocked.", "He taught me the kneeling. I taught myself the silence."], open: "You gave yourself to everything but the people in the room. I know. I taught you that.",
    ex: [ { say: "I prayed instead of talking too. You learned it from watching.", choices: ["I thought it made me good.", "It was easier than looking at you."], reply: ["It made you quiet. Those aren't the same.", "I know. I'm looking at you now."] },
          { say: "If you could ask for one thing and have it, right here.", choices: ["To be told I'm enough.", "To go home."], reply: ["You're enough. You always were. I should have said it.", "Then go. The way's shorter than you think."] } ],
    close: "You'll hold a direction a little longer now." },
  { who: 'Oldest friend', stone: 'Shame', approach: ["He knows what I did. He knew before the others. He's the one I never let say it back.", "There is a sentence I have been serving that no one handed down. I set the term myself."], open: "Nobody put you here. I know. You've said it. Now hear the rest.",
    ex: [ { say: "You did the thing. It's done. You've been serving a sentence no one else handed down.", choices: ["Someone should have.", "I couldn't forgive it."], reply: ["Maybe. But not forever. Not this.", "Then let me. I do. I did years ago."] },
          { say: "What do you want, if you stop carrying it?", choices: ["To be let back in.", "I don't know how to stop."], reply: ["You were never out. You just wouldn't come to the door.", "You put it down. Like anything else. Like this."] } ],
    close: "Fewer doors will be locked against you." },
  { who: 'Wife', stone: 'Scale', approach: ["I have known the way out for years. I have known she was standing at it for years.", "It's not that I couldn't leave. It's that leaving meant admitting how long I stayed."], open: "You know the way out. You've known for years. I've been standing at it.",
    ex: [ { say: "It got comfortable in there. I understand. Quiet. Nothing asked of you.", choices: ["I made you wait too long.", "I didn't think you'd still be there."], reply: ["You did. I'm still here. Both are true.", "I'm here. Let's not make it a habit."] },
          { say: "How big does it have to be, this place, before it's enough?", choices: ["It was never going to be enough.", "It can be small now."], reply: ["No. Come home instead.", "Small enough to walk out of."] } ],
    close: "The place is smaller than it was. Small enough." },
];

const TUTORIALS = {
  chalk:    { title: 'Chalk', why: "I've held this before. I know the weight of it.", how: "I press it and choose what to leave on the floor — an arrow, a cross, a question — so that when I come back this way, and I will, I'll know what I thought then. One piece, one mark. The marks stay. It's there now, at the bottom of my sight, waiting." },
  charcoal: { title: 'Charcoal', why: "Someone drew with this. Perhaps it was me.", how: "When I take it up it draws what my light touches — the floor, the walls, the turns — until it wears down to nothing. I can set it down and pick it up again. The map I'm making is beside it, when I want to look." },
  pointer:  { title: 'A compass needle', why: "It knows where the way out is. It doesn't know the way.", how: "It will point for a while, straight as a bird flies, and then it will stop. The corridors don't care where it points." },
  path:     { title: 'A spool of thread', why: "Somebody measured this place once and left the measure on the floor.", how: "I can see it now, laid along the stones wherever my light falls — the shortest way out. It won't stay visible long. It never does." },
  key:      { title: 'A key', why: "The way out was barred long before I arrived.", how: "There's a gate over the exit, a ring in one of the far corners. I carry this to it and push through." },
  scrap:    { title: 'A scrap of map', why: "Torn from something larger. The hand that drew it was steady.", how: "It shows the halls around where it lay — a fifth of this place, near enough — and I've laid it into my own map. The rest is still mine to walk." },
  lamp:     { title: 'A lamp', why: "There are places here the walls have swallowed the light entirely.", how: "Lit, it throws a cone ahead of me, the way I'm facing, and a little warmth at my feet. I can douse it and light it again from the lamp beside my tools. In the dark, without it, I would see only myself." },
  door:     { title: 'A key', why: "Somewhere in here is a door with this shape on it. I've passed it, or I will.", how: "Doors like that don't open for anyone without the matching key. When I find one I can't open, I should leave a mark — I'll be coming back to it." },
  page:     { title: 'A page', why: "I am not the first here. I won't be the last.", how: "Someone wrote this down before they moved on. I'll keep what I find. The pages gather in Stories, where I can read them together." },
};

// ── the father, placed ──────────────────────────────────────────
const FIGURE_LINES = ["was that him?", "wait—", "dad?", "he didnt see me.", "hes right there. he wont look."];
