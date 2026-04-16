/**
 * deploy.cjs — copies the Vite build output (dist/) into the repo-root /murmur/
 * folder so GitHub Pages serves it at https://gamedesignerjoe.github.io/murmur/
 *
 * The /murmur/ folder also contains app/ (source) and ref/ (docs), so we only
 * clean the BUILD artifacts (index.html, assets/, stories/) — never app/ or ref/.
 *
 * Usage: npm run deploy   (builds first, then copies)
 */
const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '..', 'dist')
const DEST = path.resolve(__dirname, '..', '..', '..', 'murmur')

// Directories/files we know are source-code or docs — never touch them.
const PRESERVE = new Set(['app', 'ref'])

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// 1. Clean previous build artifacts from DEST, preserving source dirs
console.log(`[deploy] Cleaning build artifacts in ${DEST} (preserving ${[...PRESERVE].join(', ')})`)
if (fs.existsSync(DEST)) {
  for (const entry of fs.readdirSync(DEST)) {
    if (PRESERVE.has(entry)) continue
    const p = path.join(DEST, entry)
    fs.rmSync(p, { recursive: true, force: true })
  }
}

// 2. Copy dist/* → murmur/
console.log(`[deploy] Copying ${SRC} → ${DEST}`)
copyDir(SRC, DEST)

// 3. Report
let count = 0
for (const entry of fs.readdirSync(SRC, { recursive: true })) count++
console.log(`[deploy] Done — ${count} build files deployed.`)
console.log(`[deploy] Next steps:`)
console.log(`   cd ../../..`)
console.log(`   git add murmur`)
console.log(`   git commit -m "deploy murmur"`)
console.log(`   git push`)
