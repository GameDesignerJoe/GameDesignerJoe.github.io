import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Scans public/stories/ at build time and writes a manifest.json listing every
// story that has a {storyId}.json file. The app fetches this on boot to discover
// user-created stories without hardcoding them.
function storiesManifestPlugin() {
  const generate = () => {
    const storiesDir = path.resolve('public/stories')
    if (!fs.existsSync(storiesDir)) return
    const ids = []
    for (const dir of fs.readdirSync(storiesDir)) {
      const jsonPath = path.join(storiesDir, dir, `${dir}.json`)
      if (fs.existsSync(jsonPath)) ids.push(dir)
    }
    fs.writeFileSync(
      path.join(storiesDir, 'manifest.json'),
      JSON.stringify(ids, null, 2)
    )
    console.log(`[stories-manifest] ${ids.length} stories: ${ids.join(', ')}`)
  }
  return {
    name: 'stories-manifest',
    buildStart: generate,       // production build
    configureServer: generate,  // dev server start
  }
}

export default defineConfig({
  base: '/murmur/',
  plugins: [react(), tailwindcss(), storiesManifestPlugin()],
})
