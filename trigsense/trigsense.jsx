const { useState, useEffect, useRef, useCallback, useMemo } = React;

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
    hook: "Height squared plus width squared — always one. The circle never lies.",
    blanks: [
      { t: "sin²(x) + ___ = 1", a: "cos²(x)", h: "The width squared — the x-direction" },
      { t: "___ + cos²(x) = 1", a: "sin²(x)", h: "The height squared — the y-direction" },
    ],
  },
  {
    id: 2, name: "Tangent", color: C.mint,
    formula: "tan(x) = sin(x) / cos(x)",
    blurb: "Tangent is height divided by width — sin over cos. It's the slope of the line from the center to the point.",
    hook: "Tangent is sin on top, cos on bottom. Height over width.",
    blanks: [
      { t: "tan(x) = ___ / cos(x)", a: "sin(x)", h: "The top — height = y-coordinate" },
      { t: "tan(x) = sin(x) / ___", a: "cos(x)", h: "The bottom — width = x-coordinate" },
    ],
  },
  {
    id: 3, name: "Unit Circle Basics", color: C.teal,
    formula: "cos = x-coordinate  ·  sin = y-coordinate",
    blurb: "Every point on the unit circle sits at exactly (cos θ, sin θ). Negative angles just go clockwise instead of counterclockwise.",
    hook: "X is cos, Y is sin. Right is positive, up is positive.",
    blanks: [
      { t: "x-coordinate = ___", a: "cos(x)", h: "Left-right on the circle" },
      { t: "y-coordinate = ___", a: "sin(x)", h: "Up-down on the circle" },
    ],
  },
  {
    id: 4, name: "Sin Addition", color: C.purple,
    formula: "sin(x+y) = sin(x)cos(y) + sin(y)cos(x)",
    blurb: "Adding angles for sin: it crosses — sin×cos plus sin×cos — with x and y swapped between the two terms.",
    hook: "Cross pattern — sin×cos, plus sin×cos. Swap the letters between the two terms.",
    blanks: [
      { t: "sin(x+y) = sin(x)cos(y) + ___", a: "sin(y)cos(x)", h: "Mirror the first term — swap x and y" },
    ],
  },
  {
    id: 5, name: "Cos Addition", color: C.coral,
    formula: "cos(x+y) = cos(x)cos(y) − sin(x)sin(y)",
    blurb: "Cosine addition: cos×cos minus sin×sin. That minus sign is the key detail that sets it apart from sin addition.",
    hook: "Same-same minus different-different. Cos×cos minus sin×sin.",
    blanks: [
      { t: "cos(x+y) = ___ − sin(x)sin(y)", a: "cos(x)cos(y)", h: "Cos times cos — same function, both angles" },
    ],
  },
];

const QS = [
  // ── Identity 1: sin²(x) + cos²(x) = 1 ─────────────────────────────────────
  { id: "q1a", iid: 1, q: "Which formula is always true for any angle?",
    opts: ["sin²(x) + cos²(x) = 1", "sin(x) + cos(x) = 1", "sin²(x) − cos²(x) = 1", "sin(x) = cos(x)"],
    ans: 0, exp: "The squares always add to 1 — it comes from the circle's radius being 1." },
  { id: "q1b", iid: 1, q: "sin²(x) + cos²(x) = ?",
    opts: ["it depends on the angle", "0", "1", "2"],
    ans: 2, exp: "Always exactly 1. Every angle, no exceptions." },
  { id: "q1c", iid: 1, q: "If sin(x) = 0.6, what is cos²(x)?",
    opts: ["0.36", "0.64", "0.6", "0.4"],
    ans: 1, exp: "cos²(x) = 1 − sin²(x) = 1 − 0.36 = 0.64." },
  { id: "q1d", iid: 1, q: "If cos(x) = 0.8 and x is in Quadrant I, what is sin(x)?",
    opts: ["0.4", "0.36", "0.6", "0.64"],
    ans: 2, exp: "sin²(x) = 1 − 0.64 = 0.36, so sin(x) = ±0.6. In Q1, sin is positive — so 0.6." },
  { id: "q1e", iid: 1, q: "Which expression equals 1 for every angle?",
    opts: ["sin(x) · cos(x)", "sin(x) + cos(x)", "sin²(x) − cos²(x)", "sin²(x) + cos²(x)"],
    ans: 3, exp: "Only the sum of the squares is the constant identity." },
  { id: "q1f", iid: 1, q: "1 − cos²(x) simplifies to:",
    opts: ["sin²(x)", "cos²(x)", "1 − sin²(x)", "tan²(x)"],
    ans: 0, exp: "Rearranging the identity: sin²(x) = 1 − cos²(x)." },
  { id: "q1g", iid: 1, q: "1 − sin²(x) simplifies to:",
    opts: ["1", "tan²(x)", "sin(x)·cos(x)", "cos²(x)"],
    ans: 3, exp: "Rearranging the identity: cos²(x) = 1 − sin²(x)." },
  { id: "q1h", iid: 1, q: "If sin(x) = 0, what is cos²(x)?",
    opts: ["0", "0.5", "1", "undefined"],
    ans: 2, exp: "0² + cos²(x) = 1, so cos²(x) = 1." },
  { id: "q1i", iid: 1, q: "If cos²(x) = 0.25, what is sin²(x)?",
    opts: ["0.5", "0.75", "0.25", "1.25"],
    ans: 1, exp: "sin² = 1 − cos² = 1 − 0.25 = 0.75." },
  { id: "q1j", iid: 1, q: "sin²(45°) + cos²(45°) = ?",
    opts: ["√2", "0.5", "1", "2"],
    ans: 2, exp: "Always 1 — even at 45° where sin = cos = √2/2 ≈ 0.707, the squares add to 1." },
  { id: "q1k", iid: 1, q: "If sin(x) = −0.5, what is cos²(x)?",
    opts: ["−0.75", "0.25", "0.5", "0.75"],
    ans: 3, exp: "cos² = 1 − (−0.5)² = 1 − 0.25 = 0.75. The sign of sin doesn't matter when squared." },
  { id: "q1l", iid: 1, q: "Why does this identity work? Because the unit circle has:",
    opts: ["a center at the origin", "an angle of 360°", "a radius of 1", "a circumference of 2π"],
    ans: 2, exp: "Radius 1 means x² + y² = 1, and on the circle (x, y) = (cos, sin)." },
  { id: "q1m", iid: 1, q: "Which is NOT always true?",
    opts: ["sin²(x) + cos²(x) = 1", "sin(0) = 0", "sin(x) + cos(x) = 1", "cos(0) = 1"],
    ans: 2, exp: "sin + cos = 1 only at certain angles — not always. The squared version is always true." },
  { id: "q1n", iid: 1, q: "If sin²(x) = 0.49, what is cos²(x)?",
    opts: ["0.49", "0.51", "0.7", "0.3"],
    ans: 1, exp: "1 − 0.49 = 0.51." },
  { id: "q1o", iid: 1, q: "The identity sin² + cos² = 1 is also called the:",
    opts: ["Quadratic identity", "Pythagorean identity", "Linear identity", "Reciprocal identity"],
    ans: 1, exp: "It's the unit circle's version of the Pythagorean theorem (a² + b² = c²)." },
  { id: "q1p", iid: 1, q: "If cos(x) = 0, what is sin²(x)?",
    opts: ["0", "0.5", "1", "undefined"],
    ans: 2, exp: "sin² + 0 = 1, so sin² = 1 (and sin = ±1)." },

  // ── Identity 2: tan(x) = sin(x) / cos(x) ──────────────────────────────────
  { id: "q2a", iid: 2, q: "tan(x) is equal to:",
    opts: ["sin(x) × cos(x)", "cos(x) / sin(x)", "1 / cos(x)", "sin(x) / cos(x)"],
    ans: 3, exp: "Tangent = sin ÷ cos. Height over width." },
  { id: "q2b", iid: 2, q: "If sin(x) = 0.5 and cos(x) = 0.87, then tan(x) ≈",
    opts: ["0.13", "0.57", "1.74", "0.44"],
    ans: 1, exp: "0.5 ÷ 0.87 ≈ 0.57." },
  { id: "q2c", iid: 2, q: "tan(0°) = ?",
    opts: ["0", "1", "undefined", "−1"],
    ans: 0, exp: "tan(0°) = sin(0°) / cos(0°) = 0 / 1 = 0." },
  { id: "q2d", iid: 2, q: "tan(45°) = ?",
    opts: ["0", "0.5", "1", "√2"],
    ans: 2, exp: "At 45°, sin = cos, so their ratio is exactly 1." },
  { id: "q2e", iid: 2, q: "tan(90°) is:",
    opts: ["1", "0", "infinite", "undefined"],
    ans: 3, exp: "cos(90°) = 0, so we'd be dividing by zero. Tangent is undefined at 90°." },
  { id: "q2f", iid: 2, q: "If sin(x) = 0.4 and cos(x) = 0.9, tan(x) ≈",
    opts: ["0.36", "0.44", "2.25", "1.3"],
    ans: 1, exp: "0.4 ÷ 0.9 ≈ 0.44." },
  { id: "q2g", iid: 2, q: "If sin(x) = −0.6 and cos(x) = 0.8, tan(x) =",
    opts: ["−0.75", "0.75", "−1.33", "0.48"],
    ans: 0, exp: "(−0.6) ÷ 0.8 = −0.75. The sign comes from the numerator." },
  { id: "q2h", iid: 2, q: "Tangent is undefined wherever:",
    opts: ["sin = 0", "cos = 0", "sin = cos", "the angle is negative"],
    ans: 1, exp: "Dividing by zero is undefined, and tan = sin/cos." },
  { id: "q2i", iid: 2, q: "tan(x) is positive in which quadrants?",
    opts: ["Q1 only", "Q1 and Q2", "Q1 and Q3", "all four"],
    ans: 2, exp: "In Q1 both sin and cos are positive. In Q3 both are negative — and negative/negative is positive." },
  { id: "q2j", iid: 2, q: "Geometrically, tan(x) on the unit circle is the:",
    opts: ["radius of the circle", "x-coordinate", "slope of the line from origin to the point", "angle in radians"],
    ans: 2, exp: "Slope = rise / run = y / x = sin / cos = tan." },
  { id: "q2k", iid: 2, q: "If tan(x) = 1, the angle could be:",
    opts: ["0°", "30°", "45°", "60°"],
    ans: 2, exp: "tan(45°) = 1, since sin = cos there." },
  { id: "q2l", iid: 2, q: "If you know sin and cos, you find tan by:",
    opts: ["adding them", "subtracting cos from sin", "multiplying them", "dividing sin by cos"],
    ans: 3, exp: "tan = sin / cos. Always." },
  { id: "q2m", iid: 2, q: "If tan(x) is very large (like 10), then:",
    opts: ["sin is much bigger than cos", "cos is much bigger than sin", "they are about equal", "both are negative"],
    ans: 0, exp: "Big tan = sin/cos is big, meaning sin >> cos — the point is near the top of the circle." },
  { id: "q2n", iid: 2, q: "tan(180°) = ?",
    opts: ["0", "−1", "1", "undefined"],
    ans: 0, exp: "sin(180°) = 0, cos(180°) = −1, so tan = 0 / −1 = 0." },

  // ── Identity 3: Unit Circle Basics (cos = x, sin = y) ─────────────────────
  { id: "q3a", iid: 3, q: "On the unit circle, sin(x) represents the:",
    opts: ["radius", "x-coordinate", "y-coordinate", "angle in degrees"],
    ans: 2, exp: "Sin = height = y-coordinate. Cos = width = x-coordinate." },
  { id: "q3b", iid: 3, q: "A point on the circle is at (−0.7, 0.71). What is cos(x)?",
    opts: ["0.71", "−0.71", "−0.7", "0.7"],
    ans: 2, exp: "Cos is always the x-coordinate — the left/right value." },
  { id: "q3c", iid: 3, q: "On the unit circle, cos(x) represents the:",
    opts: ["x-coordinate", "y-coordinate", "radius", "diameter"],
    ans: 0, exp: "Cos = horizontal position." },
  { id: "q3d", iid: 3, q: "The unit circle has radius:",
    opts: ["π", "1", "2", "0"],
    ans: 1, exp: "Hence the name 'unit' — radius 1." },
  { id: "q3e", iid: 3, q: "At angle 0°, the point on the unit circle is at:",
    opts: ["(0, 1)", "(−1, 0)", "(0, 0)", "(1, 0)"],
    ans: 3, exp: "Starting position: rightmost point. cos(0)=1, sin(0)=0." },
  { id: "q3f", iid: 3, q: "At angle 90°, the point is at:",
    opts: ["(0, 1)", "(1, 0)", "(0, −1)", "(−1, 0)"],
    ans: 0, exp: "A quarter turn counter-clockwise puts you at the top. cos(90°)=0, sin(90°)=1." },
  { id: "q3g", iid: 3, q: "At angle 180°, the point is at:",
    opts: ["(0, 1)", "(0, −1)", "(−1, 0)", "(1, 0)"],
    ans: 2, exp: "Half turn — you're at the leftmost point." },
  { id: "q3h", iid: 3, q: "At angle 270°, the point is at:",
    opts: ["(−1, 0)", "(0, −1)", "(1, 0)", "(0, 1)"],
    ans: 1, exp: "Three quarters around — bottom of the circle." },
  { id: "q3i", iid: 3, q: "In Quadrant II (top-left), sin and cos are:",
    opts: ["both positive", "both negative", "sin positive, cos negative", "sin negative, cos positive"],
    ans: 2, exp: "Top half = sin positive. Left half = cos negative." },
  { id: "q3j", iid: 3, q: "In Quadrant III (bottom-left), sin and cos are:",
    opts: ["both negative", "both positive", "sin negative, cos positive", "sin positive, cos negative"],
    ans: 0, exp: "Below center = sin negative. Left of center = cos negative." },
  { id: "q3k", iid: 3, q: "In Quadrant IV (bottom-right):",
    opts: ["sin negative, cos positive", "both negative", "sin positive, cos negative", "both positive"],
    ans: 0, exp: "Below center = sin negative. Right of center = cos positive." },
  { id: "q3l", iid: 3, q: "Negative angles go:",
    opts: ["counter-clockwise", "off the circle", "clockwise", "stay in place"],
    ans: 2, exp: "Positive angles go counter-clockwise; negative angles go clockwise." },
  { id: "q3m", iid: 3, q: "At 45°, sin and cos are both approximately:",
    opts: ["0.5", "1", "0.707", "0.866"],
    ans: 2, exp: "At 45°, sin = cos = √2/2 ≈ 0.707." },
  { id: "q3n", iid: 3, q: "After a full 360° rotation, the point returns to:",
    opts: ["(0, 0)", "(1, 0)", "(0, 1)", "(−1, 0)"],
    ans: 1, exp: "One complete loop ends where it started — at (1, 0)." },
  { id: "q3o", iid: 3, q: "If a point is at (0.866, 0.5) on the unit circle, the angle is:",
    opts: ["60°", "30°", "45°", "90°"],
    ans: 1, exp: "30°: cos(30°) = √3/2 ≈ 0.866, sin(30°) = 0.5." },

  // ── Identity 4: sin(x+y) = sin(x)cos(y) + sin(y)cos(x) ────────────────────
  { id: "q4a", iid: 4, q: "sin(x + y) equals:",
    opts: ["cos(x)cos(y) − sin(x)sin(y)", "sin(x)cos(y) + sin(y)cos(x)", "sin(x)sin(y) + cos(x)cos(y)", "sin(x)cos(y) − sin(y)cos(x)"],
    ans: 1, exp: "Cross pattern: sin × cos + sin × cos, with x and y swapped between the two terms." },
  { id: "q4b", iid: 4, q: "The sin addition formula has how many terms on the right side?",
    opts: ["1", "2", "3", "4"],
    ans: 1, exp: "Two terms: sin(x)cos(y) and sin(y)cos(x), connected with a +." },
  { id: "q4c", iid: 4, q: "The sign between the two terms in sin(x+y) is:",
    opts: ["−", "+", "×", "÷"],
    ans: 1, exp: "Always +. The minus sign belongs to cos addition." },
  { id: "q4d", iid: 4, q: "sin(30° + 60°) = sin(90°) = ?",
    opts: ["0", "0.5", "0.866", "1"],
    ans: 3, exp: "sin(90°) = 1, the maximum value." },
  { id: "q4e", iid: 4, q: "To find sin(75°) using addition, you could split it as:",
    opts: ["75 = 100 − 25", "75 = 30 + 45", "75 = 60 + 25", "75 = 70 + 5"],
    ans: 1, exp: "30° and 45° are angles you have memorized. 25° isn't standard." },
  { id: "q4f", iid: 4, q: "sin(A + B) = sin(A)cos(B) + ___",
    opts: ["sin(B)cos(A)", "cos(A)cos(B)", "sin(A)sin(B)", "cos(A)sin(B) − sin(B)cos(A)"],
    ans: 0, exp: "Mirror the first term — swap A and B." },
  { id: "q4g", iid: 4, q: "Each term in sin(x+y) contains one sin and one ___",
    opts: ["sin", "tan", "cos", "sec"],
    ans: 2, exp: "Both terms are sin × cos. They differ only in which angle goes inside which function." },
  { id: "q4h", iid: 4, q: "sin(0 + x) using the formula gives:",
    opts: ["sin(x)", "cos(x)", "0", "1"],
    ans: 0, exp: "sin(0)cos(x) + sin(x)cos(0) = 0·cos(x) + sin(x)·1 = sin(x). It checks out." },
  { id: "q4i", iid: 4, q: "sin(45° + 45°) = sin(90°) =",
    opts: ["1", "√2", "0", "0.5"],
    ans: 0, exp: "sin(90°) = 1." },
  { id: "q4j", iid: 4, q: "If x = y, then sin(x + y) = sin(2x). Using the formula, this equals:",
    opts: ["sin²(x)", "2 sin(x) cos(x)", "cos²(x) − sin²(x)", "2 cos²(x)"],
    ans: 1, exp: "sin(x)cos(x) + sin(x)cos(x) = 2 sin(x) cos(x). This is the double-angle formula for sin." },
  { id: "q4k", iid: 4, q: "Why use the sin addition formula?",
    opts: ["to find sin of a single angle", "to find sin of a sum of two known angles", "to convert sin to cos", "to compute tan"],
    ans: 1, exp: "It expands sin(sum) into expressions involving the individual angles you already know." },
  { id: "q4l", iid: 4, q: "The pattern sin(x)cos(y) + cos(x)sin(y) collapses to:",
    opts: ["cos(x + y)", "sin(x − y)", "sin(x + y)", "1"],
    ans: 2, exp: "Recognize the right side of sin addition — it equals sin(x+y)." },
  { id: "q4m", iid: 4, q: "If y = 90°, the formula gives sin(x + 90°) =",
    opts: ["cos(x)", "−cos(x)", "−sin(x)", "sin(x)"],
    ans: 0, exp: "sin(x)·0 + 1·cos(x) = cos(x). So sin(x + 90°) = cos(x)." },
  { id: "q4n", iid: 4, q: "sin(x + y) − sin(y + x) =",
    opts: ["2 sin(x+y)", "0", "sin(0)", "sin(x − y)"],
    ans: 1, exp: "Addition is symmetric — sin(x+y) and sin(y+x) are the same value, so their difference is 0." },

  // ── Identity 5: cos(x+y) = cos(x)cos(y) − sin(x)sin(y) ────────────────────
  { id: "q5a", iid: 5, q: "cos(x + y) equals:",
    opts: ["cos(x)cos(y) + sin(x)sin(y)", "sin(x)cos(y) + sin(y)cos(x)", "cos(x)cos(y) − sin(x)sin(y)", "sin(x)sin(y) − cos(x)cos(y)"],
    ans: 2, exp: "Cos × cos minus sin × sin. The minus sign is the key detail." },
  { id: "q5b", iid: 5, q: "The KEY difference between sin addition and cos addition is:",
    opts: ["the order of terms", "the sign between terms", "the number of terms", "the angles used"],
    ans: 1, exp: "Sin uses +, cos uses −. That sign is what you have to remember." },
  { id: "q5c", iid: 5, q: "The sign between the two terms in cos(x+y) is:",
    opts: ["+", "−", "×", "÷"],
    ans: 1, exp: "Minus. That's the difference from sin addition." },
  { id: "q5d", iid: 5, q: "cos(60° + 30°) = cos(90°) =",
    opts: ["1", "0.5", "0", "−1"],
    ans: 2, exp: "cos(90°) = 0. The point is at the top of the circle, so its x-coordinate is 0." },
  { id: "q5e", iid: 5, q: "cos(0 + x) using the formula:",
    opts: ["sin(x)", "1", "cos(x)", "0"],
    ans: 2, exp: "cos(0)cos(x) − sin(0)sin(x) = 1·cos(x) − 0 = cos(x). It checks out." },
  { id: "q5f", iid: 5, q: "cos(45° + 45°) = cos(90°) =",
    opts: ["√2", "0", "1", "0.5"],
    ans: 1, exp: "cos(90°) = 0." },
  { id: "q5g", iid: 5, q: "Each term in cos(x+y) contains:",
    opts: ["one sin and one cos", "two sins", "two cosines OR two sines (same function)", "always a sin and a tan"],
    ans: 2, exp: "First term is cos × cos. Second term is sin × sin. Same function in each term — unlike sin addition." },
  { id: "q5h", iid: 5, q: "If x = y, then cos(x + y) = cos(2x). Using the formula:",
    opts: ["2 cos(x) sin(x)", "cos²(x) − sin²(x)", "cos²(x) + sin²(x)", "2 cos²(x)"],
    ans: 1, exp: "cos²(x) − sin²(x). This is the double-angle formula for cos." },
  { id: "q5i", iid: 5, q: "To compute cos(105°) using addition, split it as:",
    opts: ["100° + 5°", "60° + 45°", "90° + 15°", "50° + 55°"],
    ans: 1, exp: "60° and 45° are standard reference angles you can compute exactly." },
  { id: "q5j", iid: 5, q: "The pattern cos(x)cos(y) − sin(x)sin(y) collapses to:",
    opts: ["sin(x+y)", "cos(x−y)", "cos(x+y)", "sin(x)cos(y)"],
    ans: 2, exp: "It's the right side of cos addition, read backwards." },
  { id: "q5k", iid: 5, q: "If y = 90°, then cos(x + 90°) =",
    opts: ["sin(x)", "−sin(x)", "cos(x)", "0"],
    ans: 1, exp: "cos(x)·0 − sin(x)·1 = −sin(x)." },
  { id: "q5l", iid: 5, q: "Which is the cos addition formula?",
    opts: ["cos·cos + sin·sin", "sin·cos + cos·sin", "cos·cos − sin·sin", "cos·sin − sin·cos"],
    ans: 2, exp: "cos × cos minus sin × sin. Same function pairs, with a minus." },
  { id: "q5m", iid: 5, q: "Given cos(x+y) = cos(x)cos(y) − sin(x)sin(y), what's cos(x − y)?",
    opts: ["cos(x)cos(y) + sin(x)sin(y)", "cos(x)cos(y) − sin(x)sin(y)", "sin(x)cos(y) − cos(x)sin(y)", "cos(x) − cos(y)"],
    ans: 0, exp: "Replacing y with −y flips the sign on sin(y), turning the minus into a plus. So cos(x−y) = cos(x)cos(y) + sin(x)sin(y)." },
  { id: "q5n", iid: 5, q: "When you remember cos addition, the trick is:",
    opts: ["it has 4 terms", "the same-function pair has a minus sign", "it's identical to sin addition", "it always equals 1"],
    ans: 1, exp: "Same-function products (cos·cos, sin·sin) are subtracted. That's the cos pattern." },
];

const SCENARIOS = [
  {
    id: "s1a", iid: 1,
    scenario: "You know that cos(x) = 0.6 for some angle x, and you need to find sin(x). You don't have a calculator that shows sin directly.",
    why: "When you know one of sin or cos and need the other, sin²+cos²=1 is your tool. Plug in what you know, solve for what you don't.",
    wrong_reasons: {
      2: "Tangent would help if you already knew both sin and cos — here you're missing one of them.",
      4: "The addition formula involves two separate angles. You only have one angle here.",
      5: "Same issue — cos addition needs two angles, not one.",
    },
  },
  {
    id: "s1b", iid: 1,
    scenario: "You're simplifying a long expression and you notice it contains both sin²(x) and cos²(x) added together. You want to make it shorter.",
    why: "Anytime you spot sin² and cos² being added, you can replace the whole thing with 1. That's the whole point of this identity.",
    wrong_reasons: {
      2: "Tangent = sin/cos is useful for division, not for simplifying a sum.",
      4: "The addition formula expands things — you're trying to simplify, not expand.",
    },
  },
  {
    id: "s2a", iid: 2,
    scenario: "A problem gives you sin(x) = 0.5 and cos(x) = 0.87 and asks for tan(x). You've never memorized what tan looks like on the unit circle.",
    why: "tan = sin/cos. When you have both sin and cos already, tangent is just the division. You don't need the unit circle at all.",
    wrong_reasons: {
      1: "sin²+cos²=1 helps you find a missing value — you already have both values here.",
      4: "Addition formulas involve combining two angles. This is just one angle.",
    },
  },
  {
    id: "s2b", iid: 2,
    scenario: "You need to simplify the expression sin(x) / cos(x) to a single trig function.",
    why: "sin divided by cos is exactly the definition of tangent. One substitution and you're done.",
    wrong_reasons: {
      1: "The Pythagorean identity doesn't help with division — it's about squares and sums.",
    },
  },
  {
    id: "s3a", iid: 3,
    scenario: "You're looking at an angle of 150° on a circle and need to figure out whether sin and cos are positive or negative at that point — without a calculator.",
    why: "150° puts you in Quadrant II (between 90° and 180°). In QII, the x-coordinate (cos) is negative and the y-coordinate (sin) is positive. No formula needed — just quadrant knowledge.",
    wrong_reasons: {
      1: "sin²+cos²=1 tells you about magnitude, not sign. For signs, you need quadrant knowledge.",
      4: "You're not adding two angles here — you just need to read the quadrant.",
    },
  },
  {
    id: "s4a", iid: 4,
    scenario: "You need to find the exact value of sin(75°). Your formula sheet only has values for 30°, 45°, and 60°. You notice that 75° = 45° + 30°.",
    why: "When you need the sin of a sum of two angles you DO know, the sin addition formula breaks it into parts you can calculate.",
    wrong_reasons: {
      1: "sin²+cos²=1 doesn't help you find values at specific angles.",
      5: "You need sin of the sum, not cos of the sum. Different formula.",
    },
  },
  {
    id: "s4b", iid: 4,
    scenario: "You see the expression sin(x)cos(y) + cos(x)sin(y) and need to write it as a single trig function.",
    why: "That pattern — sin×cos + cos×sin with swapped variables — is exactly the right side of the sin addition formula. You can collapse it to sin(x+y).",
    wrong_reasons: {
      5: "Cos addition would give you cos×cos minus sin×sin — that's a different pattern.",
    },
  },
  {
    id: "s5a", iid: 5,
    scenario: "You need the exact value of cos(105°). You recognize that 105° = 60° + 45°, and you know the values for both those angles.",
    why: "Cos of a sum of two known angles — that's exactly what the cos addition formula is for. Break it into cos(60°)cos(45°) − sin(60°)sin(45°).",
    wrong_reasons: {
      4: "Sin addition would give you the sin of 105°, not the cos.",
      1: "The Pythagorean identity doesn't help find values at specific angles.",
    },
  },
  {
    id: "s5b", iid: 5,
    scenario: "You see cos(x)cos(y) − sin(x)sin(y) in an expression and need to compress it into one term.",
    why: "That's the right side of the cos addition formula, read backwards. It collapses cleanly to cos(x+y).",
    wrong_reasons: {
      4: "Sin addition produces sin×cos + sin×cos — the signs and functions are different.",
    },
  },
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
  finder: {},
  lab: {
    missile: { attempts: 0, bestAccuracy: 0 },
    noise: { attempts: 0, bestAccuracy: 0 },
    bridge: { attempts: 0, bestAccuracy: 0 },
  },
  _started: false,
});

const STORAGE_KEY = "trigsense_v1";
const saveP = (p) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (_) {}
};
const loadP = () => {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return { ...defP(), ...JSON.parse(r) };
  } catch (_) {}
  return null;
};

const isUnlocked = (p, id) => {
  if (id === 1) return true;
  return p.ids[id - 1]?.correct >= 3;
};

// ─── UNIT CIRCLE ──────────────────────────────────────────────────────────────
function UnitCircle({ angle, onChange, mode = "free" }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const [unit, setUnit] = useState("deg");

  const R = 110, CX = 150, CY = 150;
  const px = CX + R * Math.cos(angle);
  const py = CY - R * Math.sin(angle);
  const sinV = +Math.sin(angle).toFixed(3);
  const cosV = +Math.cos(angle).toFixed(3);
  const wholeMode = mode === "free";
  const sinDisp = wholeMode ? Math.round(Math.sin(angle) * 100) : sinV;
  const cosDisp = wholeMode ? Math.round(Math.cos(angle) * 100) : cosV;

  const getAngle = useCallback((e) => {
    const s = svgRef.current;
    if (!s) return angle;
    const rect = s.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 300 - CX;
    const y = ((e.clientY - rect.top) / rect.height) * 300 - CY;
    return Math.atan2(-y, x);
  }, [angle]);

  const snap = (a) => mode === "free" ? Math.round((a * 180) / Math.PI) * Math.PI / 180 : a;

  const onDown = (e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(snap(getAngle(e)));
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    onChange(snap(getAngle(e)));
  };
  const onUp = () => { dragging.current = false; };

  const deg = Math.round(((angle * 180) / Math.PI + 360) % 360);
  const radNorm = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const angleStr = unit === "deg" ? `${deg}°` : radNorm.toFixed(2);

  return (
    <div>
      <div style={{ position: "relative", maxWidth: 320, margin: "0 auto" }}>
        <div style={{ position: "absolute", top: 0, right: 4, display: "flex", gap: 4, zIndex: 2 }}>
          {[{ k: "deg", l: "DEG" }, { k: "rad", l: "RAD" }].map((u) => (
            <button key={u.k} onClick={() => setUnit(u.k)}
              style={{ padding: "3px 9px", borderRadius: 999, border: `1px solid ${unit === u.k ? C.gold : C.border}`, background: unit === u.k ? `${C.gold}20` : "transparent", color: unit === u.k ? C.gold : C.muted, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: F, letterSpacing: "0.06em" }}>
              {u.l}
            </button>
          ))}
        </div>
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
          <clipPath id="circleClip">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
        </defs>
        <circle cx={CX} cy={CY} r={125} fill="url(#bgGlow)" />

        {/* Quadrant tints */}
        <g clipPath="url(#circleClip)" opacity="0.09">
          <path d={`M${CX},${CY} L${CX + R},${CY} A${R},${R} 0 0 0 ${CX},${CY - R} Z`} fill={C.gold} />
          <path d={`M${CX},${CY} L${CX},${CY - R} A${R},${R} 0 0 0 ${CX - R},${CY} Z`} fill={C.teal} />
          <path d={`M${CX},${CY} L${CX - R},${CY} A${R},${R} 0 0 0 ${CX},${CY + R} Z`} fill={C.coral} />
          <path d={`M${CX},${CY} L${CX},${CY + R} A${R},${R} 0 0 0 ${CX + R},${CY} Z`} fill={C.purple} />
        </g>

        {/* Axes */}
        <line x1="18" y1="150" x2="282" y2="150" stroke={C.border} strokeWidth="1.5" />
        <line x1="150" y1="18" x2="150" y2="282" stroke={C.border} strokeWidth="1.5" />

        {/* Circle */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#302c55" strokeWidth="2" />

        {/* Quadrant labels */}
        {[
          { angle: 45, num: "I", color: C.gold, signs: "sin + / cos +" },
          { angle: 135, num: "II", color: C.teal, signs: "sin + / cos −" },
          { angle: 225, num: "III", color: C.coral, signs: "sin − / cos −" },
          { angle: 315, num: "IV", color: C.purple, signs: "sin − / cos +" },
        ].map(({ angle, num, color, signs }) => {
          const a = (angle * Math.PI) / 180;
          const x = CX + 60 * Math.cos(a);
          const y = CY - 60 * Math.sin(a);
          return (
            <g key={num} style={{ pointerEvents: "none" }}>
              <text x={x} y={y - 5} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="13" fontFamily={FD} fontWeight="800" opacity="0.4">{num}</text>
              <text x={x} y={y + 9} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="7" fontFamily={F} fontWeight="600" opacity="0.55">{signs}</text>
            </g>
          );
        })}

        {/* 30° tick marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return <line key={i}
            x1={CX + (R - 7) * Math.cos(a)} y1={CY - (R - 7) * Math.sin(a)}
            x2={CX + R * Math.cos(a)} y2={CY - R * Math.sin(a)}
            stroke="#3a3660" strokeWidth="1.5" />;
        })}

        {/* Anchor points: cardinal angle + coordinates */}
        {[
          { d: 0, deg: "0°", rad: "0", coord: "(1, 0)", dx: 22, dy: 0 },
          { d: 90, deg: "90°", rad: "π/2", coord: "(0, 1)", dx: 0, dy: -16 },
          { d: 180, deg: "180°", rad: "π", coord: "(−1, 0)", dx: -26, dy: 0 },
          { d: 270, deg: "270°", rad: "3π/2", coord: "(0, −1)", dx: 0, dy: 16 },
        ].map(({ d, deg: degL, rad: radL, coord, dx, dy }) => {
          const a = (d * Math.PI) / 180;
          const dotX = CX + R * Math.cos(a);
          const dotY = CY - R * Math.sin(a);
          const aLabel = unit === "deg" ? degL : radL;
          return (
            <g key={d} style={{ pointerEvents: "none" }}>
              <circle cx={dotX} cy={dotY} r={2.5} fill={C.muted} />
              <text x={dotX + dx} y={dotY + dy - 5} textAnchor="middle" dominantBaseline="middle"
                fill={C.text} fontSize="8.5" fontFamily={F} fontWeight="700" opacity="0.85">{aLabel}</text>
              <text x={dotX + dx} y={dotY + dy + 5} textAnchor="middle" dominantBaseline="middle"
                fill={C.muted} fontSize="7.5" fontFamily={F} fontWeight="600">{coord}</text>
            </g>
          );
        })}

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
        <text x={(CX + px) / 2} y={CY - 9} textAnchor="middle" fill={C.teal} fontSize="9.5" fontFamily={F} fontWeight="700">cos={cosDisp}</text>
        {Math.abs(sinV) > 0.08 && (
          <text
            x={cosV >= 0 ? px + 12 : px - 12}
            y={(CY + py) / 2}
            textAnchor={cosV >= 0 ? "start" : "end"}
            dominantBaseline="middle"
            fill={C.mint} fontSize="9.5" fontFamily={F} fontWeight="700">sin={sinDisp}</text>
        )}
      </svg>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10, fontFamily: F, fontSize: 13 }}>
        <span style={{ color: C.teal, fontWeight: 700 }}>cos = {cosDisp}</span>
        <span style={{ color: C.muted }}>·</span>
        <span style={{ color: C.mint, fontWeight: 700 }}>sin = {sinDisp}</span>
        <span style={{ color: C.muted }}>·</span>
        <span style={{ color: C.gold, fontWeight: 700 }}>{angleStr}</span>
      </div>
      {wholeMode && (
        <div style={{ textAlign: "center", marginTop: 4, fontFamily: F, fontSize: 10, color: C.muted, opacity: 0.75 }}>
          shown out of 100 (radius = 100)
        </div>
      )}

      {(() => {
        const q = deg < 90 ? { num: "I", color: C.gold, msg: "sin and cos are both positive" }
          : deg < 180 ? { num: "II", color: C.teal, msg: "sin is positive, cos is negative" }
          : deg < 270 ? { num: "III", color: C.coral, msg: "sin and cos are both negative" }
          : { num: "IV", color: C.purple, msg: "sin is negative, cos is positive" };
        return (
          <div style={{ textAlign: "center", marginTop: 8, fontFamily: F, fontSize: 12, color: q.color, fontWeight: 600 }}>
            Quadrant {q.num} — {q.msg}
          </div>
        );
      })()}
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ progress, onNav }) {
  const totalCorrect = Object.values(progress.ids).reduce((s, v) => s + v.correct, 0);
  const mastered = Object.values(progress.ids).filter((v) => v.mastered).length;

  const finderTried = Object.keys(progress.finder || {}).length > 0;
  const suggestion = (() => {
    if (progress.sessions <= 1) return { mode: "explore", label: "Start with the unit circle →", sub: "Build your intuition first — no pressure" };
    if (totalCorrect < 3) return { mode: "explore", label: "Keep exploring →", sub: "Drag the circle, see sin and cos in action" };
    if (progress.ids[1].correct < 3) return { mode: "practice", label: "Try your first identity →", sub: "sin²(x) + cos²(x) = 1" };
    if (progress.sessions > 2 && totalCorrect >= 5 && !finderTried) return { mode: "finder", label: "Try Formula Finder →", sub: "Pick the right tool for the problem" };
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
        {[{ k: "explore", icon: "◎", l: "Explore", sub: "Interactive unit circle" }, { k: "finder", icon: "⊕", l: "Finder", sub: "Pick the right formula" }, { k: "practice", icon: "◈", l: "Practice", sub: "Quizzes & fill-in-the-blank" }].map((m) => (
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
  const [angle, setAngle] = useState(Math.PI / 6);
  const [challenge, setChallenge] = useState(null);
  const [matched, setMatched] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [tryAgain, setTryAgain] = useState("");

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
    setMatched(false);
    setFeedback("");
    setTryAgain("");
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

  const submitGuess = useCallback(() => {
    if (!challenge) return;
    const userVal = challenge.type === "sin" ? Math.sin(angle) : Math.cos(angle);
    const absDiff = Math.abs(userVal - challenge.val);
    if (absDiff < 0.05) {
      setTryAgain("");
      handleMatch();
      return;
    }
    const targetPos = challenge.val > 0.05;
    const targetNeg = challenge.val < -0.05;
    const userPos = userVal > 0.05;
    const userNeg = userVal < -0.05;
    const signMismatch = (targetPos && userNeg) || (targetNeg && userPos);

    let hint;
    if (signMismatch) {
      if (challenge.type === "sin") {
        hint = targetPos
          ? "Sin is the height of the point above the center. A positive sin lives in the top half — Quadrants I and II. Where is your point sitting?"
          : "Sin is the height. A negative sin means the point sits below the center — the bottom half (Quadrants III and IV). Where is yours?";
      } else {
        hint = targetPos
          ? "Cos is how far right or left the point is. A positive cos lives in the right half — Quadrants I and IV. Which side are you on?"
          : "Cos is how far right or left the point is. A negative cos lives in the left half — Quadrants II and III. Which side are you on?";
      }
    } else if (absDiff > 0.3) {
      hint = challenge.type === "sin"
        ? "Right half of the circle. Now think about how extreme: sin near ±1 sits near the very top or bottom; sin near 0 sits out by the sides. How extreme is your target?"
        : "Right side of the circle. Now think about how extreme: cos near ±1 sits at the far right or far left; cos near 0 sits up at the top or down at the bottom. How extreme is your target?";
    } else {
      hint = "You're in the right neighborhood — just a small adjustment along the circle.";
    }
    setTryAgain(hint);
  }, [challenge, angle, handleMatch]);

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
        />
      </div>

      {/* Bottom panel */}
      {sub === "free" && (
        <div style={{ background: C.surface, borderRadius: 14, padding: "16px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.gold, fontWeight: 700, marginBottom: 8 }}>How to read this circle</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>
            Drag the point around. The <span style={{ color: C.teal, fontWeight: 700 }}>teal line</span> is cos — how far left or right. The <span style={{ color: C.mint, fontWeight: 700 }}>green line</span> is sin — how far up or down. The numbers show distance out of 100 (so the circle has radius 100). Try finding where sin = 0, where cos = −100, and where they're equal.
          </div>
        </div>
      )}

      {sub === "find" && matched && (
        <button onClick={genChallenge} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
          Next Challenge →
        </button>
      )}

      {(sub === "find" || sub === "speed") && !matched && !speedDone && challenge && (
        <div>
          {tryAgain && (
            <div style={{ background: `${C.coral}15`, borderRadius: 12, padding: "11px 14px", marginBottom: 10, border: `1px solid ${C.coral}44`, fontSize: 13, color: C.coral, fontWeight: 600 }}>
              {tryAgain}
            </div>
          )}
          <button onClick={submitGuess}
            style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
            Submit my guess
          </button>
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
  const [studying, setStudying] = useState(true);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  const ident = IDS.find((i) => i.id === iid);
  const availQs = useMemo(() => {
    const arr = QS.filter((item) => item.iid === iid);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [iid]);
  const baseQ = availQs[qIdx % Math.max(availQs.length, 1)];
  const q = useMemo(() => {
    if (!baseQ) return null;
    const order = baseQ.opts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return { ...baseQ, opts: order.map((i) => baseQ.opts[i]), ans: order.indexOf(baseQ.ans) };
  }, [baseQ?.id]);
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
              onClick={() => { setIid(id.id); reset(); setQIdx(0); setBlankIdx(0); setStudying(true); }}
              style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 8, border: `1.5px solid ${iid === id.id ? id.color : C.border}`, background: iid === id.id ? `${id.color}22` : C.surface, color: iid === id.id ? id.color : C.muted, fontSize: 11, fontWeight: 700, cursor: locked ? "default" : "pointer", fontFamily: F, opacity: locked ? 0.35 : 1 }}>
              {id.id}. {id.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Study mode: blurb + memory hook + ready button */}
      {studying && ident && (
        <div>
          <div style={{ background: `${ident.color}10`, borderRadius: 12, padding: "16px 16px", marginBottom: 12, border: `1px solid ${ident.color}2a` }}>
            <div style={{ fontSize: 11, color: ident.color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Study</div>
            <div style={{ fontSize: 14, color: ident.color, fontWeight: 800, marginBottom: 6 }}>{ident.name}</div>
            <div style={{ fontSize: 13, color: C.text, fontFamily: "monospace", letterSpacing: "-0.02em", marginBottom: 10 }}>{ident.formula}</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, opacity: 0.88 }}>{ident.blurb}</div>
          </div>
          {ident.hook && (
            <div style={{ background: `${C.gold}10`, borderRadius: 12, padding: "13px 16px", marginBottom: 14, border: `1px dashed ${C.gold}55` }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, opacity: 0.85 }}>Say this out loud:</div>
              <div style={{ fontSize: 14, color: C.gold, fontStyle: "italic", lineHeight: 1.55, opacity: 0.85, fontWeight: 600 }}>"{ident.hook}"</div>
            </div>
          )}
          <button onClick={() => { reset(); setStudying(false); }}
            style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
            I'm ready — quiz me
          </button>
        </div>
      )}

      {/* Quiz mode: review-formula link */}
      {!studying && ident && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={() => setShowFormulaModal(true)}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: F, textDecoration: "underline", padding: "4px 2px" }}>
            Review formula
          </button>
        </div>
      )}

      {/* RECOGNIZE */}
      {!studying && tab === "recognize" && q && (
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
      {!studying && tab === "recall" && blank && (
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

      {/* Formula review modal */}
      {showFormulaModal && ident && (
        <div onClick={() => setShowFormulaModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(13,12,26,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 16, padding: "20px 20px 18px", maxWidth: 360, width: "100%", border: `1.5px solid ${ident.color}`, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 11, color: ident.color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, fontFamily: F }}>Review</div>
            <div style={{ fontSize: 15, color: ident.color, fontWeight: 800, marginBottom: 8, fontFamily: F }}>{ident.name}</div>
            <div style={{ fontSize: 14, color: C.text, fontFamily: "monospace", letterSpacing: "-0.02em", marginBottom: 12 }}>{ident.formula}</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, opacity: 0.88, marginBottom: 16, fontFamily: F }}>{ident.blurb}</div>
            <button onClick={() => setShowFormulaModal(false)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: F }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FORMULA FINDER ───────────────────────────────────────────────────────────
function FormulaFinder({ progress, onUpdate }) {
  const available = SCENARIOS.filter((s) => isUnlocked(progress, s.iid));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const scenario = available.length > 0 ? available[idx % available.length] : null;

  const submit = (chosenIid) => {
    if (submitted || !scenario) return;
    setSelected(chosenIid);
    setSubmitted(true);
    const correct = chosenIid === scenario.iid;
    setFeedbackMsg(correct ? rand(PRAISE) : rand(NEAR));
    onUpdate((p) => {
      const prev = (p.finder || {})[scenario.id] || { seen: 0, correct: 0 };
      return { ...p, finder: { ...(p.finder || {}), [scenario.id]: { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0) } } };
    });
  };

  const next = () => {
    setSelected(null);
    setSubmitted(false);
    setFeedbackMsg("");
    setIdx((i) => i + 1);
  };

  if (!scenario) {
    return (
      <div style={{ padding: "28px 20px", fontFamily: F, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10 }}>Finder unlocks soon</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          Get a few correct answers in Practice to unlock scenario problems here.
        </div>
      </div>
    );
  }

  const correctIdent = IDS.find((i) => i.id === scenario.iid);
  const wrongReason = !submitted || selected === null || selected === scenario.iid
    ? null
    : (scenario.wrong_reasons || {})[selected];

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Pick the right tool</div>

      <div style={{ background: C.surface, borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>{scenario.scenario}</div>
      </div>

      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Which formula fits?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {IDS.map((id) => {
          const isCorrect = id.id === scenario.iid;
          const isChosen = id.id === selected;
          let bg = C.surface, border = C.border, col = C.text;
          if (submitted && isCorrect) { bg = `${C.mint}20`; border = C.mint; col = C.mint; }
          else if (submitted && isChosen && !isCorrect) { bg = `${C.coral}20`; border = C.coral; col = C.coral; }
          return (
            <button key={id.id}
              onClick={() => submit(id.id)}
              disabled={submitted}
              style={{ padding: "13px 16px", borderRadius: 13, border: `2px solid ${border}`, background: bg, color: col, fontSize: 14, fontWeight: 700, cursor: submitted ? "default" : "pointer", fontFamily: F, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{id.id}. {id.name}</span>
              {submitted && isCorrect && <span>✓</span>}
              {submitted && isChosen && !isCorrect && <span>✗</span>}
            </button>
          );
        })}
      </div>

      {submitted && (
        <div style={{ background: selected === scenario.iid ? `${C.mint}18` : `${C.coral}15`, borderRadius: 13, padding: "14px 16px", marginBottom: 14, border: `1px solid ${selected === scenario.iid ? C.mint : C.coral}44` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: selected === scenario.iid ? C.mint : C.coral, marginBottom: 8 }}>{feedbackMsg}</div>
          {wrongReason && (
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 10, opacity: 0.9 }}>
              <span style={{ color: C.coral, fontWeight: 700 }}>Why not {IDS.find((i) => i.id === selected)?.name}: </span>{wrongReason}
            </div>
          )}
          {correctIdent && (
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
              <span style={{ color: correctIdent.color, fontWeight: 700 }}>{correctIdent.name}: </span>{scenario.why}
            </div>
          )}
        </div>
      )}

      {submitted && (
        <button onClick={next}
          style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: F }}>
          Next →
        </button>
      )}
    </div>
  );
}

// ─── LAB ──────────────────────────────────────────────────────────────────────
const LAB_GAMES = [
  {
    key: "missile", title: "Missile Command", iid: 3,
    desc: "Set sin/cos components to launch the missile to the target.",
    unlock: () => true,
    unlockHint: "Get one correct on Unit Circle Basics in Practice to unlock.",
  },
  {
    key: "noise", title: "Noise Cancelling", iid: 1,
    desc: "Build the cancelling sin wave that silences the noise.",
    unlock: () => true,
    unlockHint: "Get one correct on The Foundation in Practice to unlock.",
  },
  {
    key: "bridge", title: "Bridge Builder", iid: 4,
    desc: "Use the addition formulas to balance the cable forces.",
    unlock: () => true,
    unlockHint: "Get one correct on Sin Addition AND Cos Addition in Practice to unlock.",
  },
];

function Lab({ progress, onUpdate }) {
  const [game, setGame] = useState(null);

  if (game === "missile") return <MissileCommand progress={progress} onUpdate={onUpdate} onBack={() => setGame(null)} />;
  if (game === "noise") return <NoiseCancelling progress={progress} onUpdate={onUpdate} onBack={() => setGame(null)} />;
  if (game === "bridge") return <BridgeBuilder progress={progress} onUpdate={onUpdate} onBack={() => setGame(null)} />;

  return (
    <div style={{ padding: "24px 16px", fontFamily: F }}>
      <div style={{ fontSize: 30, fontFamily: FD, color: C.text, fontWeight: 800, lineHeight: 1.15, marginBottom: 6 }}>Lab</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>Apply the math. Wrong inputs make wrong things happen — that's the point.</div>

      {LAB_GAMES.map((g) => {
        const ident = IDS.find((i) => i.id === g.iid);
        const unlocked = g.unlock(progress);
        const labP = (progress.lab || {})[g.key] || { attempts: 0, bestAccuracy: 0 };
        return (
          <div key={g.key}
            onClick={() => unlocked && setGame(g.key)}
            style={{ background: C.surface, borderRadius: 16, padding: "16px 18px", marginBottom: 12, border: `1px solid ${unlocked ? ident.color + "55" : C.border}`, cursor: unlocked ? "pointer" : "default", opacity: unlocked ? 1 : 0.55 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{g.title}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: ident.color, background: `${ident.color}22`, padding: "3px 8px", borderRadius: 999, letterSpacing: "0.06em", textTransform: "uppercase" }}>{ident.name}</div>
              {!unlocked && <span style={{ marginLeft: "auto", fontSize: 14 }}>🔒</span>}
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginBottom: unlocked && labP.attempts > 0 ? 10 : 0 }}>
              {unlocked ? g.desc : g.unlockHint}
            </div>
            {unlocked && labP.attempts > 0 && (
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.muted }}>
                <span>Attempts: <b style={{ color: C.text }}>{labP.attempts}</b></span>
                <span>Best: <b style={{ color: C.gold }}>{Math.round(labP.bestAccuracy)}%</b></span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LabHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", padding: "4px 8px" }}>←</button>
      <div style={{ fontSize: 18, fontFamily: FD, fontWeight: 800, color: C.text }}>{title}</div>
    </div>
  );
}

function recordLab(onUpdate, key, accuracy) {
  onUpdate((p) => {
    const prev = (p.lab || {})[key] || { attempts: 0, bestAccuracy: 0 };
    return { ...p, lab: { ...(p.lab || {}), [key]: { attempts: prev.attempts + 1, bestAccuracy: Math.max(prev.bestAccuracy, accuracy) } } };
  });
}

// ─── GAME 1: MISSILE COMMAND ──────────────────────────────────────────────────
function MissileCommand({ progress, onUpdate, onBack }) {
  const POWER = 100;
  const GRAVITY = 50;
  const SCENE_W = 500, SCENE_H = 250;
  const PX_PER_UNIT = 1.6;
  const CANNON_X = 40, GROUND_Y = SCENE_H - 30;

  const [theta, setTheta] = useState(45);
  const [targetX, setTargetX] = useState(300);
  const [hVelInput, setHVelInput] = useState("");
  const [vVelInput, setVVelInput] = useState("");
  const [fired, setFired] = useState(false);
  const [t, setT] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState(null);
  const rafRef = useRef(null);

  const correctH = POWER * Math.cos((theta * Math.PI) / 180);
  const correctV = POWER * Math.sin((theta * Math.PI) / 180);

  const newChallenge = useCallback(() => {
    setTheta(20 + Math.floor(Math.random() * 60));
    setTargetX(180 + Math.floor(Math.random() * 220));
    setHVelInput(""); setVVelInput("");
    setFired(false); setT(0); setShowHint(false); setResult(null);
  }, []);

  const fire = () => {
    const h = parseFloat(hVelInput);
    const v = parseFloat(vVelInput);
    if (isNaN(h) || isNaN(v)) return;
    setFired(true);
    setT(0);
    const flightT = (2 * v) / GRAVITY;
    const landingX = h * flightT;
    const targetUnits = (targetX - CANNON_X) / PX_PER_UNIT;
    const errPct = Math.abs((landingX - targetUnits) / targetUnits) * 100;
    const accuracy = Math.max(0, 100 - errPct);
    setResult({ landingX, targetUnits, errPct, accuracy, h, v });
    recordLab(onUpdate, "missile", accuracy);

    const start = performance.now();
    const duration = Math.max(800, Math.min(1800, flightT * 600));
    const tick = (now) => {
      const elapsed = (now - start) / duration;
      if (elapsed >= 1) { setT(flightT); return; }
      setT(elapsed * flightT);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const arcPoints = [];
  const stepsForArc = 40;
  if (fired && result) {
    const flightT = (2 * result.v) / GRAVITY;
    for (let i = 0; i <= stepsForArc; i++) {
      const tt = (i / stepsForArc) * flightT;
      const x = CANNON_X + result.h * tt * PX_PER_UNIT;
      const y = GROUND_Y - (result.v * tt - 0.5 * GRAVITY * tt * tt) * PX_PER_UNIT;
      arcPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
  }
  const missileX = fired && result ? CANNON_X + result.h * t * PX_PER_UNIT : CANNON_X;
  const missileY = fired && result ? GROUND_Y - (result.v * t - 0.5 * GRAVITY * t * t) * PX_PER_UNIT : GROUND_Y;

  const verdict = result ? (result.accuracy > 95 ? { msg: "Bullseye! The math works.", color: C.mint } : result.accuracy > 85 ? { msg: "Close — that's a solid hit.", color: C.mint } : result.accuracy > 60 ? { msg: "Off by a fair amount. Check your cos and sin.", color: C.gold } : { msg: "Way off. Recheck which goes with cos and which with sin.", color: C.coral }) : null;

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      <LabHeader title="Missile Command" onBack={onBack} />

      <div style={{ background: C.surface, borderRadius: 14, padding: 12, marginBottom: 14, border: `1px solid ${C.border}` }}>
        <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={{ width: "100%", display: "block" }}>
          <rect x="0" y="0" width={SCENE_W} height={GROUND_Y} fill="#16152a" />
          <rect x="0" y={GROUND_Y} width={SCENE_W} height={SCENE_H - GROUND_Y} fill="#2a2847" />
          {/* cannon */}
          <circle cx={CANNON_X} cy={GROUND_Y} r="10" fill={C.gold} />
          <line x1={CANNON_X} y1={GROUND_Y} x2={CANNON_X + 22 * Math.cos((theta * Math.PI) / 180)} y2={GROUND_Y - 22 * Math.sin((theta * Math.PI) / 180)} stroke={C.gold} strokeWidth="5" strokeLinecap="round" />
          {/* target */}
          <circle cx={targetX} cy={GROUND_Y} r="14" fill="none" stroke={C.coral} strokeWidth="2" />
          <circle cx={targetX} cy={GROUND_Y} r="9" fill="none" stroke={C.coral} strokeWidth="2" />
          <circle cx={targetX} cy={GROUND_Y} r="3" fill={C.coral} />
          {/* arc */}
          {fired && arcPoints.length > 0 && (
            <polyline points={arcPoints.join(" ")} fill="none" stroke={C.gold} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
          )}
          {/* missile */}
          {fired && (
            <circle cx={missileX} cy={missileY} r="5" fill={C.gold} filter="url(#missGlow)" />
          )}
          <defs>
            <filter id="missGlow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
        </svg>
      </div>

      <div style={{ background: C.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 14, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 6 }}>Launch angle: <b style={{ color: C.gold }}>θ = {theta}°</b> &nbsp;·&nbsp; Power: <b>{POWER}</b></div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            Horizontal vel = {POWER} × cos({theta}°) ={" "}
            <input type="number" step="0.01" inputMode="decimal" value={hVelInput} onChange={(e) => setHVelInput(e.target.value)} disabled={fired}
              style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: "monospace", fontSize: 13 }} />
            <br />
            Vertical vel &nbsp;= {POWER} × sin({theta}°) ={" "}
            <input type="number" step="0.01" inputMode="decimal" value={vVelInput} onChange={(e) => setVVelInput(e.target.value)} disabled={fired}
              style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: "monospace", fontSize: 13 }} />
          </div>
          {showHint && (
            <div style={{ marginTop: 10, fontSize: 12, color: C.gold, opacity: 0.85, fontFamily: "monospace" }}>
              cos({theta}°) ≈ {Math.cos((theta * Math.PI) / 180).toFixed(3)} &nbsp; sin({theta}°) ≈ {Math.sin((theta * Math.PI) / 180).toFixed(3)}
            </div>
          )}
        </div>
      </div>

      {!fired && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowHint(true)} disabled={showHint}
            style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${C.gold}`, background: "transparent", color: C.gold, fontWeight: 700, fontSize: 13, cursor: showHint ? "default" : "pointer", fontFamily: F, opacity: showHint ? 0.5 : 1 }}>
            Hint
          </button>
          <button onClick={fire} disabled={!hVelInput || !vVelInput}
            style={{ flex: 2, padding: 13, borderRadius: 12, border: "none", background: hVelInput && vVelInput ? C.gold : C.border, color: hVelInput && vVelInput ? "#0d0c1a" : C.muted, fontWeight: 800, fontSize: 14, cursor: hVelInput && vVelInput ? "pointer" : "default", fontFamily: F }}>
            Test — Fire!
          </button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          <div style={{ background: `${verdict.color}18`, borderRadius: 13, padding: "14px 16px", marginBottom: 10, border: `1px solid ${verdict.color}44` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: verdict.color, marginBottom: 6 }}>{verdict.msg}</div>
            <div style={{ fontSize: 12, color: C.text, fontFamily: "monospace", lineHeight: 1.7 }}>
              Your h = {result.h.toFixed(2)} &nbsp; correct h = <span style={{ color: C.mint }}>{correctH.toFixed(2)}</span><br />
              Your v = {result.v.toFixed(2)} &nbsp; correct v = <span style={{ color: C.mint }}>{correctV.toFixed(2)}</span><br />
              Accuracy: <b style={{ color: C.gold }}>{result.accuracy.toFixed(0)}%</b>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setFired(false); setT(0); setResult(null); setHVelInput(""); setVVelInput(""); setShowHint(false); }}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: F }}>
              Retry Same
            </button>
            <button onClick={newChallenge}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: F }}>
              New Challenge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GAME 2: NOISE CANCELLING ─────────────────────────────────────────────────
function NoiseCancelling({ progress, onUpdate, onBack }) {
  const [seed, setSeed] = useState(0);
  const noise = useMemo(() => {
    const _ = seed;
    return { amp: +(0.4 + Math.random() * 0.4).toFixed(2), freq: 1 + Math.floor(Math.random() * 3) };
  }, [seed]);

  const [ampInput, setAmpInput] = useState("");
  const [freqInput, setFreqInput] = useState("");
  const [phaseInput, setPhaseInput] = useState("");
  const [submitted, setSubmitted] = useState(null);

  const userAmp = parseFloat(ampInput) || 0;
  const userFreq = parseFloat(freqInput) || 0;
  const userPhase = parseFloat(phaseInput) || 0;

  const W = 320, H = 60, SAMPLES = 200, X_RANGE = 4 * Math.PI;
  const buildPath = (fn) => {
    const pts = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (i / SAMPLES) * X_RANGE;
      const y = fn(x);
      const sx = (i / SAMPLES) * W;
      const sy = H / 2 - y * (H / 2 - 4);
      pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const noiseFn = (x) => noise.amp * Math.sin(noise.freq * x);
  const userFn = (x) => userAmp * Math.sin(userFreq * x + userPhase * Math.PI);
  const sumFn = (x) => noiseFn(x) + userFn(x);

  const submit = () => {
    let sumSq = 0, noiseSq = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (i / SAMPLES) * X_RANGE;
      sumSq += sumFn(x) ** 2;
      noiseSq += noiseFn(x) ** 2;
    }
    const rmsResult = Math.sqrt(sumSq / SAMPLES);
    const rmsNoise = Math.sqrt(noiseSq / SAMPLES);
    const cancelled = Math.max(0, 1 - rmsResult / rmsNoise) * 100;
    const accuracy = cancelled;
    setSubmitted({ cancelled, accuracy });
    recordLab(onUpdate, "noise", accuracy);
  };

  const newProblem = () => {
    setSeed((s) => s + 1);
    setAmpInput(""); setFreqInput(""); setPhaseInput(""); setSubmitted(null);
  };

  const verdict = submitted ? (submitted.cancelled > 95 ? { msg: "Perfect cancellation — silence achieved.", color: C.mint } : submitted.cancelled > 70 ? { msg: "Almost — you can still hear a faint hum. Check your phase shift.", color: C.gold } : { msg: "Still loud. Check the amplitude and phase.", color: C.coral }) : null;

  const Wave = ({ fn, color, label }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={C.border} strokeWidth="0.5" />
        <polyline points={buildPath(fn)} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    </div>
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      <LabHeader title="Noise Cancelling" onBack={onBack} />

      <Wave fn={noiseFn} color={C.coral} label={`Incoming noise — amp ${noise.amp}, freq ${noise.freq}`} />
      <Wave fn={userFn} color={C.teal} label="Your cancelling wave" />
      <Wave fn={sumFn} color={C.gold} label="What you hear (sum)" />

      <div style={{ background: C.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, marginBottom: 12 }}>
          To cancel a wave, your wave needs the same amplitude and frequency — but shifted by exactly π (half a cycle). That makes sin(x) become −sin(x), which adds to zero.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Amplitude", val: ampInput, set: setAmpInput, hint: "" },
            { label: "Frequency", val: freqInput, set: setFreqInput, hint: "" },
            { label: "Phase × π", val: phaseInput, set: setPhaseInput, hint: "" },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 3 }}>{f.label}</div>
              <input type="number" step="0.01" inputMode="decimal" value={f.val} onChange={(e) => f.set(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: "monospace", fontSize: 13, outline: "none" }} />
            </div>
          ))}
        </div>
      </div>

      <button onClick={submit} disabled={!ampInput || !freqInput || !phaseInput}
        style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: ampInput && freqInput && phaseInput ? C.gold : C.border, color: ampInput && freqInput && phaseInput ? "#0d0c1a" : C.muted, fontWeight: 800, fontSize: 15, cursor: ampInput && freqInput && phaseInput ? "pointer" : "default", fontFamily: F, marginBottom: 12 }}>
        Submit
      </button>

      {submitted && (
        <>
          <div style={{ background: `${verdict.color}18`, borderRadius: 13, padding: "14px 16px", marginBottom: 12, border: `1px solid ${verdict.color}44` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: verdict.color, marginBottom: 6 }}>{verdict.msg}</div>
            <div style={{ fontSize: 13, color: C.text }}>Cancelled: <b style={{ color: C.gold }}>{submitted.cancelled.toFixed(0)}%</b></div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, fontFamily: "monospace", lineHeight: 1.7 }}>
              Noise: {noise.amp} × sin({noise.freq}·x)<br />
              Your wave: {userAmp} × sin({userFreq}·x + {userPhase}π)<br />
              Perfect: amp={noise.amp}, freq={noise.freq}, phase=1
            </div>
          </div>
          <button onClick={newProblem}
            style={{ width: "100%", padding: 13, borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: F }}>
            New Problem
          </button>
        </>
      )}
    </div>
  );
}

// ─── GAME 3: BRIDGE BUILDER ───────────────────────────────────────────────────
function BridgeBuilder({ progress, onUpdate, onBack }) {
  const [seed, setSeed] = useState(0);
  const challenge = useMemo(() => {
    const _ = seed;
    const x = 15 + Math.floor(Math.random() * 30);
    const y = 15 + Math.floor(Math.random() * 30);
    return { x, y };
  }, [seed]);

  const x = challenge.x, y = challenge.y;
  const cosX = Math.cos((x * Math.PI) / 180);
  const cosY = Math.cos((y * Math.PI) / 180);
  const sinX = Math.sin((x * Math.PI) / 180);
  const sinY = Math.sin((y * Math.PI) / 180);
  const correctCosSum = cosX * cosY - sinX * sinY;
  const correctSinSum = sinX * cosY + sinY * cosX;

  const [inputs, setInputs] = useState({ cosX: "", cosY: "", sinX: "", sinY: "", finalCos: "", finalSin: "" });
  const [tested, setTested] = useState(null);

  const setField = (k) => (e) => setInputs((s) => ({ ...s, [k]: e.target.value }));
  const valid = Object.values(inputs).every((v) => v !== "" && !isNaN(parseFloat(v)));

  const TOL = 0.02;
  const test = () => {
    const checks = {
      cosX: Math.abs(parseFloat(inputs.cosX) - cosX) < TOL,
      cosY: Math.abs(parseFloat(inputs.cosY) - cosY) < TOL,
      sinX: Math.abs(parseFloat(inputs.sinX) - sinX) < TOL,
      sinY: Math.abs(parseFloat(inputs.sinY) - sinY) < TOL,
      finalCos: Math.abs(parseFloat(inputs.finalCos) - correctCosSum) < TOL,
      finalSin: Math.abs(parseFloat(inputs.finalSin) - correctSinSum) < TOL,
    };
    const componentScore = ["cosX", "cosY", "sinX", "sinY"].filter((k) => checks[k]).length / 4;
    const finalScore = (checks.finalCos ? 1 : 0) * 0.5 + (checks.finalSin ? 1 : 0) * 0.5;
    const accuracy = (componentScore * 0.4 + finalScore * 0.6) * 100;

    const finalCosVal = parseFloat(inputs.finalCos);
    const finalSinVal = parseFloat(inputs.finalSin);
    const sagCos = Math.abs(finalCosVal - correctCosSum);
    const sagSin = Math.abs(finalSinVal - correctSinSum);
    const sag = Math.min(40, (sagCos + sagSin) * 60);

    setTested({ checks, accuracy, sag, finalCosVal, finalSinVal });
    recordLab(onUpdate, "bridge", accuracy);
  };

  const newProblem = () => {
    setSeed((s) => s + 1);
    setInputs({ cosX: "", cosY: "", sinX: "", sinY: "", finalCos: "", finalSin: "" });
    setTested(null);
  };

  const verdict = tested ? (tested.accuracy > 95 ? { msg: "Structure is sound. Great engineering.", color: C.mint } : tested.accuracy > 75 ? { msg: "Cable holds, but with stress. Recheck a multiplication.", color: C.gold } : { msg: "The cable is bearing the wrong load — recheck the formula.", color: C.coral }) : null;

  const sag = tested ? tested.sag : 0;
  const deckColor = tested ? (tested.accuracy > 95 ? C.mint : tested.accuracy > 75 ? C.gold : C.coral) : C.muted;

  const inputBox = (k, w = 60) => (
    <input type="number" step="0.01" inputMode="decimal" value={inputs[k]} onChange={setField(k)} disabled={!!tested}
      style={{ width: w, padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${tested ? (tested.checks[k] ? C.mint : C.coral) : C.border}`, background: C.bg, color: tested ? (tested.checks[k] ? C.mint : C.coral) : C.text, fontFamily: "monospace", fontSize: 13 }} />
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: F }}>
      <LabHeader title="Bridge Builder" onBack={onBack} />

      <div style={{ background: C.surface, borderRadius: 14, padding: 12, marginBottom: 14, border: `1px solid ${C.border}` }}>
        <svg viewBox="0 0 500 200" style={{ width: "100%", display: "block" }}>
          {/* sky */}
          <rect x="0" y="0" width="500" height="160" fill="#16152a" />
          <rect x="0" y="160" width="500" height="40" fill="#2a2847" />
          {/* towers */}
          <rect x="60" y="40" width="14" height="120" fill={C.muted} />
          <rect x="426" y="40" width="14" height="120" fill={C.muted} />
          {/* deck */}
          <line x1="74" y1={120 + sag} x2="426" y2={120 + sag} stroke={deckColor} strokeWidth="6" />
          {/* cable (left to mid bottom of deck to right) */}
          <path d={`M67,40 Q250,${85 + sag * 1.5} 433,40`} fill="none" stroke={C.gold} strokeWidth="2.5" />
          {/* force arrows on cable mid */}
          <g transform="translate(250 85)">
            <line x1="0" y1="0" x2={Math.cos((x * Math.PI) / 180) * 50} y2={-Math.sin((x * Math.PI) / 180) * 50} stroke={C.teal} strokeWidth="2.5" markerEnd="url(#arrTeal)" />
            <line x1="0" y1="0" x2={Math.cos((y * Math.PI) / 180) * 50} y2={-Math.sin((y * Math.PI) / 180) * 50} stroke={C.purple} strokeWidth="2.5" markerEnd="url(#arrPurp)" />
          </g>
          <defs>
            <marker id="arrTeal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.teal} /></marker>
            <marker id="arrPurp" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.purple} /></marker>
          </defs>
        </svg>
      </div>

      <div style={{ background: C.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Force 1 angle: <b style={{ color: C.teal }}>x = {x}°</b> &nbsp; Force 2 angle: <b style={{ color: C.purple }}>y = {y}°</b> &nbsp; Combined: <b>{x + y}°</b>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: C.text, lineHeight: 1.9 }}>
          <div style={{ color: C.coral, fontWeight: 700, marginBottom: 4 }}>cos(x+y) = cos(x)cos(y) − sin(x)sin(y)</div>
          <div>= {inputBox("cosX")} × {inputBox("cosY")} − {inputBox("sinX")} × {inputBox("sinY")}</div>
          <div>= {inputBox("finalCos", 80)}</div>
          <div style={{ color: C.purple, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>sin(x+y) = sin(x)cos(y) + sin(y)cos(x)</div>
          <div>= {inputBox("sinX")} × {inputBox("cosY")} + {inputBox("sinY")} × {inputBox("cosX")}</div>
          <div>= {inputBox("finalSin", 80)}</div>
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontStyle: "italic" }}>(The four component fields share values across both formulas.)</div>
      </div>

      {!tested && (
        <button onClick={test} disabled={!valid}
          style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: valid ? C.gold : C.border, color: valid ? "#0d0c1a" : C.muted, fontWeight: 800, fontSize: 15, cursor: valid ? "pointer" : "default", fontFamily: F }}>
          Test the Bridge
        </button>
      )}

      {tested && (
        <>
          <div style={{ background: `${verdict.color}18`, borderRadius: 13, padding: "14px 16px", marginBottom: 12, border: `1px solid ${verdict.color}44` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: verdict.color, marginBottom: 6 }}>{verdict.msg}</div>
            <div style={{ fontSize: 12, color: C.text, fontFamily: "monospace", lineHeight: 1.7 }}>
              Correct cos(x+y) = {correctCosSum.toFixed(3)}<br />
              Correct sin(x+y) = {correctSinSum.toFixed(3)}<br />
              Accuracy: <b style={{ color: C.gold }}>{tested.accuracy.toFixed(0)}%</b>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setInputs({ cosX: "", cosY: "", sinX: "", sinY: "", finalCos: "", finalSin: "" }); setTested(null); }}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: F }}>
              Retry Same
            </button>
            <button onClick={newProblem}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", background: C.gold, color: "#0d0c1a", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: F }}>
              New Problem
            </button>
          </div>
        </>
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

      {(() => {
        const fEntries = Object.values(progress.finder || {});
        if (fEntries.length === 0) return null;
        const fSeen = fEntries.reduce((s, e) => s + (e.seen || 0), 0);
        const fCorrect = fEntries.reduce((s, e) => s + (e.correct || 0), 0);
        const fAcc = fSeen > 0 ? Math.round((fCorrect / fSeen) * 100) : 0;
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Formula Finder</div>
            <div style={{ background: C.surface, borderRadius: 13, padding: 14, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{fEntries.length}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Scenarios tried</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.mint }}>{fCorrect}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Correct</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{fAcc}%</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Accuracy</div>
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const lab = progress.lab || {};
        const games = [
          { key: "missile", title: "Missile Command" },
          { key: "noise", title: "Noise Cancelling" },
          { key: "bridge", title: "Bridge Builder" },
        ];
        const tried = games.filter((g) => (lab[g.key]?.attempts || 0) > 0);
        if (tried.length === 0) return null;
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Lab</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, opacity: 0.8 }}>She's applying the math, not just recalling it.</div>
            <div style={{ background: C.surface, borderRadius: 13, padding: 14, border: `1px solid ${C.border}` }}>
              {games.map((g, i) => {
                const r = lab[g.key] || { attempts: 0, bestAccuracy: 0 };
                const last = i === games.length - 1;
                return (
                  <div key={g.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: last ? "none" : `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ color: r.attempts > 0 ? C.text : C.muted, fontWeight: 600 }}>{g.title}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>
                      {r.attempts > 0 ? (
                        <>{r.attempts} {r.attempts === 1 ? "attempt" : "attempts"} &nbsp; · &nbsp; <b style={{ color: C.gold }}>{Math.round(r.bestAccuracy)}%</b> best</>
                      ) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
        {screen === "finder" && <FormulaFinder progress={progress} onUpdate={updateProgress} />}
        {screen === "practice" && <PracticeMode progress={progress} onUpdate={updateProgress} />}
        {screen === "lab" && <Lab progress={progress} onUpdate={updateProgress} />}
        {screen === "parent" && <ParentView progress={progress} onClose={() => setScreen("home")} />}
      </div>

      {/* Bottom nav */}
      {screen !== "parent" && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", padding: "10px 0 12px" }}>
          {[{ k: "home", icon: "⌂", l: "Home" }, { k: "explore", icon: "◎", l: "Explore" }, { k: "finder", icon: "⊕", l: "Finder" }, { k: "practice", icon: "◈", l: "Practice" }, { k: "lab", icon: "⚗", l: "Lab" }].map((n) => (
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
