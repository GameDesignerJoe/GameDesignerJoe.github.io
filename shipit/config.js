// Ship It! settings that rarely change. Project data lives in projects.json.
// STAGES are the gates of the dev plan. Each gate's items are the starting checklist a project gets when it enters that gate.
const SITE="https://gamedesignerjoe.github.io/";
const REPO="GameDesignerJoe/GameDesignerJoe.github.io";
const STAGES=[
 {
  "n": 1,
  "key": "inc",
  "name": "Incubation",
  "desc": "Is this worth building? A line that sells it and a toy you can touch",
  "items": [
   {
    "t": "Write the razor: the one line you'd say in an elevator",
    "k": "razor"
   },
   {
    "t": "Build a toy you can touch",
    "k": "toy"
   },
   {
    "t": "Give it a name"
   },
   {
    "t": "Decide it's worth a real prototype"
   }
  ]
 },
 {
  "n": 2,
  "key": "pre",
  "name": "Preproduction",
  "desc": "Prove the core is fun, then lock what's in and what's out",
  "items": [
   {
    "t": "The core loop is playable start to end"
   },
   {
    "t": "The core loop is fun: you'd play it again unprompted"
   },
   {
    "t": "Lock the feature list: what's in"
   },
   {
    "t": "Write the cut list: what's out, and stays out"
   },
   {
    "t": "Choose the look and feel"
   },
   {
    "t": "Set up its notes doc",
    "k": "notesdoc"
   }
  ]
 },
 {
  "n": 3,
  "key": "prod",
  "name": "Production",
  "desc": "Build everything on the locked list",
  "items": [
   {
    "t": "Everything on the locked feature list is built"
   },
   {
    "t": "All content is in: levels, cards, cases, whatever it's made of",
    "g": 1
   },
   {
    "t": "Playable from first screen to last"
   },
   {
    "t": "Win, lose and restart all work",
    "g": 1
   },
   {
    "t": "No placeholder art or text left"
   }
  ]
 },
 {
  "n": 4,
  "key": "alpha",
  "name": "Alpha",
  "desc": "Whole and playable on a phone, and other people have played it",
  "items": [
   {
    "t": "Lays out properly on a phone",
    "k": "phone"
   },
   {
    "t": "Clears the notch and the home bar",
    "k": "notch"
   },
   {
    "t": "Saves progress",
    "k": "saves"
   },
   {
    "t": "Has sound",
    "k": "sound"
   },
   {
    "t": "Someone else has played it"
   },
   {
    "t": "Their feedback is written in the notes"
   },
   {
    "t": "No known blockers"
   },
   {
    "t": "On the portfolio",
    "k": "tile"
   },
   {
    "t": "Has notes in the repo or a doc",
    "k": "notes"
   }
  ]
 },
 {
  "n": 5,
  "key": "beta",
  "name": "Beta",
  "desc": "Fixes only. Cleaned up and store-ready",
  "items": [
   {
    "t": "Feature list frozen: fixes only from here"
   },
   {
    "t": "Clean out debug text, test fields and dev shortcuts",
    "k": "clean"
   },
   {
    "t": "Real app icon at 192 and 512",
    "k": "icon"
   },
   {
    "t": "Tab icon",
    "k": "favicon"
   },
   {
    "t": "Installs to the home screen",
    "k": "install"
   },
   {
    "t": "Works offline",
    "k": "offline"
   },
   {
    "t": "Link preview image and title",
    "k": "share"
   },
   {
    "t": "One-line description",
    "k": "describe"
   },
   {
    "t": "Haptics on the touches that matter",
    "k": "haptics"
   },
   {
    "t": "Orientation locked",
    "g": 1
   },
   {
    "t": "Name checked in the App Store and Google Play",
    "g": 1
   },
   {
    "t": "Gallery shots taken",
    "k": "gallery"
   }
  ]
 },
 {
  "n": 6,
  "key": "r1",
  "name": "Release I: itch.io",
  "desc": "Free, instant, and the first place strangers play it",
  "items": [
   {
    "t": "Make the itch.io page: a strong thumbnail, a 10-second GIF, and a short pitch"
   },
   {
    "t": "Upload the web build and set it to play in the browser"
   },
   {
    "t": "Then submit to Poki or CrazyGames (review takes a few weeks) and post on Newgrounds"
   },
   {
    "t": "Watch what people finish and share"
   },
   {
    "t": "Decision point: if people play and share it, keep going. If not, improve the game before spending money"
   }
  ]
 },
 {
  "n": 7,
  "key": "r2",
  "name": "Release II: Money plan",
  "desc": "Decide how it earns before it goes to a store",
  "items": [
   {
    "t": "Pick one model: free with rewarded ads, free with a one-time remove-ads or full-game purchase, or paid up front ($1 to $5 on mobile)"
   },
   {
    "t": "Short, replayable arcade games usually do better free with ads or a remove-ads purchase than paid up front"
   },
   {
    "t": "The web portals pay through ad revenue share, so that income can start before the stores"
   },
   {
    "t": "Build the paid parts in: the ad or purchase plugin, and what a paying player gets"
   },
   {
    "t": "Write down what counts as working, so you know whether to push on or move to the next game"
   }
  ]
 },
 {
  "n": 8,
  "key": "r3",
  "name": "Release III: Google Play",
  "desc": "The first store",
  "items": [
   {
    "t": "$25 once for the Play Console"
   },
   {
    "t": "Capacitor wraps the web game, and it builds on Windows"
   },
   {
    "t": "New personal accounts run a closed test with testers for a couple of weeks"
   },
   {
    "t": "Ship it with the money model from the stop before"
   }
  ]
 },
 {
  "n": 9,
  "key": "r4",
  "name": "Release IV: App Store",
  "desc": "The goal",
  "items": [
   {
    "t": "$99 a year for the Apple Developer Program"
   },
   {
    "t": "The same Capacitor wrapper. A cloud Mac service such as Codemagic builds and signs it, so you don't need a Mac"
   },
   {
    "t": "Screenshots, a privacy label and an age rating"
   },
   {
    "t": "Apple rejects apps that feel like a website in a box (review rule 4.2), so offline play, haptics, saves and an app-like launch all have to be in"
   }
  ]
 }
];
const LINE_END={"game":9,"tabletop":6,"tool":5};
var GOALS=["Get my games out into the world on the Apple App Store.","Make something uniquely mine that others want to play.","Create a source of income that gives me the freedom to choose my jobs."];
const PLAN_SRC={"title":"Publishing web games to app stores","date":"Nov 15","url":"https://claude.ai/chat/bfe6cdb1-4a80-4c4e-977e-ac53ce5fc708"};
var LEAD="wolf";
const BASICS=[["icon","App icon","A real icon at 192 and 512, plus an Apple touch icon"],["favicon","Tab icon","The small icon in the browser tab"],["install","Add to home screen","A web manifest, so it installs like an app"],["phone","Phone layout","Sized for a phone screen"],["notch","Clears the notch","Respects the phone's safe areas"],["offline","Works offline","A service worker that caches the game"],["saves","Saves progress","Picks up where you left off"],["share","Link preview","An image and title when the link is shared"],["describe","One-line description","What search results and stores show"],["tile","On the portfolio","A tile on your site's front page"],["notes","Notes in the repo","A doc that says where it stands"],["clean","Debug cleaned up","No debug text, test fields or dev shortcuts left in"],["sound","Sound","Any audio at all"],["haptics","Haptics","A buzz on touch, one of the native touches Apple looks for"]];
const NOT_TRACKED="art, audio, songs, cd, catchTheWolf (the GameMaker original), asciiExplore, json-editor, game-doc-system";
// The skills in .claude/skills that this page can launch. "per" ones show under More on a project's page.
const SKILLS=[
 {"key":"gate-check","name":"Gate check","per":true,"kinds":["game","tabletop"],"button":"Gate Check","all":"Check them all","what":"Works out which gate a game is really in, from its code, its notes and a few questions to you, and writes the checklist for getting through it.","say":"gate check Buzzers"},
 {"key":"game-gallery","name":"Game gallery","per":true,"kinds":["game","tabletop"],"button":"Take gallery shots","what":"Plays through a game and takes about ten deliberately different screenshots into its media folder. Leaves your own files alone.","say":"take gallery shots for Vye Duel"},
 {"key":"ship-it","name":"Ship It","what":"Keeps this page's data in step with the repo. It runs whenever a button here opens Claude Code, and after any work on one of your apps.","say":"star Buzzers, or add a multiplayer test to Buzzers' checklist"},
 {"key":"add-portfolio-entry","name":"Add portfolio entry","what":"Adds a finished app to the front page of your site, with a screenshot and a tile.","say":"add Crunch to the portfolio"}
];
