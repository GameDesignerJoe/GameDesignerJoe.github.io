// ══════════════════════════════════════════════
// kill.code — render/phase.js
// Phase banner + status row + main controls (Purge / Execute / New Breach).
// ══════════════════════════════════════════════

export function renderPhase(state, root){
  const ph = root.getElementById('phase');
  const st = root.getElementById('status');
  const ct = root.getElementById('ctrls');
  if(!ph || !st || !ct) return;

  if(state.over === 'won'){
    ph.className = 'phase';
    ph.textContent = '';
    st.className = 'status win';
    st.textContent = `// Breach Successful — ${state.rows.length} cycle${state.rows.length === 1 ? '' : 's'}`;
    ct.innerHTML = `<button class="btn btn-new" data-action="new-game">New Breach</button>`;
    return;
  }

  if(state.over === 'lost'){
    ph.className = 'phase';
    ph.textContent = '';
    st.className = 'status lose';
    st.textContent = '// Connection Terminated — Traced';
    ct.innerHTML = '';
    document.body.classList.add('lockdown');
    return;
  }

  const rem = state.maxRows - state.rows.length;
  st.className = 'status';
  st.textContent = `${rem} cycle${rem === 1 ? '' : 's'} remaining`;

  const stepping = state.phase === 'card-step';
  if(state.phase === 'play-card' || stepping){
    ph.className = 'phase' + (stepping ? ' probe' : ' active');
    ph.textContent = stepping
      ? '> Probe active — select slot and key above'
      : '> Load and deploy a program to proceed';
  } else {
    ph.className = 'phase';
    ph.textContent = '> Input injection sequence and execute';
  }

  const submitDisabled = state.phase !== 'guess' || state.cur.some(v => v === -1);
  ct.innerHTML =
    `<button class="btn btn-x" data-action="purge">Purge</button>` +
    `<button class="btn btn-sub" data-action="submit" ${submitDisabled ? 'disabled' : ''}>Execute</button>`;
}
