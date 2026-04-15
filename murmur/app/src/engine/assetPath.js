/**
 * Normalize an asset path for use in <img src> / CSS url() / Audio src.
 *
 * Accepts any of:
 *   - `blob:...`           (in-memory blob URL — returned as-is)
 *   - `http://` / `https://` (absolute remote URL — as-is)
 *   - `/absolute/path`     (absolute, e.g. `/stories/lighthouse/images/cover.jpg` — as-is)
 *   - `relative/path`      (bare — prefixed with `/stories/` for convenience)
 *
 * Rationale: `saveToProject` writes JSON clip/image paths like
 * `the-black-door/images/cover.png` (no leading slash). When rendered
 * directly as `<img src>` these resolve to `/the-black-door/…` which 404s.
 * This helper bridges that convention by prepending `/stories/` to bare paths.
 */
export function resolveAssetPath(p) {
  if (!p) return p
  if (typeof p !== 'string') return p
  if (p.startsWith('blob:')) return p
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  if (p.startsWith('data:')) return p
  if (p.startsWith('/')) return p
  return '/stories/' + p
}
