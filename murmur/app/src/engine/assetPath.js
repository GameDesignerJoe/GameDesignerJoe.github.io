/**
 * Normalize an asset path for use in <img src> / CSS url() / Audio src.
 *
 * Accepts any of:
 *   - `blob:...`           (in-memory blob URL — returned as-is)
 *   - `http://` / `https://` (absolute remote URL — as-is)
 *   - `/absolute/path`     (absolute — as-is; NOTE: demo stories use this form,
 *                           e.g. `/stories/lighthouse/images/cover.jpg`)
 *   - `relative/path`      (bare — prefixed with BASE + `stories/`)
 *
 * BASE is Vite's `import.meta.env.BASE_URL`:
 *   - Dev:  `/`       → `/stories/the-black-door/…`
 *   - Prod: `/murmur/` → `/murmur/stories/the-black-door/…`
 */

const BASE = import.meta.env.BASE_URL || '/'

export function resolveAssetPath(p) {
  if (!p) return p
  if (typeof p !== 'string') return p
  if (p.startsWith('blob:')) return p
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  if (p.startsWith('data:')) return p
  if (p.startsWith('/')) return p
  return BASE + 'stories/' + p
}
