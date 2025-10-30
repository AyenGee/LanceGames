
let hudEl = null; let hudTextEl = null; let pauseBtn = null; let playBtn = null; let timeMsTotal = 20 * 1000; let timeMsLeft = timeMsTotal; let gameEnded = false; let gamePaused = false;
export function setupHUD() {
    hudEl = document.createElement('div'); hudEl.className = 'hud';
    const progressContainer = document.createElement('div'); progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div'); progressBar.id = 'time-progress-bar'; progressBar.className = 'time-progress-bar'; progressContainer.appendChild(progressBar);
    const mainContentRow = document.createElement('div'); mainContentRow.className = 'main-content-row';
    const reportsContainer = document.createElement('div'); reportsContainer.className = 'reports-container';
    const reportsLabel = document.createElement('div'); reportsLabel.className = 'reports-label'; reportsLabel.textContent = 'REPORTS:';
    const reportsCounter = document.createElement('div'); reportsCounter.id = 'reports-counter'; reportsCounter.className = 'reports-counter';
    reportsContainer.appendChild(reportsLabel); reportsContainer.appendChild(reportsCounter); mainContentRow.appendChild(reportsContainer);
    const controlsRow = document.createElement('div'); controlsRow.className = 'controls-row';
    pauseBtn = document.createElement('button'); pauseBtn.className = 'btn btn--pause'; pauseBtn.textContent = '⏸ PAUSE'; pauseBtn.addEventListener('click', () => { if (!gameStarted || gameEnded) return; gamePaused = true; });
    playBtn = document.createElement('button'); playBtn.className = 'btn btn--play'; playBtn.textContent = '▶ PLAY'; playBtn.addEventListener('click', () => { if (gameEnded) return; gameStarted = true; gamePaused = false; });
    const ctrlBtn = document.createElement('button'); /*ctrlBtn.className = 'ctrl-btn';*/ ctrlBtn.className= 'btn btn-ctrl'; ctrlBtn.textContent = '⌨ CONTROLS'; 
    const rstBtn = document.createElement('button'); /*rstBtn.className = 'rst-btn';*/ rstBtn.className = 'btn btn-rst';  rstBtn.textContent = '↻ Restart'; rstBtn.addEventListener('click', ()=>location.reload());
    const controlsPanel = document.createElement('div'); controlsPanel.id = 'controls-panel'; controlsPanel.className = 'controls-panel is-hidden'; controlsPanel.setAttribute('role', 'dialog'); controlsPanel.setAttribute('aria-modal', 'false');
    controlsPanel.innerHTML = `<div class="controls-panel__header"><strong>Game Controls</strong></div><ul class="controls-panel__list"><li><kbd>W/A/S/D</kbd> or <kbd>Arrow Keys</kbd> — Move</li><li><kbd>Space</kbd> — Action / Interact</li><li><kbd>Shift</kbd> — Sprint</li><li><kbd>P</kbd> — Pause</li><li><kbd>M</kbd> — Mute/Unmute</li><li><kbd>?</kbd> — Toggle Camera</li></ul>`;
    //const closeBtn = controlsPanel.querySelector('.controls-panel__close'); closeBtn.className = 'btn btn-close';
    //closeBtn.addEventListener('click', ()=> controlsPanel.hidden = true);
    ctrlBtn.addEventListener('click', ()=> {if(controlsPanel.hidden){controlsPanel.hidden=false;}else{
        controlsPanel.hidden = true;
    }});
    const toggleControls = (forceState) => { const isHidden = controlsPanel.classList.contains('is-hidden'); const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden; controlsPanel.classList.toggle('is-hidden', !shouldOpen); ctrlBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false'); };
    ctrlBtn.addEventListener('click', () => toggleControls());
    //closeBtn.addEventListener('click', () => toggleControls(false));
    document.addEventListener('keydown', (e) => { if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleControls(); if (e.key === 'Escape') toggleControls(false); });
    controlsRow.appendChild(playBtn); controlsRow.appendChild(pauseBtn); controlsRow.appendChild(ctrlBtn); controlsRow.appendChild(rstBtn);
    hudEl.appendChild(progressContainer); hudEl.appendChild(mainContentRow); hudEl.appendChild(controlsRow); hudEl.appendChild(controlsPanel); document.body.appendChild(hudEl);
    updateHUD();
}