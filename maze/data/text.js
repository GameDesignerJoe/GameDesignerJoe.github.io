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
  'The Child':          { shelf: ["empty shelves.", "Is it still a book shelf if no books are in it?", "I should write a book, “The boy and his maze.”"], basin: ["rocks in a bowl. heavy ones.", "I’ve carried this around for so long. I got used to the weight of it.", "Dad gave me these to hold. i think i can put them down now."] },
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
  'The Child':          ["is anybody there?", "i counted to a hundred. then i counted again.", "the walls are warm if you put your face on them.", "im not scared. im not.", "if i keep walking he’ll see me walking and be sad.", "i left a mark so i can find me later."],
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
  { name: 'The Child', summary: 'Hope someone came back for them.', wake: "Dad said wait here.", leave: "but i didnt wait.", pages: [
    "I tried to wait… or I did wait, didn’t I? But I got lost in waiting.",
    "I drew a map to me. He’ll find me. Dad will come back. He just busy. I called the other day. I’ll see him soon. I’m out of chalk.",
    "I thought I heard him. I told mom. She didn’t like that. I looked for him, but I got lost. I’m gonna look some more.",
    "I found him. I dreamed. He blamed mom. He blamed the war. His war. He said I shouldn’t cry. Men don’t cry. I wasn’t.\nI wasn’t.",
    "I don’t think im going to right anymore. I’m gonna go help mom. But if you find this you are doing good. Keep going. I’ll leave the light on for you.",
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
  chalk:    { title: 'Chalk', why: "he used to make fun of my drawings. So I stopped", how: "I can use it to mark the floor, help find my way around." },
  charcoal: { title: 'Charcoal', why: "Someone drew with this. Perhaps it was me.", how: "When I take it up it draws what my light touches — the floor, the walls, the turns — until it wears down to nothing. I can set it down and pick it up again. The map I'm making is beside it, when I want to look." },
  pointer:  { title: 'A compass needle', why: "It knows where the way out is. It doesn't know the way.", how: "It will point for a while, straight as a bird flies, and then it will stop. The corridors don't care where it points." },
  path:     { title: 'A spool of thread', why: "Somebody measured this place once and left the measure on the floor.", how: "I can see it now, laid along the stones wherever my light falls — the shortest way out. It won't stay visible long. It never does." },
  key:      { title: 'A key', why: "The way out was barred long before I arrived.", how: "There's a gate over the exit, a ring in one of the far corners. I carry this to it and push through." },
  scrap:    { title: 'A scrap of map', why: "Torn from something larger. The hand that drew it was steady.", how: "It shows the halls around where it lay — a fifth of this place, near enough — and I've laid it into my own map. The rest is still mine to walk." },
  lamp:     { title: 'A lamp', why: "There are places here the walls have swallowed the light entirely.", how: "Lit, it throws a cone ahead of me, the way I'm facing, and a little warmth at my feet. I can douse it and light it again from the lamp beside my tools. In the dark, without it, I would see only myself." },
  door:     { title: 'A key', why: "Somewhere in here is a door with this shape on it. I've passed it, or I will.", how: "Doors like that don't open for anyone without the matching key. When I find one I can't open, I should leave a mark — I'll be coming back to it." },
  offering: { title: 'A carved stone', why: "Reminds me of my father and something else, I don’t want to think about it.", how: "This doesn’t belong here… it belongs with him. Is he in here?" },
  page:     { title: 'A page', why: "I am not the first here. I won't be the last.", how: "Someone wrote this down before they moved on. I'll keep what I find. The pages gather in Stories, where I can read them together." },
};

// ── the people he lost sight of ────────────────────────────────
// Joe: "a man surrounded by loved ones, too lost in his own maze to see it. He's hurt those around
// him, been hurt as well. We need the full picture." Five of them, from his CHARACTERS notes. Each
// statue in a maze is one of these; each wants the stone carved with their mark.
//
// The father left, and is dead: what there is to make is peace. The mother he carried as a child
// and walked away from as a man: she resents him still, and what there is to make is being all
// right with that. The wife who sees past the shell he will not come out of. The friend he was too
// rigid with, or pulled down, who may be offering a hand he does not think he deserves. The Teen —
// his own kid, smart and still a teenager, who does not understand why he will not just get help.
//
// Two children in this game and they are not the same person. The Child, the first chapter, is the
// man himself, small, waiting where his father told him to. The Teen is the man's own child. Joe:
// "The Child section at the start of the game is the main character as a child, not their child.
// We might call their child The Teen." So the person is `teen` here and everywhere, and `child`
// is only ever the chapter.
//
// One person to a chapter. Joe: "We need to lock in each person to each chapter. So child chapter
// has statues of the father. The mom gets another one, and the friend and so on to the Teen
// getting the last one." Which person is which chapter's is `shrines` in data/phases.js; both
// statues in a maze wait for that person, and so both stones carry their mark.
const PEOPLE = [
  { id: 'father', mark: 'bar',     name: 'my father' },
  { id: 'mother', mark: 'chevron', name: 'my mother' },
  { id: 'spouse', mark: 'cross',   name: 'my wife' },
  { id: 'friend', mark: 'wave',    name: 'my friend' },
  { id: 'teen',   mark: 'arc',     name: 'my kid' },     // the Teen; on the card, what a father calls them
];

// ── the exchange ────────────────────────────────────────────────
// Joe: "You drop the thing in. You are then allowed to ask a question, maybe two are offered...
// you then get an answer." Set the stone in the bowl and two questions are offered; you ask one.
// The other stays on the card, unasked — for a man who spent his life not asking, that is a
// character note, not a penalty. Each person has a run of these, walked through in order across
// the whole game, and when it is spent the statue has one line left and says it every time. That
// is the goal state, not a fallback: a statue with nothing left to say to you.
//
// The maze is written vague. These are the only voices in the game that belong to real people, so
// they are written the other way — small and specific. First pass; Joe rewrites.
//
// A person's steps run across the game, and where the chapter puts them decides whose mouth the
// question is in. The father's first two are asked in the Child's maze, so they are the boy's —
// lowercase, small, the voice of the boy still waiting — and the father answers a child. The
// last two come in the Priest's maze, a grown man asking a dead one.
const EXCHANGES = {
  father: {
    steps: [
      { q: ["are you coming back?", "did i do something?"],
        a: ["I meant to. Meaning to was the thing I was good at.", "No. You were a child. There was nothing you did or didn't do. Put that one down."] },
      { q: ["where did you go?", "can i come with you?"],
        a: ["Somewhere that looked less like the rest of my life. It wasn't. I was a coward about my life.", "No. It was the one thing I got right, and I got it right for the wrong reasons."] },
      { q: ["Did you know I waited?", "Did you think about me?"],
        a: ["I knew. I told myself you'd stop. I don't know when you did.", "Every day for a while. Then on your birthday. Then when I saw a boy your age. You got older than the boy I was looking for."] },
      { q: ["Are you sorry?", "What am I supposed to do with this?"],
        a: ["Yes. It doesn't reach you. I know that. It's still yes.", "Nothing. I'm not a thing to do. I'm just what happened."] },
    ],
    done: "There's nothing else. I left. You didn't. That's the whole of it.",
  },
  mother: {
    steps: [
      { q: ["Were you angry when I left?", "Do you remember us against the world?"],
        a: ["I am angry. Present tense. You were the one person who stayed and then you didn't.", "I remember it as the best years. You remember them as carrying me. We're both right."] },
      { q: ["Did you know I was carrying it?", "Was that love?"],
        a: ["I knew you were quiet. I thought quiet was your nature. I didn't look under it.", "It was what we had. I don't know what else to call it. You've decided it wasn't. Fine."] },
      { q: ["Do you want me back?", "Will you ever forgive me?"],
        a: ["I want the boy back. You're not him. That's not your fault and I hold it against you anyway.", "No. And you keep asking as if a yes would fix you. It wouldn't."] },
      { q: ["Was I wrong to go?", "Can I be all right with this?"],
        a: ["You were right to go. I'll never say so to your face. This isn't my face.", "You're going to have to be. I'm not going to help you with it. That's the one thing I can give you."] },
    ],
    done: "You went. You were right. I'm not over it. All three are true and none of them is your job.",
  },
  spouse: {
    steps: [
      { q: ["Can you see me in there?", "Why do you stay?"],
        a: ["I've seen you the whole time. That's what you can't stand.", "Ask me on a different day and you'd get a different answer. Today: because I said I would, and because I remember who's in there."] },
      { q: ["Do you remember what you said that night?", "Do I remember it right?"],
        a: ["I remember. I was cruel and I meant it while I said it. I've said sorry. You've kept the first one and thrown out the sorry.", "You remember the words. You don't remember that I was frightened too. Nobody remembers that part."] },
      { q: ["What are you afraid you'll see?", "What if I come out and it's nothing?"],
        a: ["That's my question to you, not yours to me.", "Then it's nothing, and I'll have seen it, and I'll still be standing here. That's the part you don't believe."] },
      { q: ["Is it too late?", "What do you need from me?"],
        a: ["It's late. Late isn't too late. You keep confusing the two because too late would let you off.", "Come out. Not all the way. A hand. Stop making me guess whether you're in there."] },
    ],
    done: "I'm still here. I don't know how long. Neither do you. That's what a marriage is.",
  },
  friend: {
    steps: [
      { q: ["Did I pull you down?", "Why didn't you follow the rules?"],
        a: ["Yes. I was already going. You made it faster and then you made it lonelier.", "Because they were yours. You never asked if they fit anyone else. You just went quiet when they didn't."] },
      { q: ["Are you all right now?", "Do you blame me?"],
        a: ["I got out. It cost me things you don't know about. I'm not telling you so you'll feel it. I'm telling you because it's true.", "I did. For a long time. Blame got heavy. I put it down before you did."] },
      { q: ["Why would you help me?", "Don't you think I deserve this?"],
        a: ["Because someone did it for me and I didn't deserve it either. That's how it works. It isn't earned.", "I think deserve is a word you use to stay where you are."] },
      { q: ["What do I say to you?", "Can it go back?"],
        a: ["You already said it. You're here.", "No. It goes forward or it doesn't go. I'd take forward."] },
    ],
    done: "The hand's still out. It's not going anywhere. You know where I am.",
  },
  teen: {
    steps: [
      { q: ["Are you angry at me?", "Do you know I love you?"],
        a: ["Yeah. Obviously. Are you going to do anything about it or is this another one of the talks.", "I know you say it. I know you think it. I don't know what it's for if you won't let me near you."] },
      { q: ["Why won't you just talk to me?", "What do you want from me?"],
        a: ["I'm literally talking to you right now. You're the one in the maze.", "Get help. Like an actual person. I looked them up for you. I'm fifteen and I looked them up for you."] },
      { q: ["Was I a bad father?", "Did I do to you what he did to me?"],
        a: ["No. You were there. You were just… behind glass. It's not the same as gone. It's not fine either.", "You stayed and you weren't there. He left and he wasn't there. I don't know which is worse and I'm sick of it being about him."] },
      { q: ["Is there still time?", "What would it look like?"],
        a: ["I'm still here, aren't I. That's your answer. Stop asking it and do something with it.", "You come home. You sit down. You don't fix anything. You just don't leave the room."] },
    ],
    done: "Stop being stubborn and love me. That's it. That's the whole message.",
  },
};
// what happens at the stones and the statues, before anyone has a voice. First pass; Joe rewrites.
const SHRINE_LINES = {
  pickup:   "A stone. Small, and carved. Somebody's mark.",
  full:     "I can only hold one of these at a time.",
  deliver:  "It settles into the bowl. The stone knows where the next page is, even if I don't.",
  unasked:  "— I didn't ask.",
  again:    "It has said what it had to say to me.",
  noPage:   "It settles into the bowl. There is nothing left in here for it to point to.",
  wrong:    "This isn't the one it's waiting for.",
  // Joe: "When you don't have a stone but you collide with the statue, it should say something."
  noStone:  "The bowl is empty. It is waiting for something I haven't found yet.",
};

// ── the father, placed ──────────────────────────────────────────
const FIGURE_LINES = ["was that him?", "wait—", "dad?", "he didnt see me.", "hes right there. he wont look."];

// the secret room: someone small was in here a long time, and left it covered in chalk
const SECRET_LINES = ["where am i without you?", "somebody was in here. for a long time.",
  "all this chalk. all these arrows. none of them go out.", "i think i drew these.", "he waited in here too."];

// ── moments: one line at one beat ───────────────────────────────────────────
// These lived as literals scattered through seven engine files until v0.82.0, which meant a fifth
// of what the player reads was invisible to anyone doing a writing pass. Keyed by self, with `_`
// as the line for any self that has no entry of its own — two of them (the noughts-and-crosses
// and the hopscotch) already had a child/adult split hand-rolled as a ternary in the engine, so
// the shape was already wanted. The rest can have their own voices as they get written.
const MOMENTS = {
  poolDoorNoStone: { _: "It won't move. Not without a stone." },
  poolDoorGives:   { _: "\u2026it gives." },
  exitLocked:      { _: "Locked. It wants a key." },
  crawlTooBig:     { _: "I used to fit through here." },
  stoneTaken:      { _: "One stone. I'll carry it as far as the water." },
  ticTacToe:       { 'The Child': "its my turn. he never took his.", _: "Someone left a game half-played." },
  tttWon:          { 'The Child': "i win. i win i win i win.", _: "Three in a row. Nobody here to tell." },
  hopscotchDone:   { 'The Child': "\u2026ready or not.", _: "I remember this game." },
  doorUnlocked:    { _: 'The key turns, and stays in the lock.' },
  keyFound:        { _: "A key. Its head is a {shape}." },
  doorLocked:      { _: "Locked. The lock is a {shape}." },
  stoneForGate:    { _: "The stone. Now the gate." },
  resumePool:      { _: "\u2026the water. I was going to the water." },
  resumeMaze:      { _: "\u2026where was I." },
};

// ── the map screen, before you have charted anything ────────────────────────
const MAP_EMPTY = {
  head: 'A blank canvas, waiting for charcoal.',
  sub:  'Tap the charcoal to begin mapping as you walk.',
};

// ── the pool room's own furniture, around the written exchange ──────────────
const POOL_UI = {
  keeperWaiting:  'The Caretaker sits at the edge and says nothing.',
  keeperNods:     'The Caretaker nods once.',
  putDown:        'Put the stone down.',
  putDownChoice:  'I put it down.',
};

// ── every block above, by name ──────────────────────────────────────────────
// first person: words somebody wrote on the walls, at the far end of dead ends. Joe: "Want to be
// able to put words on the walls. This might be how I tell the story of the world." A few a maze,
// in the hand of whoever walked here before — keyed like MOMENTS, by the self, `_` for anyone.
// Short: a wall holds about four lines of eight letters. These are placeholders, to be rewritten.
const WALL_WORDS = {
  _: ["who wrote this", "you were here before", "it goes on", "not this way", "turn back", "keep the light on your left"],
  'The Child': ["wait here", "he said five minutes", "count to a hundred", "i was good", "dont cry", "hes coming back"],
};

// first person: the two walls that open the chapter. The first is across from you when you wake —
// the first thing you see; the second faces you as you step out of that room. Joe: "the text 'dad
// said to stay here.' should be the first thing you see at the start of the game on the wall across
// from you. And then as soon as you leave … there's text on the wall that says 'but I didn't.'"
// Keyed by the self, like WALL_WORDS; a self with no entry gets neither. [on waking, on leaving]
const WALL_START = {
  'The Child': ["dad said to stay here.", "but I didn't."],
};

// first person: story rooms. Joe: "This is a story about a person who when they were a child their
// father abandoned them. [They] didn't believe their father actually left them, and made excuses.
// But as the child grew, their maze grew as well. The questions they asked, the lies they told
// themselves … will all manifest in these various story rooms … an excessive amount of writing on
// the walls. Written by the child, he is not processing the trauma. He is ignoring it. He's building
// a wall around his heart." Two rooms for the Child, two ages of the same not-looking:
//   waiting — the young one, sure he's coming. `walls` are written all over, low, in pencil and crayon,
//             some crossed out and written again; `big` goes up large; `note` is on the chair's seat
//   wall    — older, and it's working. `bricks` are laid in tight even rows like brickwork, floor to
//             ceiling; `crack` is the one place the paint has come away and the old hand shows; `note`
//             is what's kept inside the boxes, out of reach but not out of sight
// The walls are written in a 3×5 hand: lowercase, digits, ' . , ? ! - |. Placeholders, Claude's
// drafts in the child's voice, to be rewritten.
const STORY_ROOMS = {
  'The Child': {
    waiting: {
      walls: ["he said five minutes", "five minutes is longer for grown ups", "his car broke down probly", "there was trafic",
        "he got lost so i have to stay where he left me", "dont move or he wont find you", "i was good. i was so good",
        "i didnt cry", "hes coming back", "hes coming back", "he is coming back", "hes getting me a present thats why its taking so long",
        "maybe he went to the wrong door", "counting to 100 again", "it wasnt his fault", "mom doesnt know",
        "he didnt leave he is just late", "i saved him the good chair", "tomorrow", "tomorrow for sure",
        "busy people are important people", "hes going to be so proud of me", "i made him a drawing",
        "when he gets here im not going to be mad", "i can wait longer than anybody", "he told me to wait here so this is where i wait"],
      big: ["wait here", "he said he would come back"],
      note: "saved your seat dad. dont worry. i didnt let anybody sit in it.",
    },
    wall: {
      bricks: ["im fine", "it doesnt matter", "i dont care", "i dont need him", "i never think about it", "its not a big deal",
        "whatever", "people leave", "im over it", "stop asking", "i dont miss him", "better off", "never needed him", "doesnt bother me"],
      crack: "come back",
      note: "the watch he gave me stopped at five past. i dont wear it. i just keep it.",
    },
  },
};

// The engine hands each surface a finished string, never an id, so the debug "Line IDs" view has
// to look the id up backwards: words → path. That walk needs the blocks as data. A plain object
// literal rather than anything clever, because these are `const` in the shared script scope and
// there is no way to enumerate them — and smoke.mjs asserts this list is complete, so a block
// added tomorrow can't quietly stop being findable.
const TEXT_BLOCKS = {
  ROOM_LINES, LIGHTER, EMPTY_SHELF, SHELF_LINES, SELF_LINES, NARRATOR, CAST, POOLS, TUTORIALS,
  PEOPLE, EXCHANGES, SHRINE_LINES, FIGURE_LINES, SECRET_LINES, MOMENTS, MAP_EMPTY, POOL_UI, WALL_WORDS, WALL_START, STORY_ROOMS,
};
