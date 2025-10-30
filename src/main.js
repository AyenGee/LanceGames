import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === Scene Setup ===
const scene = new THREE.Scene();
let gameStarted = false;

// === LOADING SCREEN (CSS-driven) ===
let loadingOverlay;
let progressBar;

// --- Minimap Constants ---
const mapWidthPx = 200;
const mapHeightPx = 200;
const mapMargin = 20; // Define the margin
const aspect = mapWidthPx / mapHeightPx;
const mapViewSize = 18; // How many world units the map shows vertically (adjust for zoom)

// --- Orthographic Camera Parameters ---
const top = mapViewSize / 2;
const bottom = -mapViewSize / 2;
const left = -mapViewSize * aspect / 2;
const right = mapViewSize * aspect / 2;
const near = 0.1;
const far = 1000;

// === Map Camera ===
const mapCamera = new THREE.OrthographicCamera( left, right, top, bottom, near, far );
// Initial position will be set in animate or after player loads

// (Your utility functions: injectVideoIntroStyles, playIntroVideo, createLoadingUI, injectStartScreenStyles, createStartScreen, showStartScreenAfterLoad remain the same)
// ... (paste those functions here) ...
function injectVideoIntroStyles() {
    if (document.getElementById('video-intro-styles')) return;
    const css = `
        #video-intro-overlay {
            position: fixed; inset: 0; width: 100vw; height: 100vh;
            z-index: 10000; background: #000; display: flex;
            align-items: center; justify-content: center; opacity: 1;
            transition: opacity 400ms ease-out;
        }
        #video-intro-overlay video { width: 100%; height: 100%; object-fit: cover; }
        #video-intro-overlay .skip-btn {
            position: absolute; bottom: 30px; right: 30px; z-index: 10001;
            padding: 10px 18px; font-size: 16px; background: rgba(255, 255, 255, 0.15);
            color: white; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px;
            cursor: pointer; backdrop-filter: blur(3px); opacity: 0.7; transition: all 200ms ease;
        }
        #video-intro-overlay .skip-btn:hover { background: rgba(255, 255, 255, 0.3); opacity: 1; }
    `;
    const style = document.createElement('style');
    style.id = 'video-intro-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

function playIntroVideo(videoSrc, onComplete) {
    injectVideoIntroStyles();
    const overlay = document.createElement('div');
    overlay.id = 'video-intro-overlay';
    const video = document.createElement('video');
    video.src = videoSrc; video.muted = true; video.autoplay = true; video.playsInline = true;
    overlay.appendChild(video);
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip Intro'; skipBtn.className = 'skip-btn';
    overlay.appendChild(skipBtn);
    let isCleanedUp = false;
    function cleanup() {
        if (isCleanedUp) return; isCleanedUp = true; video.pause(); overlay.style.opacity = '0';
        overlay.addEventListener('transitionend', () => { overlay.remove(); if (onComplete) onComplete(); }, { once: true });
        setTimeout(() => { if (overlay.isConnected) overlay.remove(); if (onComplete && !isCleanedUp) onComplete(); }, 500); // Fallback
    }
    skipBtn.addEventListener('click', cleanup, { once: true });
    video.addEventListener('ended', cleanup, { once: true });
    video.addEventListener('error', (e) => { console.error("Intro video failed:", e); cleanup(); }, { once: true });
    document.body.appendChild(overlay);
    const playPromise = video.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => { console.warn("Autoplay prevented:", error); overlay.remove(); if (onComplete) onComplete(); });
    }
}

function createLoadingUI() {
    loadingOverlay = document.createElement('div'); loadingOverlay.id = 'loading-screen';
    const container = document.createElement('div'); container.className = 'loading-container';
    const img = document.createElement('img'); img.className = 'loading-image'; img.src = '/models/main.png'; img.alt = 'Loading';
    container.appendChild(img);
    const progress = document.createElement('div'); progress.className = 'loading-progress';
    progressBar = document.createElement('div'); progressBar.className = 'loading-progress__bar';
    progress.appendChild(progressBar); container.appendChild(progress); loadingOverlay.appendChild(container);
    document.body.appendChild(loadingOverlay);
}

function injectStartScreenStyles() {
    if (document.getElementById('start-screen-styles')) return;
    const css = `
    html, body, #app { height: 100%; } html, body { margin: 0; }
    #start-screen.overlay { /* styles */ position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(10,10,13,0.8); backdrop-filter: blur(2px); opacity: 1; transition: opacity 300ms ease; }
    #start-screen.overlay.hidden { opacity: 0; pointer-events: none; }
    #start-screen .panel { /* styles */ width: min(92vw, 560px); padding: 28px 32px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.45); background: linear-gradient(180deg, #1b1f2a, #0f1218); color: #fff; text-align: center; }
    #start-screen .title { margin: 0 0 8px; font-size: clamp(28px, 4vw, 40px); letter-spacing: 0.5px; }
    #start-screen .subtitle { margin: 0 0 24px; opacity: 0.9; }
    #start-screen .btn { display: inline-block; margin: 6px 0 14px; padding: 12px 22px; font-size: 16px; border: 0; border-radius: 999px; cursor: pointer; background: #ffd400; color: #111; }
    #start-screen .row { display: flex; gap: 16px; justify-content: center; align-items: center; }
    #start-screen .link { background: none; border: none; color: #9cc8ff; cursor: pointer; text-decoration: underline; }
    `;
    const style = document.createElement('style'); style.id = 'start-screen-styles'; style.textContent = css; document.head.appendChild(style);
}

function createStartScreen() {
    injectStartScreenStyles();
    let app = document.getElementById('app'); if (!app) { app = document.createElement('div'); app.id = 'app'; document.body.appendChild(app); }
    const existing = document.getElementById('start-screen'); if (existing) existing.remove();
    const startScreen = document.createElement('div'); startScreen.id = 'start-screen'; startScreen.className = 'overlay';
    const panel = document.createElement('div'); panel.className = 'panel';
    const h1 = document.createElement('h1'); h1.className = 'title'; h1.textContent = 'Lance: Trapped in Wits'; // Fixed classname
    const p = document.createElement('p'); p.className = 'subtitle'; p.textContent = 'Press Play to begin';
    const playBtn = document.createElement('button'); playBtn.id = 'play-btn'; playBtn.className = 'btn'; playBtn.textContent = 'Play';
    const row = document.createElement('div'); row.className = 'row';
    const label = document.createElement('label'); const mute = document.createElement('input'); mute.id = 'mute'; mute.type = 'checkbox'; mute.checked = true;
    label.appendChild(mute); label.appendChild(document.createTextNode(' Mute'));
    const settings = document.createElement('button'); settings.id = 'settings'; settings.className = 'link'; settings.textContent = 'Settings';
    row.appendChild(label); row.appendChild(settings);
    panel.appendChild(h1); panel.appendChild(p); panel.appendChild(playBtn); panel.appendChild(row);
    startScreen.appendChild(panel); app.appendChild(startScreen); document.body.appendChild(startScreen); // Append to body or app? Ensure only one. Appending to body.
    const show = () => { startScreen.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
    const hide = () => { startScreen.classList.add('hidden'); document.body.style.overflow = ''; };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playBtn.click(); } };
    startScreen.addEventListener('transitionend', () => { if (!startScreen.isConnected) document.removeEventListener('keydown', onKey); });
    return { root: startScreen, panel, playBtn, mute, settings, show, hide, enableKeyboardStart() { document.addEventListener('keydown', onKey); }, disableKeyboardStart() { document.removeEventListener('keydown', onKey); } };
}

function showStartScreenAfterLoad() {
    const { root, playBtn, show, hide, enableKeyboardStart, disableKeyboardStart } = createStartScreen();
    show(); enableKeyboardStart();
    const begin = () => { disableKeyboardStart(); hide(); root.remove(); setupStartOverlay(); };
    playBtn.addEventListener('click', begin, { once: true });
}
//----------------------------------

createLoadingUI(); // Call it to create the UI elements initially

// === THREE.js Loading Manager ===
const manager = new THREE.LoadingManager();
let loadStart = null;
const MIN_LOAD_MS = 4000;
manager.onStart = function () {
    if (progressBar) progressBar.style.width = '0%';
    loadStart = performance.now();
};
manager.onProgress = function (_url, itemsLoaded, itemsTotal) {
    if (!progressBar || !itemsTotal) return;
    const pct = Math.round((itemsLoaded / itemsTotal) * 100);
    progressBar.style.width = `${pct}%`;
};
manager.onLoad = function () {
    if (!loadingOverlay) return;
    const elapsed = loadStart ? (performance.now() - loadStart) : MIN_LOAD_MS;
    const delay = Math.max(0, MIN_LOAD_MS - elapsed);
    setTimeout(() => {
        loadingOverlay.classList.add('is-hidden');
        setTimeout(() => loadingOverlay.remove(), 500); // Remove after fade out
        playIntroVideo('./assets/intro.mp4', showStartScreenAfterLoad);
    }, delay);
};

let animatee = true;

// Load sky texture as background
const textureLoader = new THREE.TextureLoader(manager);
textureLoader.load('/models/sky.jpeg', (texture) => {
    texture.encoding = THREE.sRGBEncoding;
    scene.background = texture;
});

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false; // <-- Set autoClear to false HERE
document.body.appendChild(renderer.domElement);
// REMOVED mapRenderer - Use only one renderer

// === First-Person Controls (from west.js) ===
let mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;
let isFirstPerson = false;
const CAMERA_TOGGLE_KEY = 'v';
const moveSpeed = 5.0;

// Request pointer lock only in first-person mode
document.body.addEventListener('click', () => {
	if (!renderer) return;
	if (isFirstPerson && document.pointerLockElement !== renderer.domElement) {
		try { renderer.domElement.requestPointerLock(); } catch (e) { console.warn('Pointer lock request failed:', e); }
	}
});

// Sync OrbitControls enabled state with pointer lock and mode
document.addEventListener('pointerlockchange', () => {
	if (!renderer) return;
	const locked = document.pointerLockElement === renderer.domElement;
	// In first-person, OrbitControls should always be disabled
	orbitControls.enabled = !isFirstPerson && !locked;
});

// Clock and key handling
const clock = new THREE.Clock();
const keysPressed = {};
document.addEventListener("keydown", e => keysPressed[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keysPressed[e.key.toLowerCase()] = false);

// OrbitControls (debug)
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// === Mouse look (FPS only) ===
document.addEventListener('mousemove', (e) => {
	if (isFirstPerson && document.pointerLockElement === renderer.domElement) {
		yaw -= e.movementX * mouseSensitivity;
		pitch -= e.movementY * mouseSensitivity;
		pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
	}
});

// === FPS movement update ===
function updateFirstPersonCamera(delta) {
	if (!isFirstPerson) return;
	const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
	const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
	const finalQuat = new THREE.Quaternion();
	finalQuat.multiplyQuaternions(qYaw, qPitch);
	camera.quaternion.copy(finalQuat);

	const moveVector = new THREE.Vector3();
	if (keysPressed['w']) moveVector.z -= 1;
	if (keysPressed['s']) moveVector.z += 1;
	if (keysPressed['a']) moveVector.x -= 1;
	if (keysPressed['d']) moveVector.x += 1;
	if (moveVector.length() > 0) {
		moveVector.normalize();
		const moveQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
		moveVector.applyQuaternion(moveQuat);
		moveVector.multiplyScalar(moveSpeed * delta);
		camera.position.add(moveVector);
	}
}

// === Toggle camera mode ===
function toggleCameraMode() {
	isFirstPerson = !isFirstPerson;
	if (isFirstPerson) {
		if (characterControls && characterControls.model) {
			const charPos = new THREE.Vector3();
			characterControls.model.getWorldPosition(charPos);
			camera.position.copy(charPos);
			camera.position.y = charPos.y + 1.5;
			yaw = characterControls.model.rotation.y;
			pitch = 0;
			characterControls.model.visible = false;
		}
		else {
			// Fallback if character not available: initialize yaw from current camera heading
			const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
			yaw = euler.y; pitch = 0;
		}
		orbitControls.enabled = false;
		try { renderer.domElement.requestPointerLock(); } catch {}
		console.log('Switched to first-person view (free camera)');
	} else {
		if (characterControls && characterControls.model) {
			characterControls.model.position.copy(camera.position);
			characterControls.model.position.y = 0.1;
			characterControls.model.rotation.y = yaw;
			characterControls.model.visible = true;
			const offset = new THREE.Vector3(0, 2, 5);
			offset.applyQuaternion(characterControls.model.quaternion);
			camera.position.copy(characterControls.model.position.clone().add(offset));
			camera.lookAt(characterControls.model.position);
		}
		if (document.pointerLockElement === renderer.domElement) {
			try { document.exitPointerLock(); } catch {}
		}
		orbitControls.enabled = true;
		if (characterControls && characterControls.model) {
			orbitControls.target.copy(characterControls.model.position);
		}
		console.log('Switched to third-person view');
	}
}

// Lights
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// === UI: Message Overlay === (Keep your existing setupMessageOverlay, showMessage functions)
// ... (paste those functions here) ...
let messageEl = null;
function setupMessageOverlay() {
    messageEl = document.createElement('div');
    messageEl.className = 'message-overlay';
    document.body.appendChild(messageEl);
}
function showMessage(text, ms = 2000) {
    if (!messageEl) setupMessageOverlay();
    messageEl.textContent = text;
    messageEl.classList.add('is-visible');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => {
        messageEl.classList.remove('is-visible');
    }, ms);
}
//----------------------------------

setupMessageOverlay(); // Call it once

// === Start Screen (Instructions) === (Keep your existing setupStartOverlay function)
// ... (paste setupStartOverlay function here) ...
function setupStartOverlay() {
    const overlay = document.createElement('div'); overlay.id = 'start-overlay';
    const text = document.createElement('div'); text.className = 'start-text'; text.textContent = 'Find the report and submit it before time runs out. NOTE, there are multiple challenges in the way. PLAY!';
    const btn = document.createElement('button'); btn.className = 'start-btn'; btn.textContent = 'PLAY';
    btn.addEventListener('click', () => { gameStarted = true; gameEnded = false; timeMsLeft = timeMsTotal; persistTimerState(true); overlay.remove(); });
    overlay.appendChild(text); overlay.appendChild(btn); document.body.appendChild(overlay);
    setupHUD(); // Make sure HUD is set up when game starts
}
//----------------------------------
// === Collectibles: Reports ===
const paperBoxes = []; const papers = []; let reportsCollected = 0; const totalReports = 3; let allReportsAnnounced = false;
function spawnPapers() {
    const positions = [ new THREE.Vector3(1.2, 1.5, 2.5), new THREE.Vector3(-2.0, 1.5, -1.5), new THREE.Vector3(3.0, 1.5, -3.0) ];
    const geo = new THREE.PlaneGeometry(0.6, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    positions.slice(0, totalReports).forEach((pos) => {
        const paper = new THREE.Mesh(geo, mat.clone());
        paper.rotation.x = -Math.PI / 2;
        paper.position.copy(pos);
        paper.castShadow = false; paper.receiveShadow = true; paper.userData.collected = false;
        scene.add(paper);
        papers.push(paper);
        paperBoxes.push(new THREE.Box3());
    });
}
//----------------------------------

// === Timer Persistence Helpers ===
const TIMER_KEY = 'gameTimer';
function readPersistedTimer() {
    try {
        const raw = localStorage.getItem(TIMER_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj.timeMsLeft !== 'number') return null;
        const last = typeof obj.lastUpdate === 'number' ? obj.lastUpdate : Date.now();
        const running = !!obj.running;
        let left = obj.timeMsLeft;
        if (running) {
            const delta = Date.now() - last;
            left = Math.max(0, left - delta);
        }
        return { timeMsLeft: left };
    } catch { return null; }
}
function persistTimerState(running) {
    try {
        localStorage.setItem(TIMER_KEY, JSON.stringify({ timeMsLeft, lastUpdate: Date.now(), running: !!running }));
    } catch {}
}

// === HUD (rich controls) ===
let hudEl = null; let hudTextEl = null; let pauseBtn = null; let playBtn = null; let timeMsTotal = 180 * 1000; let timeMsLeft = (readPersistedTimer()?.timeMsLeft) ?? (timeMsTotal); let gameEnded = false; let gamePaused = false;
export function setupHUD() {
    // Main HUD container
    hudEl = document.createElement('div');
    hudEl.className = 'hud';

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';

    // Progress bar (time)
    const progressBar = document.createElement('div');
    progressBar.id = 'time-progress-bar';
    progressBar.className = 'time-progress-bar';
    progressContainer.appendChild(progressBar);

    // Main content row
    const mainContentRow = document.createElement('div');
    mainContentRow.className = 'main-content-row';

    // Reports Tracker
    const reportsContainer = document.createElement('div');
    reportsContainer.className = 'reports-container';
    const reportsLabel = document.createElement('div');
    reportsLabel.className = 'reports-label';
    reportsLabel.textContent = 'REPORTS:';
    const reportsCounter = document.createElement('div');
    reportsCounter.id = 'reports-counter';
    reportsCounter.className = 'reports-counter';
    reportsContainer.appendChild(reportsLabel);
    reportsContainer.appendChild(reportsCounter);
    mainContentRow.appendChild(reportsContainer);

    // Controls container
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';

    // Pause Button
    pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn btn--pause';
    pauseBtn.textContent = '⏸ PAUSE';
    pauseBtn.addEventListener('click', () => {
        if (!gameStarted || gameEnded) return;
        gamePaused = true;
        persistTimerState(false);
    });

    // Play Button
    playBtn = document.createElement('button');
    playBtn.className = 'btn btn--play';
    playBtn.textContent = '▶ PLAY';
    playBtn.addEventListener('click', () => {
        if (gameEnded) return;
        gameStarted = true;
        gamePaused = false;
        persistTimerState(true);
    });

    const ctrlBtn = document.createElement('button');
    ctrlBtn.className = 'ctrl-btn';
    ctrlBtn.textContent = '⌨ CONTROLS';
    const controlsPanel = document.createElement('div');
    controlsPanel.id = 'controls-panel';
    controlsPanel.className = 'controls-panel is-hidden';
    controlsPanel.setAttribute('role', 'dialog');
    controlsPanel.setAttribute('aria-modal', 'false');
    controlsPanel.innerHTML = `<div class="controls-panel__header"><strong>Game Controls</strong><button class="controls-panel__close" aria-label="Close controls">✕</button></div><ul class="controls-panel__list"><li><kbd>W/A/S/D</kbd> or <kbd>Arrow Keys</kbd> — Move</li><li><kbd>Space</kbd> — Action / Interact</li><li><kbd>Shift</kbd> — Sprint</li><li><kbd>P</kbd> — Pause</li><li><kbd>M</kbd> — Mute/Unmute</li><li><kbd>?</kbd> — Toggle Controls</li></ul>`;
    const closeBtn = controlsPanel.querySelector('.controls-panel__close');
    const toggleControls = (forceState) => {
        const isHidden = controlsPanel.classList.contains('is-hidden');
        const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;
        controlsPanel.classList.toggle('is-hidden', !shouldOpen);
        ctrlBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    };
    ctrlBtn.addEventListener('click', () => toggleControls());
    closeBtn.addEventListener('click', () => toggleControls(false));
    document.addEventListener('keydown', (e) => {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleControls();
        if (e.key === 'Escape') toggleControls(false);
    });

    controlsRow.appendChild(playBtn);
    controlsRow.appendChild(pauseBtn);
    controlsRow.appendChild(ctrlBtn);

    hudEl.appendChild(progressContainer);
    hudEl.appendChild(mainContentRow);
    hudEl.appendChild(controlsRow);
    hudEl.appendChild(controlsPanel);
    document.body.appendChild(hudEl);
    updateHUD();
}

function formatTime(ms) { const totalSec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(totalSec / 60).toString().padStart(2, '0'); const s = (totalSec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }

function updateHUD() {
    const reportsCounter = document.getElementById('reports-counter'); if (reportsCounter) { reportsCounter.textContent = `${reportsCollected}/${totalReports}`; }
    const progressBar = document.getElementById('time-progress-bar'); if (progressBar) { const progressPercent = (timeMsLeft / timeMsTotal) * 100; progressBar.style.width = `${Math.max(0, progressPercent)}%`; progressBar.classList.remove('time-progress-bar--ok', 'time-progress-bar--mid', 'time-progress-bar--low'); if (progressPercent < 25) { progressBar.classList.add('time-progress-bar--low'); } else if (progressPercent < 50) { progressBar.classList.add('time-progress-bar--mid'); } else { progressBar.classList.add('time-progress-bar--ok'); } }
}
//----------------------------------

spawnPapers(); // Call after scene setup

// === Load Environment === (Keep existing loader code)
// ... (paste environment loader code here) ...
const loader = new GLTFLoader(manager); let environment, obstacles = [], teleportTarget;
loader.load("/models/Gamestates.glb", (gltf) => {
    environment = gltf.scene; scene.add(environment);
    environment.traverse((child) => {
        if (child.isMesh) {
            child.geometry.computeBoundingBox();
            if (child.name.startsWith("Cube") || child.name.startsWith("Cylinder")) {
                const bbox = new THREE.Box3().setFromObject(child); obstacles.push(bbox);
                // const helper = new THREE.Box3Helper(bbox, 0xff0000); scene.add(helper); // Keep helpers for debugging if needed
            }
            if (child.name === "Plane001") {
                teleportTarget = new THREE.Box3().setFromObject(child);
                // const helper = new THREE.Box3Helper(teleportTarget, 0x00ff00); scene.add(helper); // Keep helpers for debugging if needed
            }
        }
    });
});
//----------------------------------

// === Load Soldier === (Keep existing loader code)
// ... (paste soldier loader code here) ...
let characterControls;
loader.load("/models/Soldier.glb", (gltf) => {
    const model = gltf.scene; model.scale.set(1, 1, 1); model.position.set(0, 0.1, 3); scene.add(model);
    const mixer = new THREE.AnimationMixer(model); const animationsMap = new Map();
    gltf.animations.forEach(clip => animationsMap.set(clip.name, mixer.clipAction(clip)));
    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, "Idle");
    // Set initial map camera position after player loads if needed
    // mapCamera.position.set(model.position.x, 100, model.position.z);
    // mapCamera.lookAt(model.position.x, 0, model.position.z);
});
//----------------------------------


// === Collision Check === (Keep existing checkCollisions function)
// ... (paste checkCollisions function here) ...
function checkCollisions(character) {
    if (!obstacles.length && !teleportTarget && !papers.length) return false; // Optimization
    const charBox = new THREE.Box3().setFromObject(character); charBox.expandByScalar(-0.1); // Shrink slightly if needed

    for (let obstacle of obstacles) { if (charBox.intersectsBox(obstacle)) return true; }

    if (teleportTarget && charBox.intersectsBox(teleportTarget)) { if (reportsCollected >= totalReports) { teleportToMiniChallenge(); } else { showMessage('Collect all 3 reports'); } }

    for (let i = 0; i < papers.length; i++) {
        const p = papers[i]; if (!p || p.userData.collected) continue;
        paperBoxes[i].setFromObject(p);
        if (charBox.intersectsBox(paperBoxes[i])) {
            p.userData.collected = true; reportsCollected++; updateHUD(); showMessage('Report found!');
            scene.remove(p); p.geometry.dispose(); if (p.material.dispose) p.material.dispose(); papers[i] = null;
            if (!allReportsAnnounced && reportsCollected >= totalReports) { allReportsAnnounced = true; showMessage('All reports collected! Go through the portal.'); }
        }
    }
    return false;
}
//----------------------------------

// === Teleport Function === (Keep existing teleportToMiniChallenge and loadCarcross functions)
// ... (paste teleportToMiniChallenge and loadCarcross functions here) ...
function teleportToMiniChallenge() {
    const state = { reportsCollected, totalReports, timeMsLeft, }; localStorage.setItem("gameState", JSON.stringify(state));
    persistTimerState(true);
    gamePaused = true; gameStarted = false; gameEnded = true; animatee = false;
    loadCarcross(); // Removed callback as it wasn't used
}
function loadCarcross() { // Consider adding error handling for image load
    const overlay = document.createElement('div'); overlay.id = 'loadingCC-overlay'; overlay.className = 'loading-overlay is-visible'; // Add is-visible
    const img = document.createElement('img'); img.id = 'loadingCC-image'; img.src = '/models/carcross.png'; img.alt = 'Carcross Loading'; overlay.appendChild(img);
    const progressContainer = document.createElement('div'); progressContainer.id = 'loadingCC-progress-container'; progressContainer.className = 'loading-progress-container'; overlay.appendChild(progressContainer); // check CSS for this class
    const progressBar = document.createElement('div'); progressBar.id = 'loadingCC-progress-bar'; progressBar.className = 'loading-progress-bar'; progressContainer.appendChild(progressBar); // check CSS for this class
    document.body.appendChild(overlay);
    let simulatedProgress = 0; const loadDuration = 3000; const step = 50; // Shortened duration
    const interval = setInterval(() => {
        simulatedProgress += (step / loadDuration) * 100; simulatedProgress = Math.min(simulatedProgress, 100);
        progressBar.style.width = `${simulatedProgress}%`;
        if (simulatedProgress >= 100) {
            clearInterval(interval);
            overlay.style.opacity = 0;
            overlay.classList.remove('is-visible'); // For CSS transitions
            setTimeout(() => overlay.remove(), 500);
            window.location.href = "http://localhost:5173/carcross.html";
        }
    }, step);
}
//----------------------------------

// === Animate Loop ===
function animate() {
    if (!animatee) return; // Allows stopping the loop
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

	// --- 1. Update Game Logic & Player ---
	if (isFirstPerson) {
		if (gameStarted && !gameEnded && !gamePaused) {
			updateFirstPersonCamera(delta);
		}
	} else if (characterControls && gameStarted && !gameEnded && !gamePaused) {
		const oldPos = characterControls.model.position.clone();
		characterControls.update(delta, keysPressed);

		// --- 1a. Update Map Camera Position ---
		mapCamera.position.set(
			characterControls.model.position.x,
			100, // Keep height constant
			characterControls.model.position.z
		);
		mapCamera.lookAt(
			characterControls.model.position.x,
			0,   // Look at ground level
			characterControls.model.position.z
		);
		// mapCamera.updateProjectionMatrix(); // Only needed if Left/Right/Top/Bottom/Near/Far change

		// --- 1b. Collision Check & Revert ---
		if (checkCollisions(characterControls.model)) {
			characterControls.model.position.copy(oldPos);
			// Re-update map camera if position reverted
			mapCamera.position.set(
				characterControls.model.position.x,
				100,
				characterControls.model.position.z
			);
			mapCamera.lookAt(
				characterControls.model.position.x,
				0,
				characterControls.model.position.z
			);
		}
	}

    // --- 2. Update Timer & HUD ---
    if (gameStarted && !gameEnded && !gamePaused) {
        timeMsLeft -= delta * 1000;
        if (timeMsLeft <= 0) {
            timeMsLeft = 0;
            gameEnded = true;
            gameStarted = false; // Stop game logic
            showTimesUp();
        }
        updateHUD();
        persistTimerState(true);
    }

    if (!isFirstPerson) orbitControls.update(); // Disable orbit update in FPS

    // --- 3. Render Main Scene (Full Screen) ---
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear(true, true); // Clear color and depth buffer
    renderer.render(scene, camera); // Use the main perspective camera

    // --- 4. Render Minimap (Small Corner) ---
    renderer.setScissorTest(true);

    const mapLeft = window.innerWidth - mapHeightPx - mapMargin;
    const mapBottom = mapMargin; //

    renderer.setScissor(mapLeft, mapBottom, mapWidthPx, mapHeightPx);
    renderer.setViewport(mapLeft, mapBottom, mapWidthPx, mapHeightPx);

    renderer.clearDepth(); // Clear only the depth buffer in this rectangle

    renderer.render(scene, mapCamera); // Render the SAME scene with the map camera

    renderer.setScissorTest(false);
}

// === Start Animation ===
animate(); // Start the loop

// === Window Resize === (Keep existing resize listener)
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // mapCamera aspect ratio doesn't change based on window resize,
    // but viewport *position* might if you anchor differently.
    // For top-left corner, only renderer size needs update.
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Camera toggle key ===
document.addEventListener("keydown", (e) => {
	if (e.key.toLowerCase() === CAMERA_TOGGLE_KEY) toggleCameraMode();
});

// === Times Up / Restart === (Keep existing showTimesUp and restart functions)
// ... (paste showTimesUp and restart functions here) ...
function showTimesUp() {
    const overlay = document.createElement('div'); overlay.className = 'timesup-overlay'; // Ensure this class is styled
    const msg = document.createElement('h1'); msg.textContent = 'Times Up!'; overlay.appendChild(msg);
    restart(overlay); document.body.appendChild(overlay);
}
function restart(attachment) {
    const btn = document.createElement('button'); btn.className = 'restart-btn'; // Ensure this class is styled
    btn.textContent = 'Restart'; btn.onclick = () => location.reload(); attachment.appendChild(btn);
}
//----------------------------------