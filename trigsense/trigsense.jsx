const { useState, useEffect, useRef, useCallback } = React;

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0c1a",
  surface: "#16152a",
  surfaceAlt: "#1e1c35",
  border: "#2a2847",
  gold: "#ffd166",
  mint: "#06d6a0",
  teal: "#4ecdc4",
  coral: "#ef476f",
  purple: "#a663cc",
  blue: "#118ab2",
  text: "#f0ecff",
  muted: "#7c78a0",
  dimmed: "#3a3660",
};
const F = "'Nunito', system-ui, sans-serif";
const FD = "'Sora', system-ui, sans-serif";

// ─── DATA ─────────────────────────────────────────────────────────────────────
const IDS = [
  {
    id: 1, name: "The Foundation", color: C.gold,
    formula: "sin²(x) + cos²(x) = 1",
    blurb: "Sin is height, cos is width. On a circle with radius 1, those two always balance — their squares add up to exactly 1.",
    blanks: [
      { t: "sin²(x) + ___ = 1", a: "cos²(x)", h: "The width squared — the x-direction" },
      { t: "___ + cos²(x) = 1", a: "sin²(x)", h: "The height squared — the y-direction" },
    ],
  },
  {
    id: 2, name: "Tangent", color: C.mint,
    formula: "tan(x) = sin(x) / cos(x)",
    blurb: "Tangent is height divided by width — sin over cos. It's the slope of the line from the center to the point.",
    blanks: [
      { t: "tan(x) = ___ / cos(x)", a: "sin(x)", h: "The top — height = y-coordinate" },
      { t: "tan(x) = sin(x) / ___", a: "cos(x)", h: "The bottom — width = x-coordinate" },
    ],
  },
  {
    id: 3, name: "Unit Circle Basics", color: C.teal,
    formula: "cos = x-coordinate  ·  sin = y-coordinate",
    blurb: "Every point on the unit circle sits at exactly (cos θ, sin θ). Negative angles just go clockwise instead of counterclockwise.",
    blanks: [
      { t: "x-coordinate = ___", a: "cos(x)", h: "Left-right on the circle" },
      { t: "y-coordinate = ___", a: "sin(x)", h: "Up-down on the circle" },
    ],
  },
  {
    id: 4, name: "Sin Addition", color: C.purple,
    formula: "sin(x+y) = sin(x)cos(y) + sin(y)cos(x)",
    blurb: "Adding angles for sin: it crosses — sin×cos plus sin×cos — with x and y swapped between the two terms.",
    blanks: [
      { t: "sin(x+y) = sin(x)cos(y) + ___", a: "sin(y)cos(x)", h: "Mirror the first term — swap x and y" },
    ],
  },
  {
    id: 5, name: "Cos Addition", color: C.coral,
    formula: "cos(x+y) = cos(x)cos(y) − sin(x)sin(y)",
    blurb: "Cosine addition: cos×cos minus sin×sin. That minus sign is the key detail that sets it apart from sin addition.",
    blanks: [
      { t: "cos(x+y) = ___ − sin(x)sin(y)", a: "cos(x)cos(y)", h: "Cos times cos — same function, both angles" },
    ],
  },
];

const QS = [
  { id: "q1a", iid: 1, q: "Which formula is always true for any angle?",
    opts: ["sin²(x) + cos²(x) = 1", "sin(x) + cos(x) = 1", "sin²(x) − cos²(x) = 1", "sin(x) = cos(x)"],
    ans: 0, exp: "The squares always add to 1 — it comes from the circle's radius being 1." },
  { id: "q1b", iid: 1, q: "sin²(x) + cos²(x) = ?",
    opts: ["1", "0", "2", "it changes with the angle"],
    ans: 0, exp: "Always exactly 1. Every angle, no exceptions. This never changes." },
  { id: "q2a", iid: 2, q: "tan(x) is equal to:",
    opts: ["sin(x) / cos(x)", "cos(x) / sin(x)", "sin(x) × cos(x)", "1 / cos(x)"],
    ans: 0, exp: "Tangent = sin ÷ cos. Height over width." },
  { id: "q2b", iid: 2, q: "If sin(x) = 0.5 and cos(x) = 0.87, then tan(x) ≈",
    opts: ["0.57", "1.74", "0.44", "0.13"],
    ans: 0, exp: "0.5 ÷ 0.87 ≈ 0.57" },
  { id: "q3a", iid: 3, q: "On the unit circle, sin(x) represents the:",
    opts: ["y-coordinate", "x-coordinate", "radius", "the angle in degrees"],
    ans: 0, exp: "Sin = height = y-coordinate. Cos = width = x-coordinate. Always." },
  { id: "q3b", iid: 3, q: "A point on the circle is at (−0.7, 0.71). What is cos(x)?",
    opts: ["−0.7", "0.71", "0.7", "−0.71"],
    ans: 0, exp: "Cos is always the x-coordinate — the left/right value." },
  { id: "q4a", iid: 4, q: "sin(x + y) equals:",
    opts: ["sin(x)cos(y) + sin(y)cos(x)", "sin(x)sin(y) + cos(x)cos(y)", "sin(x)cos(y) − sin(y)cos(x)", "cos(x)cos(y) − sin(x)sin(y)"],
    ans: 0, exp: "Cross pattern: sin×cos + sin×cos, with x and y swapped between terms." },
  { id: "q5a", iid: 5, q: "cos(x + y) equals:",
    opts: ["cos(x)cos(y) − sin(x)sin(y)", "cos(x)cos(y) + sin(x)sin(y)", "sin(x)cos(y) + sin(y)cos(x)", "sin(x)sin(y) − cos(x)cos(y)"],
    ans: 0, exp: "Cos×cos minus sin×sin. The minus sign is the key detail to remember." },
];

const PRAISE = [
  "You've got this! 🌟", "Yes — exactly right.", "That one's yours now. ✓",
  "Your brain is making connections.", "Nailed it.", "Perfect. Keep going.",
  "That clicked.", "Excellent work.", "You're getting stronger at this.",
];
const NEAR = [
  "Almost — here's the key part:", "Good thinking — here's what to focus on:",
  "This one trips a lot of people:", "Not quite — here's the trick:",
];
const rand = (a) => a[Math.floor(Math.random() * a.length)];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const defP = () => ({
  sessions: 0,
  lastSession: null,
  exploreRounds: 0,
  speedBests: [],
  ids: Object.fromEntries(IDS.map((i) => [i.id, { seen: 0, correct: 0, streak: 0, mastered: false }])),
  _started: false,
});

const STORAGE_KEY = "trigsense_v1";
const saveP = (p) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (_) {}
};
const loadP = () => {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return null;
};

const isUnlocked = (p, id) => {
  if (id === 1) return true;
  return p.ids[id - 1]?.correct >= 3;
};

// ─── UNIT CIRCLE ──────────────────────────────────────────────────────────────
function UnitCircle({ angle, onChange, mode = "free", targetAngle = null, challengeKey, onMatch }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const didMatch = useRef(false);

  useEffect(() => { didMatch.current = false; }, [challengeKey]);

  const R = 110, CX = 150, CY = 150;
  const px = CX + R * Math.cos(angle);
  const py = CY - R * Math.sin(angle);
  const sinV = +Math.sin(angle).toFixed(3);
  const cosV = +Math.cos(angle).toFixed(3);

  const getAngle = useCallback((e) => {
    const s = svgRef.current;
    if (!s) return angle;
    const rect = s.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 300 - CX;
    const y = ((e.clientY - rect.top) / rect.height) * 300 - CY;
    return Math.atan2(-y, x);
  }, [angle]);

  const onDown = (e) => {
    dragging.current = true;
    didMatch.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(getAngle(e));
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const a = getAngle(e);
    onChange(a);
    if ((mode === "find" || mode === "speed") && targetAngle != null && !didMatch.current) {
      const ds = Math.abs(Math.sin(a) - Math.sin(targetAngle));
      const dc = Math.abs(Math.cos(a) - Math.cos(targetAngle));
      if (ds < 0.1 && dc < 0.1) {
        didMatch.current = true;
        onMatch?.();
      }
    }
  };
  const onUp = () => { dragging.current = false; };

  const deg = Math.round(((angle * 180) / Math.PI + 360) % 360);

  let tX = null, tY = null;
  if (targetAngle != null) {
    tX = CX + R * Math.cos(targetAngle);
    tY = CY - R * Math.sin(targetAngle);
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox="0 0 300 300"
        style={{ width: "100%", maxWidth: 320, display: "block", margin: "0 auto", touchAction: "none", cursor: "grab", userSelect: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* Background glow */}
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1840" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0d0c1a" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={CX} cy={CY} r={125} fill="url(#bgGlow)" />

        {/* Axes */}
        <line x1="18" y1="150" x2="282" y2="150" stroke={C.border} strokeWidth="1.5" />
        <line x1="150" y1="18" x2="150" y2="282" stroke={C.border} strokeWidth="1.5" />

        {/* Circle */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#302c55" strokeWidth="2" />

        {/* 30° tick marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return <line key={i}
            x1={CX + (R - 7) * Math.cos(a)} y1={CY - (R - 7) * Math.sin(a)}
            x2={CX + R * Math.cos(a)} y2={CY - R * Math.sin(a)}
            stroke="#3a3660" strokeWidth="1.5" />;
        })}

        {/* Axis labels */}
        {[{ d: 0, l: "0°", dx: 14, dy: 0 }, { d: 90, l: "90°", dx: 0, dy: -14 }, { d: 180, l: "180°", dx: -18, dy: 0 }, { d: 270, l: "270°", dx: 0, dy: 14 }].map(({ d, l, dx, dy }) => {
          const a = (d * Math.PI) / 180;
          return <text key={d} x={CX + (R + 18) * Math.cos(a) + dx} y={CY - (R + 18) * Math.sin(a) + dy}
            textAnchor="middle" dominantBaseline="middle" fill={C.dimmed} fontSize="9" fontFamily={F}>{l}</text>;
        })}

        {/* Target zone */}
        {tX != null && (
          <>
            <circle cx={tX} cy={tY} r={16} fill="#ffd16614" stroke={C.gold} strokeWidth="2" strokeDasharray="4 2" filter="url(#glow)" />
            <circle cx={tX} cy={tY} r={5} fill={C.gold} opacity="0.8" />
          </>
        )}

        {/* Cos line */}
        <line x1={CX} y1={CY} x2={px} y2={CY} stroke={C.teal} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        {/* Sin line */}
        <line x1={px} y1={CY} x2={px} y2={py} stroke={C.mint} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        {/* Radius */}
        <line x1={CX} y1={CY} x2={px} y2={py} stroke={C.gold} strokeWidth="1.5" opacity="0.4" strokeDasharray="5 3" />

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={3.5} fill={C.muted} />

        {/* Moving point */}
        <circle cx={px} cy={py} r={13} fill="#0d0c1a" stroke={C.gold} strokeWidth="2.5" filter="url(#glow)" />
        <circle cx={px} cy={py} r={5} fill={C.gold} />

        {/* Inline labels */}
        <text x={(CX + px) / 2} y={CY - 9} textAnchor="middle" fill={C.teal} fontSize="9.5" fontFamily={F} fontWeight="700">cos={cosV}</text>
        {Math.abs(sinV) > 0.08 && (
          <text
            x={cosV >= 0 ? px + 12 : px - 12}
            y={(CY + py) / 2}
            textAnchor={cosV >= 0 ? "start" : "end"}
            dominantBaseline="middle"
            fill={C.mint} fontSize="9.5" fontFamily={F} fontWeight="700">sin={sinV}</text>
        )}
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10, fontFamily: F, fontSize: 13 }}>
        <span style={{ color: C.teal, fontWeight: 700 }}>cos = {cosV}</span>
        <span style={{ color: C.muted }}>·</span>
        <span style={{ color: C.mint, fontWeight: 700 }}>sin = {sinV}</span>
        <span style={{ color: C.muted }}>·</span>
        <span style={{ color: C.gold, fontWeight: 700 }}>{deg}°</span>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ progress, onNav }) {
  const totalCorrect = Object.values(progress.ids).reduce((s, v) => s + v.correct, 0);
  const mastered = Object.values(progress.ids).filter((v) => v.mastered).length;

  const suggestion = (() => {
    if (progress.sessions <= 1) return { mode: "explore", label: "Start with the unit circle →", sub: "Build your intuition first — no pressure" };
    if (totalCorrect < 3) return { mode: "explore", label: "Keep exploring →", sub: "Drag the circle, see sin and cos in action" };
    if (progress.ids[1].correct < 3) return { mode: "practice", label: "Try your first identity →", sub: "sin²(x) + cos²(x) = 1" };
    return { mode: "practice", label: "Continue practicing →", sub: `${mastered}/5 identities solid` };
  })();

  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "28px 20px", fontFamily: F }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>{greet}</div>
        <div style={{ fontSize: 30, fontFamily: FD, color: C.text, fontWeight: 800, lineHeight: 1.15 }}>
          Let's make trig<br />make sense.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[{ l: "Sessions", v: progress.sessions }, { l: "Correct", v: totalCorrect }, { l: "Mastered", v: `${mastered}/5` }].map((s) => (
          <div key={s.l} style={{ flex: 1, background: C.surface, borderRadius: 14, padding: "14px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.gold }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Suggestion card */}
      <div style={{ background: `linear-gradient(135deg, #1e1c35, #261f40)`, borderRadius: 18, padding: "20px", marginBottom: 16, border: `1px solid ${C.border}`, cursor: "pointer" }}
        onClick={() => onNav(suggestion.mode)}>
        <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Today's Focus</div>
        <div style={{ fontSize: 18, color: C.text, fontWeight: 700, marginBottom: 4 }}>{suggestion.label}</div>
        <div style={{ fontSize: 13, color: C.muted }}>{suggestion.sub}</div>
      </div>

      {/* Mode buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {[{ k: "explore", icon: "◎", l: "Explore", sub: "Interactive unit circle" }, { k: "practice", icon: "◈", l: "Practice", sub: "Quizzes & fill-in-the-blank" }].map((m) => (
          <div key={m.k} style={{ background: C.surface, borderRadius: 14, padding: "16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", border: `1px solid ${C.border}` }}
            onClick={() => onNav(m.k)}>
            <div style={{ fontSize: 24, color: C.gold }}>{m.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{m.l}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{m.sub}</div>
            </div>
            <div style={{ marginLeft: "auto", color: C.muted, fontSize: 20 }}>›</div>
          </div>
        ))}
      </div>

      {/* Identity roadmap */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Your Roadmap</div>
        {IDS.map((id) => {
          const p = progress.ids[id.id];
          const locked = !isUnlocked(progress, id.id);
          const pct = Math.min(1, p.correct / 5);
          return (
            <div key={id.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, opacity: locked ? 0.4 : 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: locked ? C.border : `${id.color}22`, border: `2px solid ${locked ? C.dimmed : id.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: locked ? C.muted : id.color, flexShrink: 0 }}>
                {locked ? "🔒" : id.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>{id.name}</div>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct * 100}%`, background: id.color, borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
              {p.mastered && <span style={{ fontSize: 16 }}>⭐</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EXPLORE MODE ─────────────────────────────────────────────────────────────
function ExploreMode({ progress, onUpdate }) {
  const [sub, setSub] = useState("free");
  const [angle, setAngle] = useState(0.5);
  const [challenge, setChallenge] = useState(null);
  const [challengeKey, setChallengeKey] = useState(0);
  const [matched, setMatched] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Speed round
  const [speedIdx, setSpeedIdx] = useState(0);
  const [speedTimes, setSpeedTimes] = useState([]);
  const [speedDone, setSpeedDone] = useState(false);
  const speedStartRef = useRef(null);
  const speedIdxRef = useRef(0);
  const speedTimesRef = useRef([]);

  const genChallenge = useCallback(() => {
    const targetA = (Math.random() * Math.PI * 1.8) - Math.PI * 0.9 + (Math.random() > 0.5 ? Math.PI * 0.3 : 0);
    const type = Math.random() > 0.5 ? "sin" : "cos";
    const val = type === "sin" ? +Math.sin(targetA).toFixed(2) : +Math.cos(targetA).toFixed(2);
    setChallenge({ type, val, targetAngle: targetA });
    setChallengeKey((k) => k + 1);
    setMatched(false);
    setFeedback("");
  }, []);

  const startFind = useCallback(() => {
    setSub("find");
    genChallenge();
    onUpdate((p) => ({ ...p, exploreRounds: p.exploreRounds + 1 }));
  }, [genChallenge, onUpdate]);

  const startSpeed = useCallback(() => {
    setSub("speed");
    speedIdxRef.current = 0;
    speedTimesRef.current = [];
    setSpeedIdx(0);
    setSpeedTimes([]);
    setSpeedDone(false);
    setMatched(false);
    speedStartRef.current = Date.now();
    genChallenge();
  }, [genChallenge]);

  const handleMatch = useCallback(() => {
    if (sub === "find") {
      setMatched(true);
      setFeedback(rand(PRAISE));
    } else if (sub === "speed") {
      const elapsed = (Date.now() - speedStartRef.current) / 1000;
      const newTimes = [...speedTimesRef.current, elapsed];
      speedTimesRef.current = newTimes;
      setSpeedTimes([...newTimes]);

      if (speedIdxRef.current >= 4) {
        setSpeedDone(true);
        const total = newTimes.reduce((a, b) => a + b, 0);
        onUpdate((p) => ({ ...p, speedBests: [...p.speedBests, { time: total, date: new Date().toISOString() }].slice(-20) }));
      } else {
        speedIdxRef.current += 1;
        setSpeedIdx(speedIdxRef.current);
        speedStartRef.current = Date.now();
        genChallenge();
      }
    }
  }, [sub, genChallenge, onUpdate]);

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ k: "free", l: "Free Explore" }, { k: "find", l: "Find the Point" }, { k: "speed", l: "Speed Round" }].map((t) => (
          <button key={t.k}
            onClick={() => { if (t.k === "find") startFind(); else if (t.k === "speed") startSpeed(); else setSub("free"); }}
            style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${sub === t.k ? C.gold : C.border}`, background: sub === t.k ? `${C.gold}18` : C.surface, color: sub === t.k ? C.gold : C.muted, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: F, lineHeight: 1.3 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Challenge display (find/speed) */}
      {sub !== "free" && challenge && !speedDone && (
        <div style={{ background: C.surfaceAlt, borderRadius: 14, padding: "14px 16px", marginBottom: 16, border: `1px solid ${C.border}`, textAlign: "center" }}>
          {sub === "speed" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Speed Round</div>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < speedIdxRef.current ? C.mint : i === speedIdxRef.current ? C.gold : C.border }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Drag the point to match:</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>
            <span style={{ color: challenge.type === "sin" ? C.mint : C.teal }}>{challenge.type}</span>(x) = <span style={{ color: C.gold }}>{challenge.val}</span>
          </div>
          {sub === "find" && matched && (
            <div style={{ marginTop: 10, fontSize: 14, color: C.mint, fontWeight: 700 }}>✓ {feedback}</div>
          )}
        </div>
      )}

      {/* Circle */}
      <div style={{ marginBottom: 16 }}>
        <UnitCircle
          angle={angle}
          onChange={setAngle}
          mode={sub === "free" ? "free" : "find"}
          targetAngle={sub !== "free" && challenge && !matched ? challenge.targetAngle : null}
          challengeKey={challengeKey}
          onMatch={handleMatch}
        />
      </div>

      {/* Bottom panel */}
      {sub === "free" && (
        <div style={{ background: C.surface, borderRadius: 14, padding: "16px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.gold, fontWeight: 700, marginBottom: 8 }}>How to read this circle</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>
            Drag the point around. The <span style={{ color: C.teal, fontWeight: 700 }}>teal line</span> is cos — how far left or right. The <span style={{ color: C.mint, fontWeight: 700 }}>green line</span> is sin — how far up or down. Try finding where sin = 0, where cos = −1, and where they're equal.
          </div>
        </div>
      )}

      {sub === "find" && matched && (
        <button onClick={genChallenge} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
          Next Challenge →
        </button>
      )}

      {sub === "find" && !matched && challenge && (
        <div style={{ background: C.surface, borderRadius: 14, padding: "12px 16px", border: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
          Drag until the numbers match. You'll feel a glow when you land it. ✦
        </div>
      )}

      {sub === "speed" && speedDone && (
        <div style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.gold, marginBottom: 14 }}>Round complete! 🌟</div>
          {speedTimes.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>Challenge {i + 1}</span>
              <span style={{ color: C.text, fontWeight: 700 }}>{t.toFixed(1)}s</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 15 }}>
            <span style={{ color: C.text, fontWeight: 700 }}>Total</span>
            <span style={{ color: C.gold, fontWeight: 800 }}>{speedTimes.reduce((a, b) => a + b, 0).toFixed(1)}s</span>
          </div>
          {progress.speedBests.length > 1 && (
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Your best: {Math.min(...progress.speedBests.map((s) => s.time)).toFixed(1)}s
            </div>
          )}
          <button onClick={startSpeed} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PRACTICE MODE ────────────────────────────────────────────────────────────
function PracticeMode({ progress, onUpdate }) {
  const [tab, setTab] = useState("recognize");
  const [iid, setIid] = useState(1);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [recallInput, setRecallInput] = useState("");
  const [recallResult, setRecallResult] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [blankIdx, setBlankIdx] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const ident = IDS.find((i) => i.id === iid);
  const availQs = QS.filter((q) => q.iid === iid);
  const q = availQs[qIdx % Math.max(availQs.length, 1)];
  const blank = ident?.blanks[blankIdx % (ident?.blanks.length || 1)];

  const reset = () => {
    setSelected(null); setSubmitted(false);
    setRecallInput(""); setRecallResult(null);
    setShowHint(false); setFeedbackMsg("");
  };

  const submitRecognize = (optIdx) => {
    if (submitted) return;
    setSelected(optIdx);
    setSubmitted(true);
    const correct = optIdx === q.ans;
    setFeedbackMsg(correct ? rand(PRAISE) : rand(NEAR));
    onUpdate((p) => {
      const prev = p.ids[iid];
      const streak = correct ? prev.streak + 1 : 0;
      return { ...p, ids: { ...p.ids, [iid]: { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0), streak, mastered: streak >= 5 } } };
    });
  };

  const nextQ = () => { reset(); setQIdx((i) => i + 1); };

  const submitRecall = () => {
    if (!blank) return;
    const correct = recallInput.replace(/\s/g, "").toLowerCase() === blank.a.replace(/\s/g, "").toLowerCase();
    setRecallResult(correct ? "correct" : "wrong");
    setFeedbackMsg(correct ? rand(PRAISE) : rand(NEAR));
    onUpdate((p) => {
      const prev = p.ids[iid];
      const streak = correct ? prev.streak + 1 : 0;
      return { ...p, ids: { ...p.ids, [iid]: { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0), streak, mastered: streak >= 5 } } };
    });
  };

  const nextRecall = () => { reset(); setBlankIdx((i) => i + 1); };

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      {/* Tab */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[{ k: "recognize", l: "Recognize" }, { k: "recall", l: "Recall" }].map((t) => (
          <button key={t.k}
            onClick={() => { setTab(t.k); reset(); }}
            style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1.5px solid ${tab === t.k ? C.gold : C.border}`, background: tab === t.k ? `${C.gold}18` : C.surface, color: tab === t.k ? C.gold : C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Identity selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {IDS.map((id) => {
          const locked = !isUnlocked(progress, id.id);
          return (
            <button key={id.id}
              disabled={locked}
              onClick={() => { setIid(id.id); reset(); setQIdx(0); setBlankIdx(0); }}
              style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 8, border: `1.5px solid ${iid === id.id ? id.color : C.border}`, background: iid === id.id ? `${id.color}22` : C.surface, color: iid === id.id ? id.color : C.muted, fontSize: 11, fontWeight: 700, cursor: locked ? "default" : "pointer", fontFamily: F, opacity: locked ? 0.35 : 1 }}>
              {id.id}. {id.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Identity blurb */}
      {ident && (
        <div style={{ background: `${ident.color}10`, borderRadius: 12, padding: "13px 15px", marginBottom: 18, border: `1px solid ${ident.color}2a` }}>
          <div style={{ fontSize: 13, color: ident.color, fontWeight: 800, marginBottom: 3 }}>{ident.name}</div>
          <div style={{ fontSize: 12, color: C.text, fontFamily: "monospace", letterSpacing: "-0.02em", marginBottom: 7 }}>{ident.formula}</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, opacity: 0.8 }}>{ident.blurb}</div>
        </div>
      )}

      {/* RECOGNIZE */}
      {tab === "recognize" && q && (
        <div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 700, marginBottom: 14, lineHeight: 1.55 }}>{q.q}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {q.opts.map((opt, i) => {
              const isCorrect = i === q.ans;
              const isSelected = i === selected;
              let bg = C.surface, border = C.border, col = C.text;
              if (submitted && isCorrect) { bg = `${C.mint}20`; border = C.mint; col = C.mint; }
              else if (submitted && isSelected && !isCorrect) { bg = `${C.coral}20`; border = C.coral; col = C.coral; }
              return (
                <div key={i} onClick={() => submitRecognize(i)}
                  style={{ padding: "13px 16px", borderRadius: 13, border: `2px solid ${border}`, background: bg, color: col, fontSize: 13, fontWeight: 600, cursor: submitted ? "default" : "pointer", fontFamily: "monospace", letterSpacing: "-0.01em", transition: "all 0.2s", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{opt}</span>
                  {submitted && isCorrect && <span>✓</span>}
                  {submitted && isSelected && !isCorrect && <span>✗</span>}
                </div>
              );
            })}
          </div>

          {submitted && (
            <div style={{ background: selected === q.ans ? `${C.mint}18` : `${C.coral}15`, borderRadius: 13, padding: "14px 16px", marginBottom: 14, border: `1px solid ${selected === q.ans ? C.mint : C.coral}44` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: selected === q.ans ? C.mint : C.coral, marginBottom: 6 }}>{feedbackMsg}</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{q.exp}</div>
            </div>
          )}

          {submitted && (
            <button onClick={nextQ} style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
              Next Question
            </button>
          )}
        </div>
      )}

      {/* RECALL */}
      {tab === "recall" && blank && (
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Fill in the blank</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text, marginBottom: 16, fontFamily: "monospace", letterSpacing: "-0.02em", lineHeight: 1.4 }}>{blank.t}</div>

          {showHint && (
            <div style={{ background: `${C.gold}14`, borderRadius: 10, padding: "9px 13px", marginBottom: 12, fontSize: 12, color: C.gold, border: `1px solid ${C.gold}30` }}>
              💡 {blank.h}
            </div>
          )}

          {recallResult === null && (
            <>
              <input
                value={recallInput}
                onChange={(e) => setRecallInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && recallInput.trim()) submitRecall(); }}
                placeholder="Type your answer..."
                style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `2px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: "monospace", marginBottom: 10, outline: "none", transition: "border-color 0.2s" }}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.border)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                {!showHint && (
                  <button onClick={() => setShowHint(true)}
                    style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${C.gold}`, background: "transparent", color: C.gold, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: F }}>
                    Hint
                  </button>
                )}
                <button onClick={submitRecall} disabled={!recallInput.trim()}
                  style={{ flex: 2, padding: 13, borderRadius: 12, border: "none", background: recallInput.trim() ? C.gold : C.border, color: recallInput.trim() ? "#0d0c1a" : C.muted, fontWeight: 800, fontSize: 14, cursor: recallInput.trim() ? "pointer" : "default", fontFamily: F }}>
                  Check Answer
                </button>
              </div>
            </>
          )}

          {recallResult && (
            <div>
              <div style={{ background: recallResult === "correct" ? `${C.mint}20` : `${C.coral}18`, borderRadius: 13, padding: "14px 16px", marginBottom: 14, border: `1px solid ${recallResult === "correct" ? C.mint : C.coral}44` }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: recallResult === "correct" ? C.mint : C.coral, marginBottom: 8 }}>{feedbackMsg}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>The answer:</div>
                <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "monospace", color: C.text }}>{blank.a}</div>
                {recallResult === "wrong" && recallInput && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>You wrote: <span style={{ color: C.coral, fontFamily: "monospace" }}>{recallInput}</span></div>
                )}
              </div>
              <button onClick={nextRecall} style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
                Next Question
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PARENT VIEW ──────────────────────────────────────────────────────────────
function ParentView({ progress, onClose }) {
  const totalC = Object.values(progress.ids).reduce((s, v) => s + v.correct, 0);
  const totalS = Object.values(progress.ids).reduce((s, v) => s + v.seen, 0);
  const acc = totalS > 0 ? Math.round((totalC / totalS) * 100) : 0;
  const mastered = Object.values(progress.ids).filter((v) => v.mastered).length;
  const bestSpeed = progress.speedBests.length > 0 ? Math.min(...progress.speedBests.map((s) => s.time)) : null;

  const encouragement = (() => {
    if (progress.sessions === 0) return "No sessions yet — share this app and let them know you're rooting for them.";
    if (progress.sessions === 1) return "First session done. That's the hardest step. Tell them you noticed.";
    if (mastered > 0) return `They've mastered ${mastered} identit${mastered > 1 ? "ies" : "y"} — that's real, lasting knowledge. Let them know you see it.`;
    return `${progress.sessions} sessions in. They're building the foundation right now. A little encouragement goes a long way.`;
  })();

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", padding: "4px 8px" }}>←</button>
        <div style={{ fontSize: 22, fontFamily: FD, fontWeight: 800, color: C.text }}>Progress Summary</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {[{ l: "Sessions", v: progress.sessions, c: C.gold }, { l: "Accuracy", v: `${acc}%`, c: C.mint }, { l: "Mastered", v: `${mastered}/5`, c: C.purple }, { l: "Explore Rounds", v: progress.exploreRounds, c: C.teal }].map((s) => (
          <div key={s.l} style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Identity by Identity</div>
        {IDS.map((id) => {
          const p = progress.ids[id.id];
          const locked = !isUnlocked(progress, id.id);
          const iAcc = p.seen > 0 ? Math.round((p.correct / p.seen) * 100) : null;
          return (
            <div key={id.id} style={{ background: C.surface, borderRadius: 13, padding: "14px", marginBottom: 8, border: `1px solid ${C.border}`, opacity: locked ? 0.45 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: locked ? C.muted : C.text }}>{id.name} {p.mastered ? "⭐" : ""}</div>
                {locked && <div style={{ fontSize: 11, color: C.muted, background: C.border, borderRadius: 6, padding: "2px 8px" }}>Locked</div>}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 8, opacity: 0.8 }}>{id.formula}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                <span style={{ color: C.muted }}>Seen: <b style={{ color: C.text }}>{p.seen}</b></span>
                <span style={{ color: C.muted }}>Correct: <b style={{ color: C.mint }}>{p.correct}</b></span>
                {iAcc != null && <span style={{ color: C.muted }}>Accuracy: <b style={{ color: id.color }}>{iAcc}%</b></span>}
                <span style={{ color: C.muted }}>Streak: <b style={{ color: C.gold }}>{p.streak}</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {progress.speedBests.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Speed Round History</div>
          <div style={{ background: C.surface, borderRadius: 13, padding: 14, border: `1px solid ${C.border}` }}>
            {progress.speedBests.slice(-6).reverse().map((s, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
                <span style={{ color: C.muted }}>Round {progress.speedBests.length - i}</span>
                <span style={{ fontWeight: 700, color: s.time === bestSpeed ? C.gold : C.text }}>
                  {s.time.toFixed(1)}s {s.time === bestSpeed ? "🏆" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: `${C.gold}12`, borderRadius: 14, padding: "16px 18px", border: `1px solid ${C.gold}28` }}>
        <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, marginBottom: 6 }}>For you, parent 💛</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{encouragement}</div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState("home");
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProgress(loadP() || defP());
    setLoading(false);
  }, []);

  const updateProgress = useCallback((updater) => {
    setProgress((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveP(next);
      return next;
    });
  }, []);

  // Count sessions (once per app load)
  const sessionCountedRef = useRef(false);
  useEffect(() => {
    if (progress && !sessionCountedRef.current) {
      sessionCountedRef.current = true;
      updateProgress((p) => ({ ...p, sessions: p.sessions + 1, lastSession: new Date().toISOString() }));
    }
  }, [progress, updateProgress]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.muted, fontFamily: F, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Sora:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        button:active { opacity: 0.82; }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: #4a4770; }
      `}</style>

      {/* Header */}
      {screen !== "parent" && (
        <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 17, color: C.gold, letterSpacing: "-0.02em" }}>TrigSense</div>
          <button onClick={() => setScreen("parent")} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: F, fontWeight: 600, padding: "4px 8px" }}>
            Parent View
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ paddingBottom: 80 }}>
        {screen === "home" && <HomeScreen progress={progress} onNav={setScreen} />}
        {screen === "explore" && <ExploreMode progress={progress} onUpdate={updateProgress} />}
        {screen === "practice" && <PracticeMode progress={progress} onUpdate={updateProgress} />}
        {screen === "parent" && <ParentView progress={progress} onClose={() => setScreen("home")} />}
      </div>

      {/* Bottom nav */}
      {screen !== "parent" && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", padding: "10px 0 12px" }}>
          {[{ k: "home", icon: "⌂", l: "Home" }, { k: "explore", icon: "◎", l: "Explore" }, { k: "practice", icon: "◈", l: "Practice" }].map((n) => (
            <button key={n.k} onClick={() => setScreen(n.k)}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "6px 0", fontFamily: F }}>
              <div style={{ fontSize: 22, marginBottom: 2, opacity: screen === n.k ? 1 : 0.4 }}>{n.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: screen === n.k ? C.gold : C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{n.l}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
