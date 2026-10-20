# Photo Time Detective

Prototype: guess the year a photo was taken by researching things in the frame.

## Run
Any static server (images load relative to index.html):

    python3 -m http.server 8000
    # then open http://localhost:8000

Opening index.html directly from disk also works in most browsers.

## Layout
- `index.html` — markup + styles
- `js/app.js` — photo viewer (zoom/pan/pinch, box select), research flow, timeline, hints, complete, end screens, sound
- `js/cases.js` — the data: one object per photo (`CASES.push({...})`)
- `img/` — the photos

## Adding a photo
Append to `js/cases.js`:

    CASES.push({ id:'slug', src:'img/file.jpg', w:1600, h:1079, from:1945, to:2026,
      title:'Intro line', place:'Where it is (shown on the end screen)',
      answer:1984,          // the single year, or null if the frame can't reach one
      known:1984,           // what the archive says, if different/unreachable (optional)
      closer:'What would close it (shown on range endings)',
      clues:[ { id:'plate', rect:[x,y,w,h], title:'…', text:['para','para'], effect:{min:1982}, why:'one-line effect' } ] });

`rect` is in image pixels. `effect` is `{min}`, `{max}`, `{only:[years]}`, or `{}` for a dead end.
Par (fewest clues to one year) is computed automatically; the order of CASES is the play order.

## Rights
ming-ave-1984.jpg — source TBD (Reddit). terner-payphone.jpg — © Ron Terner, permission pending.
baltimore-pratt.jpg — Detroit Publishing Co., public domain (LoC). penna-1940.jpg — FSA/OWI original is public domain;
this colorized version is by @sebcolorisation — replace with the LoC original or get permission.
