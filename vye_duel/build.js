// Builds the single-file page from ui.html + engine.js.
//   vye-micro.html : body-only version for Claude artifacts
//   index.html     : full standalone page for GitHub Pages
const fs = require('fs'), path = require('path');
const ui = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8');
const eng = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const body = ui.replace('/*ENGINE*/', () => eng);
const full = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const out = process.argv[2] || __dirname;
fs.writeFileSync(path.join(out, 'vye-micro.html'), body);
fs.writeFileSync(path.join(out, 'index.html'), full);
console.log('built', body.length, 'bytes');
