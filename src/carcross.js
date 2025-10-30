import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';
import { FlakesTexture } from 'three/examples/jsm/Addons.js';

/* =========================
   GAME STATE
========================= */
const savedState = JSON.parse(localStorage.getItem('gameState') || '{}');
let reportsCollected = savedState.reportsCollected ?? 0;
let totalReports = savedState.totalReports ?? 3;
let timeMsLeft = savedState.timeMsLeft ?? 120000;

let gameStarted = false;
let gamePaused = false;
let gameEnded = false;
let allReportsAnnounced = false;

let introCamAnimating = false;
let introCamT = 0;
const introCamDuration = 1.2;
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
renderer.autoClear = false;
renderer.domElement.classList.add('game-canvas');
document.body.appendChild(renderer.domElement);

/* =========================
   HUD (DOM)
========================= */
const hud = document.createElement('div');
hud.className = 'hud';

// Progress bar (time)
const progressContainer = document.createElement('div');
progressContainer.className = 'progress-container';
const progressBar = document.createElement('div');
progressBar.id = 'time-progress-bar';
progressBar.className = 'time-progress-bar';
progressContainer.appendChild(progressBar);

// Main content row
const mainContentRow = document.createElement('div');
mainContentRow.className = 'main-content-row';

// Reports
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

// Time block
const timeContainer = document.createElement('div');
timeContainer.className = 'time-container';
const timeLabel = document.createElement('div');
timeLabel.className = 'time-label';
timeLabel.textContent = 'TIME:';
const timeValue = document.createElement('div');
timeValue.id = 'time-value';
timeValue.className = 'time-value';
timeContainer.appendChild(timeLabel);
timeContainer.appendChild(timeValue);
mainContentRow.appendChild(timeContainer);

// Controls row
const controlsRow = document.createElement('div');
controlsRow.className = 'controls-row';

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
controlsPanel.innerHTML = `
  <h3 style="margin:0 0 8px 0">Controls</h3>
  <ul style="margin:0;padding-left:16px;line-height:1.5">
    <li><strong>W/A/S/D</strong> or <strong>Arrow keys</strong> to move</li>
    <li><strong>Space</strong> to toggle run</li>
    <li><strong>?</strong> to open/close this panel</li>
    <li><strong>Esc</strong> to close this panel</li>
  </ul>
`;
ctrlBtn.addEventListener('click', ()=>{
  if(controlsPanel.hidden){
    controlsPanel.hidden = false;
  }else{
    controlsPanel.hidden = true;
  }
})
// Text fallback line (optional)
const hudText = document.createElement('div');
hudText.className = 'hud-text';

// Build HUD
hud.appendChild(progressContainer);
hud.appendChild(mainContentRow);
hud.appendChild(controlsRow);
hud.appendChild(controlsPanel);
hud.appendChild(hudText);
document.body.appendChild(hud);

// HUD positioning (inline – works without external CSS)
Object.assign(hud.style, {
  position: 'fixed',
  top: '10px',
  right: '10px',      // ⬅️ anchor to left
  right: 'auto',     // ensure not anchored to right
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


// Buttons styles if you rely on inline (minimal)
document.querySelectorAll('.btn').forEach(b => {
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

/* =========================
   HUD LOGIC
========================= */
function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateHud() {
  // Dedicated fields
  reportsCounter.textContent = `${reportsCollected}/${totalReports}`;
  const pct = Math.max(0, Math.min(100, (timeMsLeft / 120000) * 100));
  progressBar.style.width = pct + '%';
  timeValue.textContent = formatTime(timeMsLeft);

  // Fallback combined string
  hudText.textContent = `Reports: ${reportsCollected}/${totalReports} | Time: ${formatTime(timeMsLeft)}`;

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

// Expose safe helpers (call these from pickups, etc.)
function setReports(collected, total = totalReports) {
  reportsCollected = Math.max(0, Math.min(collected, total));
  totalReports = total;
  updateHud();
}
function incrementReports(delta = 1) {
  setReports(reportsCollected + delta, totalReports);
}

/* =========================
   OVERLAY (ARRIVAL)
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
    zIndex: '10000'
  });

  const text = document.createElement('div');
  Object.assign(text.style, {
    maxWidth: '720px',
    lineHeight: '1.6',
    fontSize: '18px',
    marginBottom: '16px'
  });
  text.textContent = "Oh no, you'll have to go through the cars before you can proceed.";

  const btn = document.createElement('button');
  btn.textContent = 'CONTINUE';
  btn.className = 'btn';
  Object.assign(btn.style, {
    cursor: 'pointer',
    padding: '10px 18px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '6px',
    background: '#00a86b',
    color: '#fff'
  });

  btn.addEventListener('click', () => {
    gamePaused = false;
    gameStarted = true;
    playBtn.disabled = true;
    pauseBtn.disabled = false;

    // Prepare intro cam animation
    introCamAnimating = true;
    introCamT = 0;
    introStartEye.copy(camera.position);
    introStartTarget.copy(controls.target);
    const base = playerModel ? playerModel.position : new THREE.Vector3();
    introEndEye.set(base.x - 7, (playerModel ? playerModel.position.y : 0) + 3.5, base.z);
    introEndTarget.set(base.x, (playerModel ? playerModel.position.y : 0) + 1, base.z);
    overlay.remove();
  });

  overlay.appendChild(text);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
})();

/* =========================
   INPUTS & CONTROLS
========================= */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1, 0);

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

playBtn.addEventListener('click', () => {
  if (gameEnded) return;
  gameStarted = true;
  gamePaused = false;
  playBtn.disabled = true;
  pauseBtn.disabled = false;
});
pauseBtn.addEventListener('click', () => {
  if (!gameStarted || gameEnded) return;
  gamePaused = true;
  playBtn.disabled = false;
  pauseBtn.disabled = true;
});
rstBtn.addEventListener('click', () => location.reload());

const toggleControls = (forceState) => {
  const isHidden = controlsPanel.classList.contains('is-hidden');
  const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;
  controlsPanel.classList.toggle('is-hidden', !shouldOpen);
  ctrlBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
};
ctrlBtn.addEventListener('click', () => toggleControls());
document.addEventListener('keydown', (e) => {
  if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleControls();
  if (e.key === 'Escape') toggleControls(false);
});

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
  const makeLine = (a, b) => new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([a, b]),
    material
  );
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

<<<<<<< HEAD
// ------------------- Controls -------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1, 0);

// ------------------- Loaders -------------------
const loader = new GLTFLoader();

// Vehicle templates
let carTemplates = [];

// Lanes (will be configured from Cube008/Cube009 after environment loads)
let laneSpecs = [];
const lanes = [];
let worldBounds = null; // { minX, maxX, minZ, maxZ }
let teleportTarget = null; // Cube002 for teleporting to west.html

// ------------------- Helper Functions -------------------
=======
>>>>>>> 1211978 (fix ui on second part)
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
   LOADERS & WORLD
========================= */
const loader = new GLTFLoader();

// Vehicles
let carTemplates = [];
let laneSpecs = [];
const lanes = [];
let worldBounds = null; // { minX, maxX, minZ, maxZ }

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

<<<<<<< HEAD
// ------------------- Load and Inspect Carcross.glb -------------------
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

// ------------------- Load Environment -------------------
=======
// Environment
let characterControls = null;
let playerModel = null;
let playerStart = null;

>>>>>>> 1211978 (fix ui on second part)
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
      if (/^cube0(1[6-9]|2[0-6])$/.test(n)) carTemplates.push(obj);
    });
    carTemplates.forEach(t => (t.visible = false));

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

<<<<<<< HEAD
    if (carTemplates.length === 0) {
      console.warn('⚠️ No car1–car6 found in scene.glb');
    } else {
      console.log(`✅ Found ${carTemplates.length} car templates:`, carTemplates.map(o => o.name));
      carTemplates.forEach(t => (t.visible = false)); // hide originals
      // Configure lanes from Cube008 and Cube009 (each road will have 2 sub-lanes)
      const laneNames = ['cube008', 'cube009'];
      const foundLanes = [];
      laneNames.forEach((lname) => {
        const laneObj = findByNameDeep(env, lname);
        if (laneObj) {
          // Compute world-space bbox to determine z extents and x position
          const box = new THREE.Box3().setFromObject(laneObj);
          // Some lanes might be rotated; use center x
          const center = new THREE.Vector3();
          box.getCenter(center);
          const minZ = Math.min(box.min.z, box.max.z);
          const maxZ = Math.max(box.min.z, box.max.z);
          const laneWidthX = Math.abs(box.max.x - box.min.x);
          // Two sub-lanes inside the road width (quarter offsets to keep within boundaries)
          const xLeft = center.x - laneWidthX * 0.25;
          const xRight = center.x + laneWidthX * 0.25;
          foundLanes.push({ x: center.x, minZ, maxZ, xLeft, xRight });
        }
      });

      // Compute player start at the center of mesh named 'Cube'
      const startMesh = findByNameDeep(env, 'cube');
      if (startMesh) {
        const startBox = new THREE.Box3().setFromObject(startMesh);
        const startCenter = new THREE.Vector3();
        startBox.getCenter(startCenter);
        // place slightly above its top so the model isn't intersecting
        playerStart = new THREE.Vector3(startCenter.x, startBox.max.y + 0.02, startCenter.z);
        console.log('Spawn set from Cube at', playerStart);
        if (playerModel) {
          playerModel.position.copy(playerStart);
        }
      } else {
        console.warn('Mesh named "Cube" not found for spawn.');
      }

      // Find Cube002 for teleport to west.html
      const cube002 = findByNameDeep(env, 'cube002');
      if (cube002) {
        // Ensure world matrices are current, then build a generous vertical box
        cube002.updateMatrixWorld(true);
        teleportTarget = new THREE.Box3().setFromObject(cube002);
        // Expand vertically so the player intersects even if Cube002 is flat on ground
        teleportTarget.min.y -= 1000;
        teleportTarget.max.y += 1000;

        // Optional: visualize the teleport area for debugging
        const helper = new THREE.Box3Helper(teleportTarget, 0x00ff88);
        scene.add(helper);

        console.log('✅ Teleport target (Cube002) found');
      } else {
        console.warn('⚠️ Cube002 not found for teleport');
      }

      if (foundLanes.length === 0) {
        console.warn('⚠️ Cube008/Cube009 not found. Using fallback lane positions.');
        // 2 roads × 2 sub-lanes fallback
        laneSpecs = [
          { x: -4.0, speed: 9.0,  dir:  1, count: 3, spacing: 18, startZ: -60, minZ: -60, maxZ: 60 },
          { x: -2.0, speed: 12.0, dir: -1, count: 2, spacing: 22, startZ:  60, minZ: -60, maxZ: 60 },
          { x:  2.0, speed: 10.0, dir:  1, count: 2, spacing: 20, startZ: -60, minZ: -60, maxZ: 60 },
          { x:  4.0, speed: 13.0, dir: -1, count: 3, spacing: 18, startZ:  60, minZ: -60, maxZ: 60 },
        ];
      } else {
        // For each road, create two sub-lanes with alternating directions
        laneSpecs = [];
        foundLanes.slice(0, 2).forEach((lane) => {
          const denseSpacing = 10; // tighter spacing to keep lanes occupied
          // Left sub-lane (forward)
          laneSpecs.push({
            x: lane.xLeft,
            speed: 8.0,
            dir: 1,
            count: 0, // derive in buildLanes
            spacing: denseSpacing,
            startZ: lane.minZ,
            minZ: lane.minZ,
            maxZ: lane.maxZ,
          });
          // Right sub-lane (backward)
          laneSpecs.push({
            x: lane.xRight,
            speed: 8.0,
            dir: -1,
            count: 0, // derive in buildLanes
            spacing: denseSpacing,
            startZ: lane.maxZ,
            minZ: lane.minZ,
            maxZ: lane.maxZ,
          });
        });
      }

      buildLanes();
=======
    // Spawn from 'cube'
    const startMesh = findByNameDeep(env, 'cube');
    if (startMesh) {
      const startBox = new THREE.Box3().setFromObject(startMesh);
      const startCenter = new THREE.Vector3();
      startBox.getCenter(startCenter);
      playerStart = new THREE.Vector3(startCenter.x, startBox.max.y + 0.02, startCenter.z);
      if (playerModel) playerModel.position.copy(playerStart);
>>>>>>> 1211978 (fix ui on second part)
    }

    if (foundLanes.length === 0) {
      // Fallback
      laneSpecs = [
        { x: -4.0, speed: 9.0,  dir:  1, count: 3, spacing: 18, startZ: -60, minZ: -60, maxZ: 60 },
        { x: -2.0, speed: 12.0, dir: -1, count: 2, spacing: 22, startZ:  60, minZ: -60, maxZ: 60 },
        { x:  2.0, speed: 10.0, dir:  1, count: 2, spacing: 20, startZ: -60, minZ: -60, maxZ: 60 },
        { x:  4.0, speed: 13.0, dir: -1, count: 3, spacing: 18, startZ:  60, minZ: -60, maxZ: 60 },
      ];
    } else {
      // Two roads × two sub-lanes each
      laneSpecs = [];
      foundLanes.slice(0, 2).forEach((lane) => {
        const denseSpacing = 10;
        laneSpecs.push({
          x: lane.xLeft, speed: 8.0, dir:  1, count: 0, spacing: denseSpacing,
          startZ: lane.minZ, minZ: lane.minZ, maxZ: lane.maxZ
        });
        laneSpecs.push({
          x: lane.xRight, speed: 8.0, dir: -1, count: 0, spacing: denseSpacing,
          startZ: lane.maxZ, minZ: lane.minZ, maxZ: lane.maxZ
        });
      });
    }

    buildLanes();
  },
  undefined,
  (err) => console.error('Failed to load environment scene.glb', err)
);

// Character
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

    characterControls = new CharacterControls(playerModel, mixer, animationsMap, controls, camera, 'Idle');
  },
  undefined,
  (err) => console.error('Failed to load Soldier.glb', err)
);

<<<<<<< HEAD
// ------------------- Teleport to West -------------------
function teleportToWest() {
  gamePaused = true;
  gameEnded = true;

  // Save game state
  localStorage.setItem('gameState', JSON.stringify({ reportsCollected, totalReports, timeMsLeft }));

  // Create splash screen overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.color = '#fff';
  overlay.style.fontFamily = 'sans-serif';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '24px';
  overlay.style.zIndex = '10001';

  const text = document.createElement('div');
  text.style.maxWidth = '720px';
  text.style.lineHeight = '1.6';
  text.style.fontSize = '20px';
  text.style.marginBottom = '20px';
  text.textContent = "Great Job, but unfortunately it seems like one of your reports does not have signatures from 3 lectures, find them at West to get your signatures.";

  const btn = document.createElement('button');
  btn.textContent = 'CONTINUE';
  btn.style.cursor = 'pointer';
  btn.style.padding = '12px 24px';
  btn.style.fontSize = '16px';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.background = '#00a86b';
  btn.style.color = '#fff';
  btn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      window.location.href = '/west.html';
    }, 300);
  });

  overlay.appendChild(text);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

// ------------------- Input -------------------
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

// ------------------- Animate -------------------
=======
/* =========================
   MINIMAP
========================= */
>>>>>>> 1211978 (fix ui on second part)
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

<<<<<<< HEAD
  // 1) Update character and map camera, or orbit controls when idle
    if (characterControls && !gameEnded && !gamePaused) {
        characterControls.update(dt, keysPressed);
=======
  // Update character & controls
  if (characterControls && !gameEnded && !gamePaused) {
    characterControls.update(dt, keysPressed);

    // Update minimap camera to follow player
>>>>>>> 1211978 (fix ui on second part)
    if (playerModel) {
      mapCamera.position.set(playerModel.position.x, 50, playerModel.position.z);
      mapCamera.lookAt(playerModel.position.x, 0, playerModel.position.z);
    }
  } else if (!introCamAnimating) {
    controls.update();
  }

<<<<<<< HEAD
  // 2) Intro camera animation
=======
  // Intro cam
>>>>>>> 1211978 (fix ui on second part)
  if (introCamAnimating) {
    introCamT += dt / introCamDuration;
    const t = Math.min(1, introCamT);
    camera.position.lerpVectors(introStartEye, introEndEye, t);
    controls.target.lerpVectors(introStartTarget, introEndTarget, t);
    if (t >= 1) introCamAnimating = false;
  }

<<<<<<< HEAD
  // 3) Clamp player within environment bounds
  if (playerModel && worldBounds) {
    const pad = 0.5;
    const px = THREE.MathUtils.clamp(
      playerModel.position.x,
      worldBounds.minX + pad,
      worldBounds.maxX - pad
    );
    const pz = THREE.MathUtils.clamp(
      playerModel.position.z,
      worldBounds.minZ + pad,
      worldBounds.maxZ - pad
    );
    playerModel.position.x = px;
    playerModel.position.z = pz;
  }

  // 4) Clamp camera horizontally within bounds (skip during intro anim)
=======
  // Clamp player to world
  if (playerModel && worldBounds) {
    const pad = 0.5;
    playerModel.position.x = THREE.MathUtils.clamp(playerModel.position.x, worldBounds.minX + pad, worldBounds.maxX - pad);
    playerModel.position.z = THREE.MathUtils.clamp(playerModel.position.z, worldBounds.minZ + pad, worldBounds.maxZ - pad);
  }

  // Clamp camera X
>>>>>>> 1211978 (fix ui on second part)
  if (worldBounds && !introCamAnimating) {
    const padCam = 0.5;
    const minX = worldBounds.minX + padCam;
    const maxX = worldBounds.maxX - padCam;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, minX, maxX);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, minX, maxX);
  }

<<<<<<< HEAD
  // 5) Move vehicles
=======
  // Move vehicles
>>>>>>> 1211978 (fix ui on second part)
  if (!gameEnded && !gamePaused) {
    lanes.forEach((lane) => {
      lane.vehicles.forEach((v) => {
        v.mesh.position.z += v.speed * dt * v.dir;
        if (v.dir > 0 && v.mesh.position.z > lane.maxZ) v.mesh.position.z = lane.minZ;
        if (v.dir < 0 && v.mesh.position.z < lane.minZ) v.mesh.position.z = lane.maxZ;
      });
    });
  }

<<<<<<< HEAD
  // 6) Collisions and teleport
  if (playerModel && !gameEnded && !gamePaused) {
    const playerBox = new THREE.Box3().setFromObject(playerModel);
    
    if (teleportTarget && playerBox.intersectsBox(teleportTarget)) {
      teleportToWest();
    }
    
    let hit = false;
    for (const lane of lanes) {
      for (const v of lane.vehicles) {
        const box = new THREE.Box3().setFromObject(v.mesh);
        if (playerBox.intersectsBox(box)) { hit = true; break; }
      }
      if (hit) break;
             }
             if (hit) {
                 if (playerStart) playerModel.position.copy(playerStart);
      else playerModel.position.set(0, 0, 0);
                     mapCamera.position.set(playerModel.position.x, 50, playerModel.position.z);
                     mapCamera.lookAt(playerModel.position.x, 0, playerModel.position.z);
         }
     }

  // 7) Timer and HUD
  if (!gameEnded && !gamePaused) {
        timeMsLeft -= dt * 1000;
        if (timeMsLeft <= 0) {
            timeMsLeft = 0;
            gameEnded = true;
    }
    updateHud();
  }

  // 8) Render main scene
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
=======
  // Collisions reset
  if (playerModel && !gameEnded && !gamePaused) {
    const playerBox = new THREE.Box3().setFromObject(playerModel);
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

  // Timer / HUD
  if (!gameEnded && !gamePaused && gameStarted) {
    timeMsLeft -= dt * 1000;
    if (timeMsLeft <= 0) {
      timeMsLeft = 0;
      gameEnded = true;
      playBtn.disabled = true;
      pauseBtn.disabled = true;
    }
    updateHud();
    // Persist occasionally if you want:
    // localStorage.setItem('gameState', JSON.stringify({ reportsCollected, totalReports, timeMsLeft }));
  }

  // Render main
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.clear(true, true);
  renderer.render(scene, camera);

  // Render minimap (bottom-right)
  renderer.setScissorTest(true);
  const mapVPLeft = window.innerWidth - mapWidthPx - mapMargin;
  const mapVPBottom = mapMargin;
  renderer.setScissor(mapVPLeft, mapVPBottom, mapWidthPx, mapHeightPx);
  renderer.setViewport(mapVPLeft, mapVPBottom, mapWidthPx, mapHeightPx);
  renderer.clearDepth();
  renderer.render(scene, mapCamera);
>>>>>>> 1211978 (fix ui on second part)
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
   EXAMPLE: hook for report pickups
   (Call incrementReports() when a report is collected)
========================= */
// window.incrementReports = incrementReports;
