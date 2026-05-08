// ══════════════════════════════════════════════
// kill.code — rng.js
// Random helpers. Pulled out so deterministic seeding
// can be added later without touching every caller.
// ══════════════════════════════════════════════

export function shuffle(a){
  const b=[...a];
  for(let i=b.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [b[i],b[j]]=[b[j],b[i]];
  }
  return b;
}

export function pick(a){
  return a[Math.floor(Math.random()*a.length)];
}

export function randInt(maxExclusive){
  return Math.floor(Math.random()*maxExclusive);
}
