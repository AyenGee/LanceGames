import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

/* =========================
   GAME STATE
========================= */
const savedState = JSON.parse(localStorage.getItem('gameState') || '{}');
let reportsCollected = savedState.reportsCollected || 0;
let totalReports = savedState.totalReports || 3;
// Shared timer persistence
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
function persistTimerState(timeMsLeft, running) {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify({ timeMsLeft, lastUpdate: Date.now(), running: !!running })); } catch {}
}
let timeMsTotal = 180000;
let timeMsLeft = (readPersistedTimer()?.timeMsLeft) ?? (timeMsTotal);
let gameStarted = false;
let gamePaused = false;
let gameEnded = false;
let allReportsAnnounced = false;

let introCamAnimating = false;
let introCamT = 0;
const introCamDuration = 1.2; // seconds
const introStartEye = new THREE.Vector3();
const introStartTarget = new THREE.Vector3();
const introEndEye = new THREE.Vector3();
const introEndTarget = new THREE.Vector3();

/* =========================
   THREE CORE
========================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 3.5, 7);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.autoClear = false; // we render scene, then minimap
document.body.appendChild(renderer.domElement);

/* =========================
   HUD (structured UI)
========================= */
const hud = document.createElement('div');
hud.className = 'hud';

// Progress (time) bar
const progressContainer = document.createElement('div');
progressContainer.className = 'progress-container';
Object.assign(progressContainer.style, {
  width: '100%',
  height: '8px',
  background: 'rgba(255,255,255,0.15)',
  borderRadius: '999px',
  overflow: 'hidden',
});
const progressBar = document.createElement('div');
progressBar.id = 'time-progress-bar';
progressBar.className = 'time-progress-bar';
Object.assign(progressBar.style, {
  width: '100%',
  height: '100%',
  background: '#00a86b',
  transition: 'width 0.2s linear',
});
progressContainer.appendChild(progressBar);

const hudText = document.createElement('div');
hudText.className = 'hud-text';

// Main content row
const mainContentRow = document.createElement('div');
mainContentRow.className = 'main-content-row';
Object.assign(mainContentRow.style, {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  justifyContent: 'space-between',
});

// Reports block
const reportsContainer = document.createElement('div');
reportsContainer.className = 'reports-container';
const reportsLabel = document.createElement('div');
reportsLabel.className = 'reports-label';
reportsLabel.textContent = 'REPORTS:';
const reportsCounter = document.createElement('div');
reportsCounter.id = 'reports-counter';
reportsCounter.className = 'reports-counter';
Object.assign(reportsLabel.style, { opacity: '0.8', fontSize: '12px', letterSpacing: '0.5px' });
Object.assign(reportsCounter.style, { fontWeight: '700', marginTop: '2px' });
reportsContainer.appendChild(reportsLabel);
reportsContainer.appendChild(reportsCounter);
mainContentRow.appendChild(reportsContainer);

// Time block
const timeContainer = document.createElement('div');
timeContainer.className = 'time-container';
const timeLabel = document.createElement('div');
timeLabel.className = 'time-label';
timeLabel.textContent = 'TIME:';
const timeValue = document.createElement('div');
timeValue.id = 'time-value';
timeValue.className = 'time-value';
Object.assign(timeLabel.style, { opacity: '0.8', fontSize: '12px', letterSpacing: '0.5px' });
Object.assign(timeValue.style, { fontWeight: '700', marginTop: '2px' });
timeContainer.appendChild(timeLabel);
timeContainer.appendChild(timeValue);
mainContentRow.appendChild(timeContainer);

// Controls row
const controlsRow = document.createElement('div');
controlsRow.className = 'controls-row';
Object.assign(controlsRow.style, {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
});

// Buttons
const pauseBtn = document.createElement('button');
pauseBtn.className = 'btn btn--pause';
pauseBtn.textContent = '⏸ PAUSE';

const playBtn = document.createElement('button');
playBtn.className = 'btn btn--play';
playBtn.textContent = '▶ PLAY';

const ctrlBtn = document.createElement('button');
ctrlBtn.className = 'btn btn-ctrl';
ctrlBtn.textContent = '⌨ CONTROLS';

const rstBtn = document.createElement('button');
rstBtn.className = 'btn btn-rst';
rstBtn.textContent = '↻ RESTART';

controlsRow.appendChild(playBtn);
controlsRow.appendChild(pauseBtn);
controlsRow.appendChild(ctrlBtn);
controlsRow.appendChild(rstBtn);

// Controls panel (hidden by default)
const controlsPanel = document.createElement('div');
controlsPanel.id = 'controls-panel';
controlsPanel.className = 'controls-panel is-hidden';
controlsPanel.setAttribute('role', 'dialog');
controlsPanel.setAttribute('aria-modal', 'false');
Object.assign(controlsPanel.style, {
  display: 'none',
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(0,0,0,.45)',
  padding: '12px',
  borderRadius: '10px',
});
controlsPanel.innerHTML = `
  <h3 style="margin:0 0 8px 0">Controls</h3>
  <ul style="margin:0;padding-left:16px;line-height:1.5">
    <li><strong>W/A/S/D</strong> or <strong>Arrow keys</strong> to move</li>
    <li><strong>Space</strong> to toggle run</li>
    <li><strong>?</strong> to open/close this panel</li>
    <li><strong>Esc</strong> to close this panel</li>
  </ul>
`;

// Text fallback line (optional)
const hudText = document.createElement('div');
hudText.className = 'hud-text';
hudText.style.opacity = '0.85';

// Build HUD
hud.appendChild(progressContainer);
hud.appendChild(mainContentRow);
hud.appendChild(controlsRow);
hud.appendChild(controlsPanel);
hud.appendChild(hudText);
document.body.appendChild(hud);

// HUD positioning (inline)
Object.assign(hud.style, {
  position: 'fixed',
  top: '10px',
  right: '20px',
  zIndex: '9999',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px 16px',
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontFamily: 'sans-serif',
  fontSize: '15px',
  borderRadius: '10px',
  boxShadow: '0 8px 24px rgba(0,0,0,.35)',
  backdropFilter: 'blur(6px)',
  width: '360px',
  minHeight: '120px'
});

// Minimal inline styles for .btn
[playBtn, pauseBtn, ctrlBtn, rstBtn].forEach(b => {
  Object.assign(b.style, {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.07)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600'
  });
});
Object.assign(playBtn.style, { background: '#00a86b', border: 'none' });
Object.assign(pauseBtn.style, { background: '#cc3333', border: 'none' });

// Controls panel toggling
function setControlsPanel(open) {
  const isOpen = open ?? (controlsPanel.style.display === 'none');
  controlsPanel.style.display = isOpen ? 'block' : 'none';
  ctrlBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}
ctrlBtn.addEventListener('click', () => setControlsPanel());

// Keyboard toggles for controls panel
document.addEventListener('keydown', (e) => {
  if (e.key === '?' || (e.shiftKey && e.key === '/')) setControlsPanel();
  if (e.key === 'Escape') setControlsPanel(false);
});

// Button behavior
function setButtonsState() {
  playBtn.disabled = !gamePaused || gameEnded;  // play is enabled only when paused and not ended
  pauseBtn.disabled = gamePaused || !gameStarted || gameEnded;
  rstBtn.disabled = false;
}
playBtn.addEventListener('click', () => {
  if (gameEnded) return;
  gameStarted = true;
  gamePaused = false;
  setButtonsState();
  persistTimerState(timeMsLeft, true);
});
pauseBtn.addEventListener('click', () => {
  if (!gameStarted || gameEnded) return;
  gamePaused = true;
  setButtonsState();
  persistTimerState(timeMsLeft, false);
});
rstBtn.addEventListener('click', () => {
  // Save state if you want, or just hard reload
  window.location.reload();
});
setButtonsState();

/* =========================
   ARRIVAL OVERLAY
========================= */
gamePaused = true;
(function setupArrivalOverlay() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontFamily: 'sans-serif',
    textAlign: 'center',
    padding: '24px',
    zIndex: '10000',
  });

  const text = document.createElement('div');
  Object.assign(text.style, {
    maxWidth: '720px',
    lineHeight: '1.6',
    fontSize: '18px',
    marginBottom: '16px',
  });
  text.textContent = "Oh no, you'll have to go through the cars before you can proceed.";

  const btn = document.createElement('button');
  btn.textContent = 'CONTINUE';
  Object.assign(btn.style, {
    cursor: 'pointer',
    padding: '10px 18px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '6px',
    background: '#00a86b',
    color: '#fff',
  });
  btn.addEventListener('click', () => {
    gamePaused = false;
    gameStarted = true;
    setButtonsState();

    // Camera intro animation setup
    introCamAnimating = true;
    introCamT = 0;
    introStartEye.copy(camera.position);
    // controls defined below; click happens later so it's fine
    introStartTarget.copy(controls.target);
    const base = playerModel ? playerModel.position : new THREE.Vector3();
    introEndEye.set(base.x - 7, (playerModel ? playerModel.position.y : 0) + 3.5, base.z);
    introEndTarget.set(base.x, (playerModel ? playerModel.position.y : 0) + 1, base.z);
    overlay.remove();
    persistTimerState(timeMsLeft, true);
  });

  overlay.appendChild(text);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
})();

/* =========================
   HUD LOGIC
========================= */
function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(Number(ms) / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateHud() {
  // text fallback
  hudText.textContent = `Reports: ${reportsCollected}/${totalReports} | Time: ${formatTime(timeMsLeft)}`;
  // numeric sections
  reportsCounter.textContent = `${reportsCollected} / ${totalReports}`;
  timeValue.textContent = formatTime(timeMsLeft);
  // progress bar
  const pb = document.getElementById('time-progress-bar');
  if (pb) {
    const progressPercent = (timeMsLeft / timeMsTotal) * 100;
    pb.style.width = `${Math.max(0, progressPercent)}%`;
    pb.classList.remove('time-progress-bar--ok', 'time-progress-bar--mid', 'time-progress-bar--low');
    if (progressPercent < 25) { pb.classList.add('time-progress-bar--low'); }
    else if (progressPercent < 50) { pb.classList.add('time-progress-bar--mid'); }
    else { pb.classList.add('time-progress-bar--ok'); }
  }
  if (!allReportsAnnounced && reportsCollected >= totalReports) {
    allReportsAnnounced = true;
    const tip = document.createElement('div');
    tip.textContent = 'All reports collected! Go through the portal.';
    tip.style.marginTop = '4px';
    tip.style.opacity = '0.9';
    hud.appendChild(tip);
  }
}
updateHud();

/* =========================
   LIGHTS & GROUND
========================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const sun = new THREE.DirectionalLight(0xfff2cc, 1.1);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 150;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.001;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshPhongMaterial({ color: 0x5e8056 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* =========================
   HELPERS
========================= */
function addAxisGuides() {
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const makeLine = (a, b) => {
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geom, material);
    line.renderOrder = 1;
    return line;
  };
  const L = 200;
  scene.add(makeLine(new THREE.Vector3(-L, 0, 0), new THREE.Vector3(L, 0, 0)));
  scene.add(makeLine(new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0)));
  scene.add(makeLine(new THREE.Vector3(0, 0, -L), new THREE.Vector3(0, 0, L)));

  const axes = new THREE.AxesHelper(5);
  axes.position.set(0, 0.01, 0);
  axes.renderOrder = 2;
  scene.add(axes);
}
addAxisGuides();

function setShadowFlags(object3d) {
  object3d.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function focusCameraOnPlayer() {
  if (!playerModel) return;
  const eye = new THREE.Vector3(
    playerModel.position.x,
    playerModel.position.y + 3.5,
    playerModel.position.z + 7
  );
  const tgt = new THREE.Vector3(
    playerModel.position.x,
    playerModel.position.y + 1,
    playerModel.position.z
  );
  camera.position.copy(eye);
  controls.target.copy(tgt);
}

function findByNameDeep(root, nameLower) {
  let found = null;
  root.traverse((child) => {
    if (found) return;
    const n = (child.name || '').toLowerCase();
    if (n === nameLower) found = child;
  });
  return found;
}

/* =========================
   CONTROLS
========================= */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1, 0);

/* =========================
   LOADER / WORLD
========================= */
const loader = new GLTFLoader();

// Vehicle templates & lanes
let carTemplates = [];
let laneSpecs = [];
const lanes = [];
let worldBounds = null; // { minX, maxX, minZ, maxZ }
let teleportTarget = null; // Cube002 area for teleport

function cloneVehicle(template, x, z) {
  if (!template) return null;
  const clone = template.clone(true);
  setShadowFlags(clone);
  clone.traverse((obj) => { obj.visible = true; obj.frustumCulled = false; });
  clone.position.set(x, 0, z);

  // Sit on ground
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  if (isFinite(box.min.y)) {
    const lift = -box.min.y + 0.01;
    clone.position.y += lift;
  }
  scene.add(clone);
  return clone;
}

function buildLanes() {
  laneSpecs.forEach((spec) => {
    if (carTemplates.length === 0) return;
    const template = carTemplates[Math.floor(Math.random() * carTemplates.length)];
    if (!template) return;

    const vehicles = [];
    const laneLength = Math.max(1, Math.abs(spec.maxZ - spec.minZ));
    const spacing = Math.max(4, spec.spacing || 10);
    const computedCount = Math.max(3, Math.floor(laneLength / spacing));
    const count = spec.count && spec.count > 0 ? spec.count : computedCount;
    for (let i = 0; i < count; i++) {
      const z = spec.startZ + (spec.dir > 0 ? i * spacing : -i * spacing);
      const mesh = cloneVehicle(template, spec.x, z);
      if (mesh) vehicles.push({ mesh, speed: spec.speed, dir: spec.dir });
    }
    lanes.push({ x: spec.x, vehicles, minZ: spec.minZ, maxZ: spec.maxZ });
  });
}

/* Inspect carcross.glb (optional) */
loader.load(
  '/models/carcross.glb',
  (gltf) => {
    console.log('🔍 === CARCROSS.GLB OBJECT NAMES ===');
    gltf.scene.traverse((obj) => {
      console.log(`Name: "${obj.name}" | Type: ${obj.type}`);
    });
    console.log('🔍 === END CARCROSS.GLB LISTING ===');
  },
  undefined,
  (err) => console.error('Failed to load carcross.glb', err)
);

/* Load Environment */
loader.load(
  '/models/scene.glb',
  (gltf) => {
    const env = gltf.scene;
    setShadowFlags(env);
    scene.add(env);

    // World bounds
    const envBox = new THREE.Box3().setFromObject(env);
    worldBounds = {
      minX: envBox.min.x,
      maxX: envBox.max.x,
      minZ: envBox.min.z,
      maxZ: envBox.max.z,
    };

    // Find car templates (cube016..cube026)
    carTemplates = [];
    env.traverse((obj) => {
      const n = (obj.name || '').toLowerCase();
      if (/^cube0(1[6-9]|2[0-6])$/.test(n)) {
        carTemplates.push(obj);
      }
    });

    if (carTemplates.length === 0) {
      console.warn('⚠️ No car templates (cube016..cube026) found in scene.glb');
    } else {
      console.log(`✅ Found ${carTemplates.length} car templates:`, carTemplates.map(o => o.name));
      carTemplates.forEach(t => (t.visible = false)); // hide originals
    }

    // Lanes (cube008 & cube009)
    const laneNames = ['cube008', 'cube009'];
    const foundLanes = [];
    laneNames.forEach((lname) => {
      const laneObj = findByNameDeep(env, lname);
      if (laneObj) {
        const box = new THREE.Box3().setFromObject(laneObj);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const minZ = Math.min(box.min.z, box.max.z);
        const maxZ = Math.max(box.min.z, box.max.z);
        const laneWidthX = Math.abs(box.max.x - box.min.x);
        const xLeft = center.x - laneWidthX * 0.25;
        const xRight = center.x + laneWidthX * 0.25;
        foundLanes.push({ x: center.x, minZ, maxZ, xLeft, xRight });
      }
    });

    // Spawn from 'cube'
    const startMesh = findByNameDeep(env, 'cube');
    if (startMesh) {
      const startBox = new THREE.Box3().setFromObject(startMesh);
      const startCenter = new THREE.Vector3();
      startBox.getCenter(startCenter);
      playerStart = new THREE.Vector3(startCenter.x, startBox.max.y + 0.02, startCenter.z);
      console.log('Spawn set from Cube at', playerStart);
      if (playerModel) {
        playerModel.position.copy(playerStart);
      }
    } else {
      console.warn('Mesh named "Cube" not found for spawn.');
    }

    // Teleport trigger from 'cube002'
    const cube002 = findByNameDeep(env, 'cube002');
    if (cube002) {
      cube002.updateMatrixWorld(true);
      teleportTarget = new THREE.Box3().setFromObject(cube002);
      // Extend vertically to ensure intersection
      teleportTarget.min.y -= 1000;
      teleportTarget.max.y += 1000;

      const helper = new THREE.Box3Helper(teleportTarget, 0x00ff88);
      scene.add(helper);
      console.log('✅ Teleport target (Cube002) found');
    } else {
      console.warn('⚠️ Cube002 not found for teleport');
    }

    if (foundLanes.length === 0) {
      console.warn('⚠️ Cube008/Cube009 not found. Using fallback lane positions.');
      laneSpecs = [
        { x: -4.0, speed: 9.0,  dir:  1, count: 3, spacing: 18, startZ: -60, minZ: -60, maxZ: 60 },
        { x: -2.0, speed: 12.0, dir: -1, count: 2, spacing: 22, startZ:  60, minZ: -60, maxZ: 60 },
        { x:  2.0, speed: 10.0, dir:  1, count: 2, spacing: 20, startZ: -60, minZ: -60, maxZ: 60 },
        { x:  4.0, speed: 13.0, dir: -1, count: 3, spacing: 18, startZ:  60, minZ: -60, maxZ: 60 },
      ];
    } else {
      laneSpecs = [];
      foundLanes.slice(0, 2).forEach((lane) => {
        const denseSpacing = 10; // tighter spacing to keep lanes occupied
        // Left sub-lane (forward)
        laneSpecs.push({
          x: lane.xLeft, speed: 8.0, dir: 1, count: 0, spacing: denseSpacing,
          startZ: lane.minZ, minZ: lane.minZ, maxZ: lane.maxZ,
        });
        // Right sub-lane (backward)
        laneSpecs.push({
          x: lane.xRight, speed: 8.0, dir: -1, count: 0, spacing: denseSpacing,
          startZ: lane.maxZ, minZ: lane.minZ, maxZ: lane.maxZ,
        });
      });
    }

    buildLanes();
  },
  undefined,
  (err) => console.error('Failed to load environment scene.glb', err)
);

/* Load Character */
let characterControls = null;
let playerModel = null;
let playerStart = null;

loader.load(
  '/models/Soldier.glb',
  (gltf) => {
    playerModel = gltf.scene;
    setShadowFlags(playerModel);
    if (playerStart) playerModel.position.copy(playerStart);
    else playerModel.position.set(0, 0, 0);
    focusCameraOnPlayer();
    scene.add(playerModel);

    const mixer = new THREE.AnimationMixer(playerModel);
    const animationsMap = new Map();
    gltf.animations.forEach((clip) => {
      animationsMap.set(clip.name, mixer.clipAction(clip));
    });

    characterControls = new CharacterControls(
      playerModel,
      mixer,
      animationsMap,
      controls,
      camera,
      'Idle'
    );
  },
  undefined,
  (err) => console.error('Failed to load Soldier.glb', err)
);

/* =========================
   TELEPORT HANDLER
========================= */
function teleportToWest() {
  gamePaused = true;
  gameEnded = true;
  setButtonsState();

  // Save game state
  localStorage.setItem('gameState', JSON.stringify({ reportsCollected, totalReports, timeMsLeft }));
  persistTimerState(timeMsLeft, true);

  // Splash overlay
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    fontFamily: 'sans-serif',
    textAlign: 'center',
    padding: '24px',
    zIndex: '10001',
  });

  const text = document.createElement('div');
  Object.assign(text.style, {
    maxWidth: '720px',
    lineHeight: '1.6',
    fontSize: '20px',
    marginBottom: '20px',
  });
  text.textContent = 'Great Job, but one of your reports is missing signatures from 3 lecturers. Find them at West to get your signatures.';

  const btn = document.createElement('button');
  btn.textContent = 'CONTINUE';
  Object.assign(btn.style, {
    cursor: 'pointer',
    padding: '12px 24px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '6px',
    background: '#00a86b',
    color: '#fff',
  });
  btn.addEventListener('click', () => {
    overlay.style.transition = 'opacity 0.3s';
    overlay.style.opacity = '0';
    setTimeout(() => {
      window.location.href = '/west.html';
    }, 300);
  });

  overlay.appendChild(text);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

/* =========================
   INPUT
========================= */
const keysPressed = {};
document.addEventListener('keydown', (e) => {
  keysPressed[e.key.toLowerCase()] = true;
  if (e.key === ' ') {
    e.preventDefault();
    if (characterControls) characterControls.switchRunToggle();
  }
});
document.addEventListener('keyup', (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});

/* =========================
   MINIMAP
========================= */
const clock = new THREE.Clock();
const mapWidthPx = 200;
const mapHeightPx = 200;
const mapMargin = 20;
const aspect = mapWidthPx / mapHeightPx;
const mapViewSize = 30;

const mapTop = mapViewSize / 2;
const mapBottomParam = -mapViewSize / 2;
const mapLeftParam = -mapViewSize * aspect / 2;
const mapRightParam = mapViewSize * aspect / 2;
const near = 0.1;
const far = 1000;

const mapCamera = new THREE.OrthographicCamera(
  mapLeftParam, mapRightParam, mapTop, mapBottomParam, near, far
);

/* =========================
   ANIMATION LOOP
========================= */
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  // 1) Update character & controls
  if (characterControls && !gameEnded && !gamePaused) {
    characterControls.update(dt, keysPressed);
    if (playerModel) {
      mapCamera.position.set(playerModel.position.x, 50, playerModel.position.z);
      mapCamera.lookAt(playerModel.position.x, 0, playerModel.position.z);
    }
  } else if (!introCamAnimating) {
    controls.update();
  }

  // 2) Intro camera animation
  if (introCamAnimating) {
    introCamT += dt / introCamDuration;
    const t = Math.min(1, introCamT);
    camera.position.lerpVectors(introStartEye, introEndEye, t);
    controls.target.lerpVectors(introStartTarget, introEndTarget, t);
    if (t >= 1) introCamAnimating = false;
  }

  // 3) Clamp player to world
  if (playerModel && worldBounds) {
    const pad = 0.5;
    playerModel.position.x = THREE.MathUtils.clamp(
      playerModel.position.x,
      worldBounds.minX + pad,
      worldBounds.maxX - pad
    );
    playerModel.position.z = THREE.MathUtils.clamp(
      playerModel.position.z,
      worldBounds.minZ + pad,
      worldBounds.maxZ - pad
    );
  }

  // 4) Clamp camera X (skip during intro)
  if (worldBounds && !introCamAnimating) {
    const padCam = 0.5;
    const minX = worldBounds.minX + padCam;
    const maxX = worldBounds.maxX - padCam;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, minX, maxX);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, minX, maxX);
  }

  // 5) Move vehicles
  if (!gameEnded && !gamePaused) {
    lanes.forEach((lane) => {
      lane.vehicles.forEach((v) => {
        v.mesh.position.z += v.speed * dt * v.dir;
        if (v.dir > 0 && v.mesh.position.z > lane.maxZ) v.mesh.position.z = lane.minZ;
        if (v.dir < 0 && v.mesh.position.z < lane.minZ) v.mesh.position.z = lane.maxZ;
      });
    });
  }

  // 6) Collisions + teleport
  if (playerModel && !gameEnded && !gamePaused) {
    const playerBox = new THREE.Box3().setFromObject(playerModel);

    if (teleportTarget && playerBox.intersectsBox(teleportTarget)) {
      teleportToWest();
    }

    let hit = false;
    outer: for (const lane of lanes) {
      for (const v of lane.vehicles) {
        const box = new THREE.Box3().setFromObject(v.mesh);
        if (playerBox.intersectsBox(box)) { hit = true; break outer; }
      }
    }
    if (hit) {
      if (playerStart) playerModel.position.copy(playerStart);
      else playerModel.position.set(0, 0, 0);
      mapCamera.position.set(playerModel.position.x, 50, playerModel.position.z);
      mapCamera.lookAt(playerModel.position.x, 0, playerModel.position.z);
    }
  }

  // 7) Timer & HUD
  if (!gameEnded && !gamePaused && gameStarted) {
    timeMsLeft -= dt * 1000;
    if (timeMsLeft <= 0) {
      timeMsLeft = 0;
      gameEnded = true;
      setButtonsState();
    }
    updateHud();
    persistTimerState(timeMsLeft, true);
  }

  // 8) Render main view
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.clear(true, true);
  renderer.render(scene, camera);

  // 9) Render minimap (bottom-right)
  renderer.setScissorTest(true);
  const mapVPLeft = window.innerWidth - mapWidthPx - mapMargin;
  const mapVPBottom = mapMargin;
  renderer.setScissor(mapVPLeft, mapVPBottom, mapWidthPx, mapHeightPx);
  renderer.setViewport(mapVPLeft, mapVPBottom, mapWidthPx, mapHeightPx);
  renderer.clearDepth();
  renderer.render(scene, mapCamera);
  renderer.setScissorTest(false);
});

/* =========================
   RESIZE
========================= */
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* =========================
   WORLD SETUP VARS
========================= */
/*let worldBounds = null; // redeclared above intentionally (kept for clarity)
let teleportTarget = null;
let playerStart = null;
let carTemplates = []; // shadowed above; kept consistent with usage
let laneSpecs = [];
const lanes = [];*/
