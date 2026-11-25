// Trailhead settings that rarely change. Project data lives in projects.json.
const SITE="https://gamedesignerjoe.github.io/";
const REPO="GameDesignerJoe/GameDesignerJoe.github.io";
const STAGES=[
 {
  "n": 1,
  "name": "Spark",
  "desc": "An idea, notes, maybe a mockup"
 },
 {
  "n": 2,
  "name": "Playable",
  "desc": "A first build you can touch"
 },
 {
  "n": 3,
  "name": "Finding the fun",
  "desc": "Playtesting, reworking, tuning"
 },
 {
  "n": 4,
  "name": "Shareable",
  "desc": "On the portfolio. You'd send someone the link"
 },
 {
  "n": 5,
  "name": "Polished",
  "desc": "Feels finished, with the basics in place",
  "how": [
   "Orientation locked, and touch controls that feel native",
   "Works offline and saves progress",
   "Sound that unlocks on the first tap",
   "An app icon, a splash screen, and a name check in the stores",
   "Haptics and other native touches"
  ]
 },
 {
  "n": 6,
  "name": "Tested in public",
  "desc": "itch.io and the web portals. For tabletop, a posted print-and-play",
  "how": [
   "itch.io is free and instant. Post with a strong thumbnail and a 10-second GIF",
   "Submit to Poki or CrazyGames (review takes a few weeks) and post on Newgrounds",
   "Watch what people finish and share",
   "Decision point: if people play and share it, go to mobile. If not, improve the game before spending money"
  ]
 },
 {
  "n": 7,
  "name": "Google Play",
  "desc": "The first store, and where the money model gets picked",
  "how": [
   "$25 once for the Play Console",
   "Capacitor wraps the web game, and it builds on Windows",
   "New personal accounts run a closed test with testers for a couple of weeks",
   "Pick the model: free with rewarded ads, or free with a one-time remove-ads purchase"
  ]
 },
 {
  "n": 8,
  "name": "Apple App Store",
  "desc": "The goal",
  "how": [
   "$99 a year for the Apple Developer Program",
   "The same Capacitor wrapper. A cloud Mac service such as Codemagic builds and signs it, so you don't need a Mac",
   "Screenshots, a privacy label and an age rating",
   "Apple rejects apps that feel like a website in a box (review rule 4.2), so offline play, haptics, saves and an app-like launch all have to be in"
  ]
 }
];
const LINE_END={"game":8,"tabletop":6,"tool":5};
var GOALS=["Get my games out into the world on the Apple App Store.","Make something uniquely mine that others want to play.","Create a source of income that gives me the freedom to choose my jobs."];
const PLAN_SRC={"title":"Publishing web games to app stores","date":"Nov 15","url":"https://claude.ai/chat/bfe6cdb1-4a80-4c4e-977e-ac53ce5fc708"};
var LEAD="wolf";
const BASICS=[["icon","App icon","A real icon at 192 and 512, plus an Apple touch icon"],["favicon","Tab icon","The small icon in the browser tab"],["install","Add to home screen","A web manifest, so it installs like an app"],["phone","Phone layout","Sized for a phone screen"],["notch","Clears the notch","Respects the phone's safe areas"],["offline","Works offline","A service worker that caches the game"],["saves","Saves progress","Picks up where you left off"],["share","Link preview","An image and title when the link is shared"],["describe","One-line description","What search results and stores show"],["tile","On the portfolio","A tile on your site's front page"],["notes","Notes in the repo","A doc that says where it stands"],["sound","Sound","Any audio at all"],["haptics","Haptics","A buzz on touch, one of the native touches Apple looks for"]];
const NOT_TRACKED="art, audio, songs, cd, catchTheWolf (the GameMaker original), asciiExplore, json-editor, game-doc-system";
