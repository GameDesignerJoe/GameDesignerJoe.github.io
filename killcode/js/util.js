// ══════════════════════════════════════════════
// kill.code — util.js
// Pure helpers used by render. No game logic.
// ══════════════════════════════════════════════

export function toRoman(n){
  const m=[['X',10],['IX',9],['V',5],['IV',4],['I',1]];
  let s='';
  for(const [c,v] of m){ while(n>=v){ s+=c; n-=v; } }
  return s;
}
