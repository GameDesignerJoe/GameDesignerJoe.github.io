const E=require('./engine.js');
const V={
 'Default (triples, K/Q/H)':{},
 'Pairs (10×2)':{landSets:10,landCopies:2},
 'Two Family (K/H)':{landSets:8,family:[{advisor:0,king:1,queen:0,heir:1},{advisor:0,king:1,queen:0,heir:1}]},
 'Unlimited stacking':{stacking:'unlimited'},
 'Lands only':{landSets:9,specials:{ancient:0,lostcity:0,sinkhole:0,sanctuary:0,wild:0,watchtower:0,pretender:0,usurp:0,underminers:0,earthquake:0,waystone:0}},
};
for (const [n,o] of Object.entries(V)){
  const cfg=Object.assign(E.defaultConfig(),o);
  const s=E.summarize(E.runBatch(cfg,['cautious','cautious'],1000,99,true));
  const c=Object.fromEntries(s.cards.map(x=>[x.label,x]));
  console.log(`${n.padEnd(26)} 1st ${(100*s.firstSeatWinRate).toFixed(0)}% tie ${(100*s.tieRate).toFixed(0)}% margin ${s.margin.mean.toFixed(1)} turns ${s.turns.mean.toFixed(0)} | Land ${c.Land.mean.toFixed(2)}±${c.Land.sd.toFixed(2)} max ${c.Land.max} | `+s.cards.filter(x=>x.label!=='Land').slice(0,4).map(x=>`${x.label} ${x.mean.toFixed(1)}`).join(', '));
}
