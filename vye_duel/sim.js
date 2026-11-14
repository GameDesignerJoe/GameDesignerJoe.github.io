const E = require('./engine.js');
const args = process.argv.slice(2);
const n = +args[0] || 200, a = args[1] || 'greedy', b = args[2] || 'greedy';
const cfg = args[3] ? Object.assign(E.defaultConfig(), JSON.parse(args[3])) : E.defaultConfig();
const S = E.runBatch(cfg, [a, b], n, 12345, true);
const sum = E.summarize(S);
console.log(E.reportText(sum, cfg, [a, b]));
