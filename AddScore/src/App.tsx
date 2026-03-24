import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

interface Player {
  id: string
  name: string
  scores: number[]
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function totalScore(p: Player) {
  return p.scores.reduce((a, b) => a + b, 0)
}

function App() {
  const [players, setPlayers] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem('addscore-players')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [maxScore, setMaxScore] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('addscore-max')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [knownNames, setKnownNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('addscore-known-names')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [lastGameNames, setLastGameNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('addscore-last-game')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showPrevious, setShowPrevious] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null)
  const [addingName, setAddingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [scoreInput, setScoreInput] = useState('')
  const [showMaxInput, setShowMaxInput] = useState(false)
  const [maxInput, setMaxInput] = useState('')
  const [celebration, setCelebration] = useState<string | null>(null)
  const prevLeaderRef = useRef<{ id: string; won: boolean } | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const scoreRef = useRef<HTMLInputElement>(null)
  const maxRef = useRef<HTMLInputElement>(null)

  // Persist
  useEffect(() => {
    localStorage.setItem('addscore-players', JSON.stringify(players))
  }, [players])

  useEffect(() => {
    localStorage.setItem('addscore-max', JSON.stringify(maxScore))
  }, [maxScore])

  useEffect(() => {
    localStorage.setItem('addscore-last-game', JSON.stringify(lastGameNames))
  }, [lastGameNames])

  useEffect(() => {
    localStorage.setItem('addscore-known-names', JSON.stringify(knownNames))
  }, [knownNames])

  // Sort players by total descending
  const sorted = [...players].sort((a, b) => totalScore(b) - totalScore(a))
  const leader = sorted.length > 0 ? sorted[0] : null
  const leaderTotal = leader ? totalScore(leader) : 0

  // Detect win
  useEffect(() => {
    if (!leader || !maxScore || maxScore <= 0) {
      prevLeaderRef.current = null
      return
    }
    const won = leaderTotal >= maxScore
    const prev = prevLeaderRef.current
    if (won && (!prev || !prev.won || prev.id !== leader.id)) {
      setCelebration(leader.name)
    }
    prevLeaderRef.current = { id: leader.id, won }
  }, [leader, leaderTotal, maxScore])

  // Focus management
  useEffect(() => {
    if (addingName) nameRef.current?.focus()
  }, [addingName])

  useEffect(() => {
    if (editingPlayer) {
      setTimeout(() => scoreRef.current?.focus(), 50)
    }
  }, [editingPlayer])

  useEffect(() => {
    if (showMaxInput) {
      setTimeout(() => maxRef.current?.focus(), 50)
    }
  }, [showMaxInput])

  // Add player
  const handleAddName = useCallback(() => {
    const name = nameInput.trim()
    if (!name) {
      setAddingName(false)
      setNameInput('')
      return
    }
    setPlayers(prev => [...prev, { id: generateId(), name, scores: [] }])
    setKnownNames(prev => prev.includes(name) ? prev : [...prev, name])
    setNameInput('')
    // Keep input open for next name
  }, [nameInput])

  // Add score to player
  const handleAddScore = useCallback(() => {
    const val = parseFloat(scoreInput)
    if (isNaN(val) || !editingPlayer) return
    setPlayers(prev =>
      prev.map(p =>
        p.id === editingPlayer ? { ...p, scores: [...p.scores, val] } : p
      )
    )
    setScoreInput('')
    setEditingPlayer(null)
  }, [scoreInput, editingPlayer])

  // Edit a specific score entry
  const handleEditEntry = useCallback((playerId: string, idx: number, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId
          ? { ...p, scores: p.scores.map((s, i) => (i === idx ? num : s)) }
          : p
      )
    )
    setEditingPlayer(null)
  }, [])

  // Delete a score entry
  const handleDeleteEntry = useCallback((playerId: string, idx: number) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId
          ? { ...p, scores: p.scores.filter((_, i) => i !== idx) }
          : p
      )
    )
  }, [])

  // Delete player
  const handleDeletePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId))
    setEditingPlayer(null)
  }, [])

  // Reset
  const handleReset = useCallback(() => {
    if (players.length > 0) {
      setLastGameNames(players.map(p => p.name))
    }
    setPlayers([])
    setMaxScore(null)
    setEditingPlayer(null)
    setAddingName(false)
  }, [players])

  // Add previous player to current game
  const handleAddPrevious = useCallback((name: string) => {
    setPlayers(prev => [...prev, { id: generateId(), name, scores: [] }])
  }, [])

  // Previous players not currently in the game
  const currentNames = new Set(players.map(p => p.name))
  const previousPlayers = knownNames.filter(n => !currentNames.has(n))

  // Predictions
  const getPlayerPredictions = useCallback((player: Player) => {
    if (!maxScore || maxScore <= 0) return null
    const total = totalScore(player)
    const rounds = player.scores.length
    if (rounds === 0) return null

    const avgPerRound = total / rounds
    const remaining = maxScore - total
    if (remaining <= 0) return { roundsToWin: 0, avgPerRound, remaining: 0 }

    const roundsToWin = avgPerRound > 0 ? Math.ceil(remaining / avgPerRound) : Infinity

    return { roundsToWin, avgPerRound: Math.round(avgPerRound * 10) / 10, remaining }
  }, [maxScore])

  const editingPlayerObj = players.find(p => p.id === editingPlayer)

  // Compute rank emojis (unique random from pool until exhausted)
  const rankEmojis = (() => {
    const loserPool = ['😅', '🫠', '🐌', '🥔', '🤡', '💀', '🐢', '😬', '🪑', '👻']
    const map = new Map<string, string>()
    // Shuffle pool seeded by all player ids combined for stability
    const seed = sorted.map(p => p.id).join('')
    const seedHash = seed.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
    const shuffled = [...loserPool].sort((a, b) => {
      const ha = (seedHash + a.codePointAt(0)!) & 0x7fffffff
      const hb = (seedHash + b.codePointAt(0)!) & 0x7fffffff
      return ha - hb
    })

    const gameStarted = sorted.some(p => totalScore(p) > 0)

    let poolIdx = 0
    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i]
      const total = totalScore(player)
      const isLast = sorted.length > 1 && i === sorted.length - 1

      // Podium spots only if that player has actually scored
      if (i === 0 && total > 0) { map.set(player.id, '🏆'); continue }
      if (i === 1 && total > 0) { map.set(player.id, '🥈'); continue }
      if (i === 2 && total > 0) { map.set(player.id, '🥉'); continue }
      // Poop only if last AND they've scored (they're truly losing)
      if (isLast && sorted.length > 3 && total > 0) { map.set(player.id, '💩'); continue }

      // Once game started, everyone without a podium spot gets a random emoji
      if (gameStarted) {
        map.set(player.id, shuffled[poolIdx % shuffled.length])
        poolIdx++
        continue
      }

      map.set(player.id, String(i + 1))
    }
    return map
  })()

  // Winner banner
  const renderBanner = () => {
    if (sorted.length === 0) {
      return (
        <div className="no-players-banner">
          <h1>AddScore</h1>
          <p>Tap below to add players</p>
        </div>
      )
    }

    if (leader && maxScore && leaderTotal >= maxScore) {
      return (
        <div className="winner-banner">
          <h1>{leader.name} Wins!</h1>
          <div className="subtitle">{leaderTotal} points</div>
        </div>
      )
    }

    if (leader && leaderTotal > 0) {
      const second = sorted.length > 1 ? sorted[1] : null
      const lead = second ? leaderTotal - totalScore(second) : 0
      const pred = getPlayerPredictions(leader)

      let subtitle = ''
      if (maxScore && pred && pred.remaining > 0) {
        subtitle = `${pred.remaining} away from winning`
      } else if (lead > 0 && second) {
        subtitle = `Leading by ${lead}`
      }

      return (
        <div className="winner-banner">
          <h1>{leader.name} is Winning</h1>
          {subtitle && <div className="subtitle">{subtitle}</div>}
        </div>
      )
    }

    return (
      <div className="no-players-banner">
        <h1>AddScore</h1>
        <p>Tap a name to add points</p>
      </div>
    )
  }

  return (
    <>
      {/* Fireflies */}
      <div className="fireflies">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="firefly"
            style={{
              '--start-x': `${10 + Math.random() * 80}%`,
              '--drift': `${Math.random() * 60 - 30}px`,
              '--delay': `${Math.random() * 8}s`,
              '--duration': `${3 + Math.random() * 4}s`,
              '--size': `${2 + Math.random() * 3}px`,
              '--glow-hue': `${35 + Math.random() * 20}`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {renderBanner()}

      {/* Settings Bar */}
      {sorted.length > 0 && (
        <div className="settings-bar">
          {!showMaxInput ? (
            <button
              className={`max-score-btn ${maxScore ? 'active' : ''}`}
              onClick={() => {
                setShowMaxInput(true)
                setMaxInput(maxScore ? String(maxScore) : '')
              }}
            >
              {maxScore ? `Goal: ${maxScore}` : 'Set Goal'}
            </button>
          ) : (
            <input
              ref={maxRef}
              className="max-score-input"
              type="number"
              inputMode="numeric"
              placeholder="Goal"
              value={maxInput}
              onChange={e => setMaxInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = parseInt(maxInput)
                  setMaxScore(val > 0 ? val : null)
                  setShowMaxInput(false)
                }
              }}
              onBlur={() => {
                const val = parseInt(maxInput)
                setMaxScore(val > 0 ? val : null)
                setShowMaxInput(false)
              }}
            />
          )}
          <button className="reset-btn" onClick={handleReset}>
            New Game
          </button>
        </div>
      )}

      {/* Player List */}
      <div className="player-list">
        {sorted.map((player, i) => {
          const total = totalScore(player)
          const progress = maxScore && maxScore > 0 ? Math.min(100, (total / maxScore) * 100) : 0

          return (
            <div
              key={player.id}
              className="player-row"
              onClick={() => {
                setEditingPlayer(player.id)
                setScoreInput('')
              }}
            >
              <span className="rank">
                {rankEmojis.get(player.id) ?? i + 1}
              </span>
              <span className="name">{player.name}</span>
              {player.scores.length > 0 && (
                <span className="score-entries">
                  {player.scores.map((s, idx) => (
                    <span key={idx}>+{s}</span>
                  ))}
                </span>
              )}
              <span
                className="score-total"
                onClick={e => {
                  e.stopPropagation()
                  setEditingPlayer(player.id)
                  setScoreInput('')
                }}
              >
                {total}
              </span>
              {maxScore && maxScore > 0 && (
                <div className="progress-bar-bg">
                  <div
                    className={`progress-bar-fill ${progress >= 80 ? 'near-win' : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Rematch - add all last game's players */}
        {players.length === 0 && lastGameNames.length > 0 && (
          <div
            className="rematch-row"
            onClick={() => {
              const newPlayers = lastGameNames.map(name => ({
                id: generateId(),
                name,
                scores: [],
              }))
              setPlayers(newPlayers)
            }}
          >
            <span className="rematch-icon">&#8635;</span>
            <span className="rematch-text">Rematch</span>
          </div>
        )}

        {/* Add Player */}
        {!addingName ? (
          <div className="add-player-row" onClick={() => setAddingName(true)}>
            <span className="plus-icon">+</span>
            <span className="add-text">Add Player</span>
          </div>
        ) : (
          <div className="add-player-row">
            <span className="plus-icon">+</span>
            <input
              ref={nameRef}
              className="name-input"
              type="text"
              placeholder="Player name"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddName()
                if (e.key === 'Escape') {
                  setAddingName(false)
                  setNameInput('')
                }
              }}
              onBlur={() => {
                if (nameInput.trim()) handleAddName()
                setTimeout(() => {
                  setAddingName(false)
                  setNameInput('')
                }, 100)
              }}
            />
          </div>
        )}

        {/* Previous Players */}
        {previousPlayers.length > 0 && (
          <div className="previous-section">
            <div
              className="previous-header"
              onClick={() => setShowPrevious(p => !p)}
            >
              <span className={`chevron ${showPrevious ? 'open' : ''}`}>&#8250;</span>
              <span className="previous-label">Previous Players</span>
              <span className="previous-count">{previousPlayers.length}</span>
            </div>
            {showPrevious && (
              <div className="previous-list">
                {previousPlayers.map(name => (
                  <div key={name} className="previous-row" onClick={() => handleAddPrevious(name)}>
                    <span className="previous-add-btn">+</span>
                    <span className="previous-name">{name}</span>
                    <button
                      className="previous-remove-btn"
                      onClick={e => {
                        e.stopPropagation()
                        setKnownNames(prev => prev.filter(n => n !== name))
                      }}
                    >
                      &minus;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Score Entry Overlay */}
      {editingPlayer && editingPlayerObj && (
        <div
          className="score-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) setEditingPlayer(null)
          }}
        >
          <div className="score-panel">
            <div className="panel-header">
              <h2>{editingPlayerObj.name}</h2>
              <button className="close-btn" onClick={() => setEditingPlayer(null)}>
                &times;
              </button>
            </div>

            <div className="score-input-row">
              <input
                ref={scoreRef}
                type="number"
                inputMode="numeric"
                placeholder="+0"
                value={scoreInput}
                onChange={e => setScoreInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddScore()
                }}
              />
              <button className="add-score-btn" onClick={handleAddScore}>
                Add
              </button>
            </div>

            {/* Score History */}
            {editingPlayerObj.scores.length > 0 && (
              <div className="score-history-section">
                <div className="total-edit-row">
                  <span className="label">Total</span>
                  <span className="total-value">{totalScore(editingPlayerObj)}</span>
                </div>
                <h3>History</h3>
                {[...editingPlayerObj.scores].reverse().map((s, ri) => {
                  const actualIdx = editingPlayerObj.scores.length - 1 - ri
                  return (
                    <div key={actualIdx} className="history-entry">
                      <span className="round-label">#{actualIdx + 1}</span>
                      <input
                        className="entry-input"
                        type="number"
                        inputMode="numeric"
                        defaultValue={s}
                        onBlur={e =>
                          handleEditEntry(editingPlayerObj.id, actualIdx, e.target.value)
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleEditEntry(editingPlayerObj.id, actualIdx, (e.target as HTMLInputElement).value)
                          }
                        }}
                      />
                      <button
                        className="delete-entry"
                        onClick={() => handleDeleteEntry(editingPlayerObj.id, actualIdx)}
                      >
                        &times;
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Predictions */}
            {maxScore && (() => {
              const pred = getPlayerPredictions(editingPlayerObj)
              if (!pred) return null
              const total = totalScore(editingPlayerObj)

              // Win probability: simple estimate based on position
              const myPred = pred
              const otherPreds = sorted
                .filter(p => p.id !== editingPlayerObj.id)
                .map(p => ({ total: totalScore(p), avg: p.scores.length > 0 ? totalScore(p) / p.scores.length : 0 }))

              const bestOtherRoundsToWin = otherPreds.length > 0
                ? Math.min(...otherPreds.map(o => o.avg > 0 ? Math.ceil((maxScore - o.total) / o.avg) : Infinity))
                : Infinity

              const winChance = myPred.roundsToWin <= 0 ? 100
                : bestOtherRoundsToWin === Infinity ? 95
                : myPred.roundsToWin <= bestOtherRoundsToWin
                  ? Math.min(95, Math.round(70 + 25 * (bestOtherRoundsToWin - myPred.roundsToWin) / Math.max(1, bestOtherRoundsToWin)))
                  : Math.max(5, Math.round(50 - 45 * (myPred.roundsToWin - bestOtherRoundsToWin) / Math.max(1, myPred.roundsToWin)))

              return (
                <div className="predictions">
                  <div className="pred-title">Predictions</div>
                  <div className="pred-row">
                    <span className="pred-label">Avg per round</span>
                    <span className="pred-value">{myPred.avgPerRound}</span>
                  </div>
                  {myPred.remaining > 0 && (
                    <>
                      <div className="pred-row">
                        <span className="pred-label">Points to goal</span>
                        <span className="pred-value">{myPred.remaining}</span>
                      </div>
                      <div className="pred-row">
                        <span className="pred-label">Est. rounds left</span>
                        <span className="pred-value">
                          {myPred.roundsToWin === Infinity ? '--' : `~${myPred.roundsToWin}`}
                        </span>
                      </div>
                      <div className="pred-row">
                        <span className="pred-label">Win chance</span>
                        <span className={`pred-value ${winChance >= 50 ? 'good' : 'bad'}`}>
                          {winChance}%
                        </span>
                      </div>
                    </>
                  )}
                  {total >= maxScore && (
                    <div className="pred-row">
                      <span className="pred-label">Status</span>
                      <span className="pred-value good">Goal reached!</span>
                    </div>
                  )}
                </div>
              )
            })()}

            <button
              className="delete-player-btn"
              onClick={() => handleDeletePlayer(editingPlayerObj.id)}
            >
              Remove {editingPlayerObj.name}
            </button>
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      {celebration && (
        <div className="celebration-overlay" onClick={() => setCelebration(null)}>
          <div className="fireworks">
            {/* 5 waves of particles, staggered across 5 seconds */}
            {Array.from({ length: 5 }).map((_, wave) =>
              Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={`${wave}-${i}`}
                  className="particle"
                  style={{
                    '--x': `${Math.random() * 160 - 80}vw`,
                    '--y': `${Math.random() * 160 - 80}vh`,
                    '--delay': `${wave * 0.9 + Math.random() * 0.6}s`,
                    '--size': `${Math.random() * 10 + 4}px`,
                    '--hue': `${Math.random() * 360}`,
                    '--duration': `${Math.random() * 1.2 + 0.8}s`,
                    '--origin-x': `${Math.random() * 80 + 10}%`,
                    '--origin-y': `${Math.random() * 60 + 20}%`,
                  } as React.CSSProperties}
                />
              ))
            )}
          </div>
          <div className="celebration-content">
            <div className="celebration-emoji">🏆</div>
            <h1 className="celebration-name">{celebration}</h1>
            <div className="celebration-sub">WINS!</div>
          </div>
          <div className="sparkle-ring" />
          <div className="celebration-tap">tap to dismiss</div>
        </div>
      )}
    </>
  )
}

export default App
