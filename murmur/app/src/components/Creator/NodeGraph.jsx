import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from '../../store'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.0
const ZOOM_STEP = 0.15

export default function NodeGraph() {
  const creator = useStore(s => s.creator)
  const selectNode = useStore(s => s.selectNode)
  const updateNodePosition = useStore(s => s.updateNodePosition)
  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const innerRef = useRef(null)

  // Pan/zoom state kept in refs for perf (no re-render on every drag frame)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(0.85)
  const panRef = useRef({ x: 0, y: 0 })
  const canvasDrag = useRef({ down: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  const { story, positions, selectedNodeId } = creator
  if (!story) return null

  const scenes = Object.values(story.scenes)

  // Apply transform
  const applyTransform = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    const z = zoomRef.current
    const p = panRef.current
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${z})`
    el.style.transformOrigin = '0 0'
  }, [])

  // Draw edges
  const drawEdges = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = ''

    const NW = 185, NH = 118
    const currentPositions = useStore.getState().creator.positions
    const currentSelected = useStore.getState().creator.selectedNodeId

    Object.values(story.scenes).forEach(sc => {
      const from = currentPositions[sc.id]
      if (!from) return
      sc.choices.forEach((ch, ci) => {
        const to = currentPositions[ch.target]
        if (!to) return
        const x1 = from.x + NW / 2, y1 = from.y + NH
        const x2 = to.x + NW / 2, y2 = to.y
        const dy = Math.abs(y2 - y1) * 0.45
        const sel = sc.id === currentSelected
        const isDef = ci === sc.defaultChoice
        const stroke = sel
          ? (isDef ? 'rgba(201,169,110,0.8)' : 'rgba(201,169,110,0.45)')
          : (isDef ? 'rgba(100,90,150,0.6)' : 'rgba(55,53,85,0.45)')

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`)
        path.setAttribute('fill', 'none')
        path.setAttribute('stroke', stroke)
        path.setAttribute('stroke-width', isDef ? '2' : '1.5')

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', x2)
        dot.setAttribute('cy', y2)
        dot.setAttribute('r', '3')
        dot.setAttribute('fill', stroke)

        svg.appendChild(path)
        svg.appendChild(dot)
      })
    })
  }, [story])

  useEffect(() => {
    drawEdges()
  }, [drawEdges, positions, selectedNodeId])

  useEffect(() => {
    applyTransform()
  }, [zoom, pan, applyTransform])

  // Mouse wheel zoom
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const handleWheel = (e) => {
      // Check the event target is inside this canvas element
      const rect = el.getBoundingClientRect()
      const inBounds =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      if (!inBounds) return

      e.preventDefault()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const oldZ = zoomRef.current
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZ + delta))

      // Zoom toward mouse position
      const scale = newZ / oldZ
      const newPanX = mouseX - scale * (mouseX - panRef.current.x)
      const newPanY = mouseY - scale * (mouseY - panRef.current.y)

      zoomRef.current = newZ
      panRef.current = { x: newPanX, y: newPanY }
      setZoom(newZ)
      setPan({ x: newPanX, y: newPanY })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Canvas drag (left click on empty space)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const handleDown = (e) => {
      // Only start canvas drag if clicking directly on the canvas background
      if (e.target !== el && e.target !== innerRef.current) return
      canvasDrag.current = {
        down: true,
        sx: e.clientX,
        sy: e.clientY,
        ox: panRef.current.x,
        oy: panRef.current.y,
      }
      el.style.cursor = 'grabbing'
      e.preventDefault()
    }

    const handleMove = (e) => {
      const cd = canvasDrag.current
      if (!cd.down) return
      const dx = e.clientX - cd.sx
      const dy = e.clientY - cd.sy
      panRef.current = { x: cd.ox + dx, y: cd.oy + dy }
      setPan({ ...panRef.current })
      applyTransform()
    }

    const handleUp = () => {
      if (canvasDrag.current.down) {
        canvasDrag.current.down = false
        el.style.cursor = ''
      }
    }

    el.addEventListener('mousedown', handleDown)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      el.removeEventListener('mousedown', handleDown)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [applyTransform])

  // Zoom controls
  const doZoom = (delta) => {
    const el = canvasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    const oldZ = zoomRef.current
    const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZ + delta))
    const scale = newZ / oldZ
    const newPanX = cx - scale * (cx - panRef.current.x)
    const newPanY = cy - scale * (cy - panRef.current.y)

    zoomRef.current = newZ
    panRef.current = { x: newPanX, y: newPanY }
    setZoom(newZ)
    setPan({ x: newPanX, y: newPanY })
  }

  // Fit/center all nodes in view
  const fitToView = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const currentPositions = useStore.getState().creator.positions
    const allPos = Object.values(currentPositions)
    if (allPos.length === 0) return

    const NW = 185, NH = 118
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    allPos.forEach(p => {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x + NW > maxX) maxX = p.x + NW
      if (p.y + NH > maxY) maxY = p.y + NH
    })

    const contentW = maxX - minX
    const contentH = maxY - minY
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const padding = 60

    const scaleX = (rect.width - padding * 2) / contentW
    const scaleY = (rect.height - padding * 2) / contentH
    const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)))

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const newPanX = rect.width / 2 - centerX * newZ
    const newPanY = rect.height / 2 - centerY * newZ

    zoomRef.current = newZ
    panRef.current = { x: newPanX, y: newPanY }
    setZoom(newZ)
    setPan({ x: newPanX, y: newPanY })
  }, [])

  // Center view on initial load / when switching stories
  useEffect(() => {
    if (!story) return
    // Defer to next frame so canvas layout is settled
    const id = requestAnimationFrame(() => fitToView())
    return () => cancelAnimationFrame(id)
  }, [story?.id, fitToView])

  return (
    <div
      ref={canvasRef}
      className="flex-1 relative overflow-hidden"
      style={{
        backgroundColor: 'var(--bg)',
        backgroundImage: 'radial-gradient(circle, var(--s2) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        cursor: 'grab',
      }}
    >
      <div ref={innerRef} className="relative" style={{ minWidth: 2000, minHeight: 1500, transformOrigin: '0 0' }}>
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{ width: '100%', height: '100%' }}
        />
        {scenes.map(sc => (
          <SceneNode
            key={sc.id}
            scene={sc}
            story={story}
            pos={positions[sc.id] || { x: 0, y: 0 }}
            isSelected={sc.id === selectedNodeId}
            isStart={sc.id === story.startScene}
            onSelect={() => selectNode(sc.id)}
            onDrag={(x, y) => {
              updateNodePosition(sc.id, x, y)
              drawEdges()
            }}
            zoomRef={zoomRef}
          />
        ))}
      </div>

      {/* Zoom controls — bottom right */}
      <div
        className="absolute bottom-5 right-5 z-30 flex flex-col rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--s3)', background: 'var(--s1)' }}
      >
        <ZoomBtn onClick={() => doZoom(ZOOM_STEP)} label="+" />
        <div style={{ height: 1, background: 'var(--s3)' }} />
        <ZoomBtn onClick={fitToView} label="⊡" />
        <div style={{ height: 1, background: 'var(--s3)' }} />
        <ZoomBtn onClick={() => doZoom(-ZOOM_STEP)} label="−" />
      </div>

      {/* Zoom % indicator */}
      <div
        className="absolute bottom-6 right-[72px] z-30 text-[10px] tracking-wider"
        style={{ color: 'var(--mute)' }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

function ZoomBtn({ onClick, label }) {
  return (
    <button
      className="w-10 h-10 flex items-center justify-center cursor-pointer text-lg transition-colors"
      style={{ background: 'transparent', border: 'none', color: 'var(--sub)' }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--sub)'}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function SceneNode({ scene, story, pos, isSelected, isStart, onSelect, onDrag, zoomRef }) {
  const nodeRef = useRef(null)
  const dragState = useRef({ down: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  useEffect(() => {
    const el = nodeRef.current
    if (!el) return

    const handleMouseDown = (e) => {
      dragState.current = { down: true, moved: false, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
      e.preventDefault()
      e.stopPropagation() // Prevent canvas drag
    }

    const handleMouseMove = (e) => {
      const ds = dragState.current
      if (!ds.down) return
      const z = zoomRef.current
      const dx = (e.clientX - ds.sx) / z
      const dy = (e.clientY - ds.sy) / z
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.moved = true
      const nx = ds.ox + dx
      const ny = ds.oy + dy
      el.style.left = nx + 'px'
      el.style.top = ny + 'px'
      onDrag(nx, ny)
    }

    const handleMouseUp = () => {
      const ds = dragState.current
      if (ds.down && !ds.moved) {
        onSelect()
      }
      ds.down = false
    }

    el.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      el.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [pos.x, pos.y, onSelect, onDrag, zoomRef])

  const borderColor = isSelected ? 'var(--gold)' : isStart ? 'rgba(100,200,120,0.5)' : 'var(--s3)'
  const boxShadow = isSelected ? '0 0 0 3px var(--gold10)' : 'none'

  return (
    <div
      ref={nodeRef}
      className="absolute w-[185px] rounded-[var(--r)] cursor-grab select-none transition-[border-color,box-shadow] duration-200 active:cursor-grabbing hover:border-[var(--sub)]"
      style={{
        left: pos.x,
        top: pos.y,
        background: 'var(--s1)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--r)',
        boxShadow,
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 11px 7px', borderBottom: '1px solid var(--s2)' }}>
        <div className="text-xs font-medium mb-[2px]" style={{ color: 'var(--text)' }}>
          {scene.title}{isStart ? ' ★' : ''}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--mute)' }}>
          {scene.emotion} · reveal -{scene.secondsBeforeEnd || 0}s · {scene.countdown || 0}s countdown
          {scene.bgImage ? ' · 🖼' : ''}{scene.bgImage?.endsWith('.gif') ? ' GIF' : ''}
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '8px 11px 10px' }}>
        <div className="text-[10px] mb-[6px]" style={{ color: 'var(--sub)' }}>
          🔊 {scene.clips.length} clip{scene.clips.length !== 1 ? 's' : ''}
        </div>
        <div className="flex flex-col gap-1">
          {scene.choices.map((c, i) => (
            <div
              key={i}
              className="text-[10px] rounded-[6px] px-2 py-[3px] truncate"
              style={{
                color: 'var(--gold)',
                background: 'var(--gold10)',
                border: i === scene.defaultChoice ? '1px solid rgba(201,169,110,0.35)' : 'none',
              }}
            >
              {i === scene.defaultChoice ? '★ ' : ''}{c.text.slice(0, 28)}{c.text.length > 28 ? '…' : ''}
            </div>
          ))}
          {scene.choices.length === 0 && (
            <div className="text-[10px] italic" style={{ color: 'var(--mute)' }}>End node</div>
          )}
        </div>
      </div>
    </div>
  )
}
