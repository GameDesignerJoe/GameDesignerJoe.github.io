// Jungle Girl Adventures · intro text. Edit freely; reload the page and use "Reset intro" in the debug view (the faint ⚙) to see it again.
// One entry per screen, in order. art = a file name in art/ (without .jpg). line = what Wren says, first person.
// title:true shows the picture whole with a Start button. last:true makes the button say "Begin" and drops the player onto the beach.
// fit:'contain' shows a picture whole instead of filling the screen.
window.INTRO = [
  {art:'cover', title:true},
  {art:'s1',   line:"It was my birthday, but you wouldn't know it by how everyone close to me was acting. My fiancé disappeared, my sister blew out my birthday candles. Then I went downstairs and found her blowing my fiancé. I'm trapped on this boat."},
  {art:'s2',   line:"I never heard him come up behind me. Just the hands. Then the rail wasn't there."},
  {art:'s3',   line:"The water was so cold I couldn't scream. The boat kept going. The music kept playing."},
  {art:'s4',   line:"Then the night went orange. The whole yacht, gone. Everyone on it. Was that meant for me too?"},
  {art:'s5',   line:"A piece of the hull. I held on. I don't remember anything after that."},
  {art:'wake', line:"How did I get here?"},
  {art:'cave', line:"That was two months ago. Who would have thought I would have thrived on this island."},
  {art:'beach',line:"Time to get to work… well, sort of. My story is one of betrayal, adventure, and even romance… but first there's work to be done.", last:true},
];
