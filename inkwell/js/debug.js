// Debug panel — monitors viewport/layout metrics to catch the "zoom in" bug
// Remove this file once the bug is found

let panel = null;
let preSnapshot = null;
let snapshots = [];

function getMetrics() {
    const vv = window.visualViewport;
    const vc = document.getElementById('view-container');
    const sv = document.querySelector('.scan-viewport');
    const st = document.getElementById('screen-text');
    const tb = document.getElementById('transcript-body');
    const video = document.getElementById('camera-feed');

    const vcRect = vc?.getBoundingClientRect();
    const svRect = sv?.getBoundingClientRect();
    const stRect = st?.getBoundingClientRect();
    const tbRect = tb?.getBoundingClientRect();

    return {
        // Window
        innerW: window.innerWidth,
        innerH: window.innerHeight,
        docClientW: document.documentElement.clientWidth,
        docClientH: document.documentElement.clientHeight,
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
        bodyScrollW: document.body.scrollWidth,
        bodyScrollH: document.body.scrollHeight,
        dpr: window.devicePixelRatio,

        // Visual Viewport (key for detecting browser-level zoom)
        vvScale: vv?.scale,
        vvWidth: vv?.width,
        vvHeight: vv?.height,
        vvOffsetL: vv?.offsetLeft,
        vvOffsetT: vv?.offsetTop,

        // View container
        vcW: vcRect?.width,
        vcH: vcRect?.height,
        vcL: vcRect?.left,
        vcCompW: vc ? getComputedStyle(vc).width : null,

        // Scan viewport
        svW: svRect?.width,
        svH: svRect?.height,

        // Text screen
        stW: stRect?.width,

        // Transcript body
        tbW: tbRect?.width,
        tbScrollW: tb?.scrollWidth,
        tbScrollH: tb?.scrollHeight,

        // Video
        vidW: video?.videoWidth,
        vidH: video?.videoHeight,
        vidClientW: video?.clientWidth,
        vidClientH: video?.clientHeight,

        // Meta viewport (detect if it changed)
        metaVP: document.querySelector('meta[name="viewport"]')?.content,

        ts: Date.now()
    };
}

function diff(before, after) {
    const changes = {};
    for (const key of Object.keys(after)) {
        if (key === 'ts') continue;
        if (before[key] !== after[key]) {
            changes[key] = { was: before[key], now: after[key] };
        }
    }
    return changes;
}

function formatMetrics(m) {
    return [
        `window: ${m.innerW}x${m.innerH}  doc: ${m.docClientW}x${m.docClientH}`,
        `scrollW/H: ${m.scrollW}x${m.scrollH}  body: ${m.bodyScrollW}x${m.bodyScrollH}`,
        `dpr: ${m.dpr}`,
        `vv: scale=${m.vvScale} ${m.vvWidth}x${m.vvHeight} off=${m.vvOffsetL},${m.vvOffsetT}`,
        `vc: ${Math.round(m.vcW)}x${Math.round(m.vcH)} L=${Math.round(m.vcL)} comp=${m.vcCompW}`,
        `scanVP: ${Math.round(m.svW)}x${Math.round(m.svH)}`,
        `textScrn: ${Math.round(m.stW)}  tbody: ${Math.round(m.tbW)} sW=${m.tbScrollW}`,
        `video: native=${m.vidW}x${m.vidH} rendered=${m.vidClientW}x${m.vidClientH}`,
        `meta: ${m.metaVP}`
    ].join('\n');
}

function formatDiff(changes) {
    const keys = Object.keys(changes);
    if (keys.length === 0) return '  (no changes)';
    return keys.map(k => `  ${k}: ${changes[k].was} → ${changes[k].now}`).join('\n');
}

function updatePanel() {
    if (!panel) return;
    const m = getMetrics();

    let html = `<b>LIVE METRICS</b>\n${formatMetrics(m)}\n`;

    if (snapshots.length > 0) {
        html += `\n<b>SCAN HISTORY (${snapshots.length})</b>\n`;
        for (const snap of snapshots.slice(-3)) {
            html += `\n--- Scan #${snap.idx} ---\n`;
            const changes = diff(snap.before, snap.after);
            const changedKeys = Object.keys(changes);
            if (changedKeys.length === 0) {
                html += '  No metric changes\n';
            } else {
                html += `<span class="changed">${formatDiff(changes)}</span>\n`;
            }
        }
    }

    // Also check if current metrics differ from initial
    if (preSnapshot) {
        const driftChanges = diff(preSnapshot, m);
        const driftKeys = Object.keys(driftChanges).filter(k =>
            !['ts', 'tbScrollW', 'tbScrollH', 'vidW', 'vidH'].includes(k)
        );
        if (driftKeys.length > 0) {
            html += `\n<b>DRIFT FROM BOOT</b>\n`;
            const filtered = {};
            for (const k of driftKeys) filtered[k] = driftChanges[k];
            html += `<span class="changed">${formatDiff(filtered)}</span>\n`;
        }
    }

    panel.innerHTML = html;
}

export function initDebug() {
    // Create panel
    panel = document.createElement('div');
    panel.className = 'debug-panel';
    panel.textContent = 'Debug: loading…';
    document.body.appendChild(panel);

    // Take initial snapshot after a short delay (let camera start)
    setTimeout(() => {
        preSnapshot = getMetrics();
        console.log('[DEBUG] Initial metrics:', preSnapshot);
        updatePanel();
    }, 2000);

    // Update every 500ms
    setInterval(updatePanel, 500);

    // Monitor visualViewport changes
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            console.log('[DEBUG] visualViewport resize:', {
                scale: window.visualViewport.scale,
                width: window.visualViewport.width,
                height: window.visualViewport.height
            });
        });
        window.visualViewport.addEventListener('scroll', () => {
            console.log('[DEBUG] visualViewport scroll:', {
                offsetLeft: window.visualViewport.offsetLeft,
                offsetTop: window.visualViewport.offsetTop
            });
        });
    }

    // Monitor window resize
    window.addEventListener('resize', () => {
        console.log('[DEBUG] window resize:', {
            innerW: window.innerWidth,
            innerH: window.innerHeight,
            dpr: window.devicePixelRatio
        });
    });

    // Monitor DOM mutations on <head> (viewport meta changes)
    const headObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            console.log('[DEBUG] <head> mutation:', m.type, m.target.tagName, m.attributeName);
        }
    });
    headObserver.observe(document.head, { childList: true, subtree: true, attributes: true });

    // ResizeObserver on key elements
    const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const id = entry.target.id || entry.target.className;
            const cr = entry.contentRect;
            console.log(`[DEBUG] ResizeObserver: ${id} → ${Math.round(cr.width)}x${Math.round(cr.height)}`);
        }
    });

    const watchEls = [
        document.getElementById('view-container'),
        document.querySelector('.scan-viewport'),
        document.getElementById('screen-text'),
        document.getElementById('transcript-body'),
        document.getElementById('camera-feed')
    ];
    watchEls.forEach(el => { if (el) ro.observe(el); });

    console.log('[DEBUG] Debug panel initialized. Watching for zoom changes.');
}

// Call this BEFORE a scan starts
export function debugPreScan() {
    const before = getMetrics();
    console.log('[DEBUG] PRE-SCAN metrics:', before);

    // Store for post-scan comparison
    window.__debugPreScan = before;
}

// Call this AFTER a scan completes (success or error)
export function debugPostScan() {
    const after = getMetrics();
    const before = window.__debugPreScan;

    if (!before) {
        console.log('[DEBUG] POST-SCAN metrics (no pre-scan snapshot):', after);
        return;
    }

    const changes = diff(before, after);
    const changedKeys = Object.keys(changes);

    if (changedKeys.length > 0) {
        console.warn('[DEBUG] *** METRICS CHANGED DURING SCAN ***');
        console.table(changes);
    } else {
        console.log('[DEBUG] POST-SCAN: No metric changes detected');
    }

    snapshots.push({ idx: snapshots.length + 1, before, after });
    updatePanel();
}
