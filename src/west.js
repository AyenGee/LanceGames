import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === MOUSE LOOK SETTINGS ===
// Disable console.log output in production
try { if (console && typeof console.log === 'function') console.log = () => {}; } catch {}
let mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;
let gamePaused = null;
let gameStarted = null;

// === HUD SETUP (Your existing HUD code) ===
const hud = document.createElement('div');
// ... (all your HUD JS code from line 11 to 216) ...
// ... (skipping for brevity, no changes needed here) ...
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
reportsLabel.textContent = 'SIGNATURES:';
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
  playBtn.disabled = !gamePaused || gameEnded;  // play is enabled only when paused and not ended
  pauseBtn.disabled = gamePaused || !gameStarted || gameEnded;
  rstBtn.disabled = false;
}
playBtn.addEventListener('click', () => {
  if (gameEnded) return;
  gameStarted = true;
  gamePaused = false;
  setButtonsState();
});
pauseBtn.addEventListener('click', () => {
  if (!gameStarted || gameEnded) return;
  gamePaused = true;
  setButtonsState();
});
rstBtn.addEventListener('click', () => {
  // Save state if you want, or just hard reload
  window.location.reload();
});
setButtonsState();

// Pointer Lock for immersive mouse look (requested only in first-person mode)
document.body.addEventListener('click', () => {
// ... (your pointer lock code) ...
    if (!renderer) return;
    // Only attempt pointer lock when in first-person and not already locked
    if (isFirstPerson && document.pointerLockElement !== renderer.domElement) {
        try {
            renderer.domElement.requestPointerLock();
        } catch (e) {
            console.warn('Pointer lock request failed:', e);
        }
    }
});

document.addEventListener('pointerlockchange', () => {
// ... (your pointer lock code) ...
    if (!renderer) return;
    const locked = document.pointerLockElement === renderer.domElement;
    // Disable OrbitControls while locked to avoid pointer capture conflicts
    orbitControls.enabled = !locked && !isFirstPerson ? true : !locked;
});
// === END HUD ===


// === SCENE SETUP ===
const scene = new THREE.Scene();

// === ADD MINIMAP CONSTANTS ===
const mapWidthPx = 200;
const mapHeightPx = 200;
const mapMargin = 20;
const aspect = mapWidthPx / mapHeightPx;
const mapViewSize = 18; // Smaller number = more zoomed in

// === ADD MINIMAP CAMERA ===
const mapCamera = new THREE.OrthographicCamera(
    -mapViewSize * aspect / 2, // left
     mapViewSize * aspect / 2, // right
     mapViewSize / 2,          // top
    -mapViewSize / 2,          // bottom
     0.1,                      // near
     1000                      // far
);
mapCamera.up.set(0, 0, -1); // Pointing down Z-axis, looking at XY plane
mapCamera.lookAt(0, 0, 0);
scene.add(mapCamera);


// Camera (Main)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false; // <-- *** ADD THIS LINE FOR MINIMAP ***
document.body.appendChild(renderer.domElement);

// Clock and key input
const clock = new THREE.Clock();
// ... (your key input, camera toggle, etc. code) ...
const keysPressed = {};
document.addEventListener("keydown", e => keysPressed[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keysPressed[e.key.toLowerCase()] = false);

// Camera mode toggle (V key)
let isFirstPerson = false;
const CAMERA_TOGGLE_KEY = 'v';

// First-person camera settings
const moveSpeed = 5.0;
const savedCameraPosition = new THREE.Vector3();
const savedCameraRotation = new THREE.Euler();

// Orbit controls (third-person mode)
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// === Shared Timer (Persistent Across Pages) ===
const TIMER_KEY = 'gameTimer';
const SIGN_KEY = 'signatures';
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
function readSignatures() {
    try {
        const raw = localStorage.getItem(SIGN_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr);
    } catch { return new Set(); }
}
function persistSignatures(sigSet) {
    try { localStorage.setItem(SIGN_KEY, JSON.stringify(Array.from(sigSet))); } catch {}
}
function getSignatureCount() { return readSignatures().size; }

// Always reset signatures on entering/reloading west.js
try {
    localStorage.removeItem(SIGN_KEY);
    const reportsCounterEl = document.getElementById('reports-counter');
    if (reportsCounterEl) reportsCounterEl.textContent = '0/3';
} catch {}
let timeMsTotal = 180000;
let timeMsLeft = (readPersistedTimer()?.timeMsLeft) ?? (timeMsTotal);
let timerPaused = false;
let persistThrottle = 0; // throttle localStorage writes to ~1/sec
function formatTime(ms) { const totalSec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(totalSec / 60).toString().padStart(2, '0'); const s = (totalSec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }

// Update only the existing progress bar from the primary HUD
function updateHUD() {
    const progressBar = document.getElementById('time-progress-bar');
    if (progressBar) {
        const progressPercent = (timeMsLeft / timeMsTotal) * 100;
        progressBar.style.width = `${Math.max(0, progressPercent)}%`;
        progressBar.classList.remove('time-progress-bar--ok', 'time-progress-bar--mid', 'time-progress-bar--low');
        if (progressPercent < 25) { progressBar.classList.add('time-progress-bar--low'); }
        else if (progressPercent < 50) { progressBar.classList.add('time-progress-bar--mid'); }
        else { progressBar.classList.add('time-progress-bar--ok'); }
    }
    const reportsCounterEl = document.getElementById('reports-counter');
    if (reportsCounterEl) {
        reportsCounterEl.textContent = `${getSignatureCount()}/3`;
    }
}
// 1. Hemisphere Light (Sky + Ground ambient lighting for outdoor scenes)
const hemisphereLight = new THREE.HemisphereLight(
    0x87CEEB, // Sky blue color from above
    0x8B7355, // Ground/earth brown color from below
    0.6        // Intensity
);
scene.add(hemisphereLight);

// 2. Directional Light (Sunlight) - Main light source
const sunLight = new THREE.DirectionalLight(0xFFFFE0, 1.2); // Warm white sunlight
sunLight.position.set(50, 80, 40); // High up, mimicking afternoon sun
sunLight.castShadow = true;

// Configure shadow properties for realistic outdoor shadows
sunLight.shadow.mapSize.width = 2048;  // Reduced for performance
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunLight.shadow.bias = -0.0001; // Reduce shadow acne

scene.add(sunLight);

// 3. Additional Ambient Light for overall scene brightness
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.4); // Soft white ambient
scene.add(ambientLight);

// 4. Fill Light (Subtle directional from opposite side to soften shadows)
const fillLight = new THREE.DirectionalLight(0xB0C4DE, 0.3); // Light steel blue
fillLight.position.set(-30, 40, -30); // Opposite side of sun
scene.add(fillLight);

// Optional: Add fog for depth perception in outdoor scene
scene.fog = new THREE.Fog(0x87CEEB, 100, 300); // Sky blue fog

// Background
const textureLoader = new THREE.TextureLoader();
textureLoader.load('/models/sky.jpeg', (texture) => {
    texture.encoding = THREE.sRGBEncoding;
    scene.background = texture;
});


// === LOAD ENVIRONMENT (Your existing code) ===
// ... (no changes needed) ...
const loader = new GLTFLoader();
let environment;
let planeObject = null;
let characterModel = null;
let environmentLoaded = false; // ensure scene appears before character
let npcs = []; // Array to store NPC collision boxes
let obstacles = []; // Array to store building/obstacle collision boxes
let teleporters = []; // Array to store teleporter triggers
let glass012Mesh = null; // Exit trigger to final.html
let hasTeleportedToFinal = false; // Guard for final teleport
// HERE markers (hovering letters + light) for signable NPCs
const hereMarkers = [];
// Floating labels for portals (e.g., LABS in front of portDoor)
const portalLabels = [];
let officeLabelCreated = false; // Create OFFICE label once when 3 signatures are collected

loader.load("/models/west.glb", (gltf) => {
    environment = gltf.scene;
    scene.add(environment);

    // Log all objects/meshes in the scene
    console.log('🔍 === WEST.GLB OBJECT NAMES ===');
    environment.traverse((child) => {
        console.log(`Name: "${child.name}" | Type: ${child.type}${child.isMesh ? ' (Mesh)' : ''}`);
        
        // Store NPCs for collision detection
        const npcNames = ["Human", "Human_1", "Human_2", "Low_Poly_Human", "Renzo"];
        if (npcNames.includes(child.name)) {
            child.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(child);
            npcs.push({ name: child.name, box: box, mesh: child });
            console.log(`✅ Added NPC collision box for: ${child.name}`);

            // If this NPC grants a signature, create hovering HERE markers
            if (signableWest.has(child.name)) {
                createHereMarkersForNPC(child);
            }
        }
        
			// Store obstacles (Cube*, Cylinder*) for collision detection
        // Exclude: "Cube", "Cylinder", "Cylinder001", "Cylinder002"
        const excludedNames = ["Cube", "Cylinder", "Cylinder001", "Cylinder002","Cube001","Cube022"];
        if ((child.name.startsWith('Cube') || child.name.startsWith('Cylinder')) && 
            !excludedNames.includes(child.name)) {
            child.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(child);
            obstacles.push({ name: child.name, box: box, mesh: child });
            console.log(`✅ Added obstacle collision box for: ${child.name}`);
        } else if (excludedNames.includes(child.name)) {
            console.log(`⏭️  Skipping collision for excluded object: ${child.name}`);
        }

			// Store teleporters by name
			if (child.name === 'teleport' || child.name === 'portDoor') {
				child.updateMatrixWorld(true);
				const box = new THREE.Box3().setFromObject(child);
				teleporters.push({ name: child.name, box: box, mesh: child });
				console.log(`🌀 Added teleporter trigger for: ${child.name}`);
				if (child.name === 'portDoor') {
					createPortalLabel(child, 'LABS');
				}
			}

			// Final exit trigger (glass012)
			if (child.name === 'glass012') {
				glass012Mesh = child;
				console.log('🚪 Registered final exit trigger: glass012');
			}
        
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.name === "Plane") {
                planeObject = child;
                const planeBox = new THREE.Box3().setFromObject(child);
                console.log("✅ Found Plane object for positioning:", child);
                console.log(`   Plane Y bounds: min=${planeBox.min.y.toFixed(2)}, max=${planeBox.max.y.toFixed(2)}`);
                if (characterModel) {
                    console.log(`   Character position before: y=${characterModel.position.y.toFixed(2)}`);
                    positionCharacterOnPlane();
                    console.log(`   Character position after: y=${characterModel.position.y.toFixed(2)}`);
                }
            }
        }
    });
    console.log('🔍 === END WEST.GLB LISTING ===');
    console.log(`✅ Found ${npcs.length} NPCs for collision detection`);
    console.log(`✅ Found ${obstacles.length} obstacles for collision detection`);
    console.log(`✅ Found ${teleporters.length} teleporters`);
    // Mark environment as loaded and reveal character if already loaded
    environmentLoaded = true;
    if (characterModel) characterModel.visible = true;
});


// === LOAD CHARACTER (Your existing code) ===
// ... (no changes needed) ...
let characterControls;

loader.load("/models/Soldier.glb", (gltf) => {
    const model = gltf.scene;
    model.scale.set(2, 2, 2);
    model.castShadow = true;
    // Keep soldier hidden until environment is ready
    model.visible = environmentLoaded;
    scene.add(model);

    characterModel = model;

    if (planeObject) positionCharacterOnPlane();
    else model.position.set(0, 2, 3);
    
    // Initialize last character position for collision detection
    lastCharacterPosition.copy(model.position);

    const mixer = new THREE.AnimationMixer(model);
    const animationsMap = new Map();
    gltf.animations.forEach(clip => animationsMap.set(clip.name, mixer.clipAction(clip)));

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, "Idle");
});


// === HELPER FUNCTIONS (Your existing code) ===
// ... (positionCharacterOnPlane, showMessage, toggleCameraMode, etc.) ...
// ... (no changes needed) ...
function positionCharacterOnPlane() {
    if (characterModel && planeObject) {
        // Calculate where the plane's top surface is
        const bbox = new THREE.Box3().setFromObject(planeObject);
        const yPosition = bbox.max.y;
        
        // Position character at the plane's surface
        characterModel.position.y = yPosition;
        
        // Update last known position for collision detection
        lastCharacterPosition.copy(characterModel.position);
        
        console.log(`✅ Character positioned on Plane at y=${yPosition.toFixed(2)}`);
    }
}

// === CREATE HOVERING "HERE" MARKERS FOR SIGNABLE NPCs ===
function createHereMarkersForNPC(npcMesh) {
    // Compute head/top position to place markers above
    const bbox = new THREE.Box3().setFromObject(npcMesh);
    const topY = bbox.max.y;

    const group = new THREE.Group();
    group.renderOrder = 10;

    // Helper to build a glowing letter sprite
    function makeLetterSprite(letter, color) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.Sprite();

        // Glow background
        const gradient = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, size/2);
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.35)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0,size,size);

        // Letter
        ctx.font = 'bold 180px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.fillText(letter, size/2, size/2 + 10);

        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.8, 0.8, 0.8);
        return sprite;
    }

    const letters = ['H','E','R','E'];
    const color = '#66ccff';
    const spacing = 0.7;
    const totalWidth = spacing * (letters.length - 1);
    letters.forEach((ch, i) => {
        const s = makeLetterSprite(ch, color);
        s.position.set(-totalWidth/2 + i*spacing, 0, 0);
        group.add(s);
    });

    // Add a small point light to act as a light source hint
    const light = new THREE.PointLight(0x66ccff, 0.8, 6, 2.0);
    light.position.set(0, 0, 0);
    group.add(light);

    // Initial placement: centered above NPC
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    group.position.set(center.x, topY + 1.6, center.z);
    scene.add(group);

    hereMarkers.push({ group, npcMesh, yOffset: 1.6, phase: Math.random()*Math.PI*2, center, topY });
}

// === CREATE FLOATING LABEL FOR A PORTAL MESH (e.g., "LABS") ===
function createPortalLabel(mesh, text) {
    // Build a glowing text sprite
    function makeTextSprite(t, color) {
        const width = 512, height = 256;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.Sprite();

        // Background glow
        const gradient = ctx.createRadialGradient(width/2, height/2, 20, width/2, height/2, Math.max(width,height)/2);
        gradient.addColorStop(0, 'rgba(255,255,255,0.6)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.25)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0,width,height);

        // Text
        ctx.font = 'bold 160px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 40;
        ctx.fillText(t, width/2, height/2 + 10);

        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2.2, 1.1, 1.0);
        return sprite;
    }

    const color = '#ffcc66';
    const sprite = makeTextSprite(text, color);
    const group = new THREE.Group();
    group.add(sprite);

    // Light for emphasis
    const light = new THREE.PointLight(0xffcc66, 0.7, 6, 2.0);
    group.add(light);

    // Initial placement: in front of mesh and slightly above top
    const bbox = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const topY = bbox.max.y;

    const worldQuat = new THREE.Quaternion();
    mesh.getWorldQuaternion(worldQuat);
    // Use +Z as forward reference in mesh local space
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize();
    const forwardOffset = 1.5;
    const yOffset = 1.2;
    const pos = center.clone().add(forward.multiplyScalar(forwardOffset));
    pos.y = topY + yOffset;
    group.position.copy(pos);
    scene.add(group);

    portalLabels.push({ group, mesh, forwardOffset, yOffset, baseCenter: center, topY });
}

// === MESSAGE DISPLAY ===
let messageTimeout = null;
function showMessage(text) {
    // Remove existing message if any
    const existingMsg = document.getElementById('npc-message');
    if (existingMsg) {
        existingMsg.remove();
        if (messageTimeout) clearTimeout(messageTimeout);
    }
    
    // Create message element
    const msg = document.createElement('div');
    msg.id = 'npc-message';
    msg.textContent = text;
    msg.style.position = 'fixed';
    msg.style.top = '50%';
    msg.style.left = '50%';
    msg.style.transform = 'translate(-50%, -50%)';
    msg.style.background = 'rgba(0, 0, 0, 0.8)';
    msg.style.color = '#fff';
    msg.style.padding = '20px 40px';
    msg.style.borderRadius = '10px';
    msg.style.fontSize = '24px';
    msg.style.fontFamily = 'sans-serif';
    msg.style.zIndex = '10000';
    msg.style.pointerEvents = 'none';
    document.body.appendChild(msg);
    
    // Remove message after 2 seconds
    messageTimeout = setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transition = 'opacity 0.5s';
        setTimeout(() => msg.remove(), 500);
    }, 2000);
}

// === OVERLAY MESSAGE (Final transition) ===
function showCongratsOverlay(text) {
	const existing = document.getElementById('congrats-overlay');
	if (existing) existing.remove();
	const overlay = document.createElement('div');
	overlay.id = 'congrats-overlay';
	overlay.style.position = 'fixed';
	overlay.style.inset = '0';
	overlay.style.background = 'rgba(0,0,0,0.75)';
	overlay.style.display = 'flex';
	overlay.style.alignItems = 'center';
	overlay.style.justifyContent = 'center';
	overlay.style.zIndex = '10001';

	const card = document.createElement('div');
	card.style.maxWidth = '720px';
	card.style.margin = '20px';
	card.style.background = 'linear-gradient(135deg, rgba(20,20,20,0.95), rgba(35,35,35,0.95))';
	card.style.color = '#fff';
	card.style.padding = '28px 32px';
	card.style.borderRadius = '14px';
	card.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';
	card.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

	const title = document.createElement('div');
	title.textContent = 'Great!';
	title.style.fontSize = '28px';
	title.style.fontWeight = '800';
	title.style.marginBottom = '10px';

	const body = document.createElement('div');
	body.style.fontSize = '16px';
	body.style.lineHeight = '1.7';
	body.style.opacity = '0.95';
	body.textContent = text;

	const hint = document.createElement('div');
	hint.textContent = 'Teleporting to the maze...';
	hint.style.marginTop = '16px';
	hint.style.opacity = '0.8';
	hint.style.fontSize = '14px';

	card.appendChild(title);
	card.appendChild(body);
	card.appendChild(hint);
	overlay.appendChild(card);
	document.body.appendChild(overlay);
}

// === TOGGLE CAMERA MODE ===
function toggleCameraMode() {
    isFirstPerson = !isFirstPerson;

    if (isFirstPerson) {
        // Switch to first-person mode
        if (characterModel) {
            // Save character position and rotation
            const charPos = new THREE.Vector3();
            characterModel.getWorldPosition(charPos);
            
            // Position camera at character's head height (adjusted for ground)
            camera.position.copy(charPos);
            const headHeight = planeObject ? 
                new THREE.Box3().setFromObject(planeObject).max.y + 1.5 : 
                charPos.y + 1.5;
            camera.position.y = headHeight;
            
            // Set camera rotation to match character
            yaw = characterModel.rotation.y;
            pitch = 0;
            
            // Hide character
            characterModel.visible = false;
        }
        
        // Disable orbit controls
        orbitControls.enabled = false;
        // Request pointer lock on entering first-person
        try { renderer.domElement.requestPointerLock(); } catch {}
        
        console.log('Switched to first-person view (free camera)');
    } else {
        // Switch to third-person mode
        if (characterModel) {
            // Position character at camera's current position
            characterModel.position.copy(camera.position);
            characterModel.position.y = planeObject ? 
                new THREE.Box3().setFromObject(planeObject).max.y + 0.1 : 0;
            
            // Set character rotation to match camera yaw
            characterModel.rotation.y = yaw;
            
            // Show character
            characterModel.visible = true;
            
            // Position camera behind character
            const offset = new THREE.Vector3(0, 2, 5);
            offset.applyQuaternion(characterModel.quaternion);
            camera.position.copy(characterModel.position.clone().add(offset));
            camera.lookAt(characterModel.position);
        }
        
        // Exit pointer lock if active and re-enable orbit controls
      if (document.pointerLockElement === renderer.domElement) {
            try { document.exitPointerLock(); } catch {}
        }
        orbitControls.enabled = true;
        orbitControls.target.copy(characterModel.position);
        
        console.log('Switched to third-person view');
    }
}

// === MOUSE LOOK (First-Person Only) ===
document.addEventListener('mousemove', (e) => {
// ... (no changes needed) ...
    if (isFirstPerson && document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * mouseSensitivity;
        pitch -= e.movementY * mouseSensitivity;
        // Clamp pitch to prevent over-rotation
        pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    }
});

// === FIRST-PERSON MOVEMENT ===
function updateFirstPersonCamera(delta) {
// ... (no changes needed) ...
    if (!isFirstPerson) return;
    
    // Apply camera rotation
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    const finalQuat = new THREE.Quaternion();
    finalQuat.multiplyQuaternions(qYaw, qPitch);
    camera.quaternion.copy(finalQuat);
    
    // WASD Movement
    const moveVector = new THREE.Vector3();
    
    if (keysPressed['w']) moveVector.z -= 1;
    if (keysPressed['s']) moveVector.z += 1;
    if (keysPressed['a']) moveVector.x -= 1;
    if (keysPressed['d']) moveVector.x += 1;
    
    // Normalize to prevent faster diagonal movement
    if (moveVector.length() > 0) {
        moveVector.normalize();
        
        // Apply movement relative to camera direction (only yaw, not pitch)
        const moveQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        moveVector.applyQuaternion(moveQuat);
        moveVector.multiplyScalar(moveSpeed * delta);
        
        camera.position.add(moveVector);
    }
}

// === COLLISION DETECTION ===
let lastCollisionNPC = null; // Track last NPC to prevent spam
let lastCharacterPosition = new THREE.Vector3();
const pageId = 'west';
const signableWest = new Set(['Renzo','Human','Low_Poly_Human']); // include Renzo alias name

function checkCollisions() {
// ... (no changes needed) ...
    if (!characterModel) return;
    
    const currentPosition = characterModel.position.clone();
    
    // Clamp character Y position to plane surface if plane exists
    if (planeObject) {
        const planeBox = new THREE.Box3().setFromObject(planeObject);
        const minY = planeBox.max.y;
        if (characterModel.position.y < minY) {
            characterModel.position.y = minY;
        }
    }
    
	// Get collision box (character in third-person, camera proxy in first-person)
	const collisionBox = isFirstPerson
		? new THREE.Box3().setFromCenterAndSize(
				camera.position.clone(),
				new THREE.Vector3(0.6, 1.8, 0.6)
			)
		: new THREE.Box3().setFromObject(characterModel);
    
    // Check collision with obstacles (buildings) using cached boxes
    for (const obstacle of obstacles) {
        const currentBox = obstacle.box;
        if (collisionBox.intersectsBox(currentBox)) {
            // Collision with building - revert to last valid position
            characterModel.position.copy(lastCharacterPosition);
            console.log(`⚠️ Collision with ${obstacle.name} - movement blocked`);
            return; // Exit early to prevent further movement
        }
    }
    
	// Final exit: if all signatures collected, touching glass012 triggers overlay and teleport to final.html
	if (!hasTeleportedToFinal && glass012Mesh && getSignatureCount() === 3) {
		const glassBox = new THREE.Box3().setFromObject(glass012Mesh);
		if (collisionBox.intersectsBox(glassBox)) {
			hasTeleportedToFinal = true;
			showCongratsOverlay(
				'Great. you have all the reports and signatures.  recently Robin has been pissed at you students so he created a maze system such that it is a little harder for all of you to find his office. ALL THE BEST FINDING IT IN TIME!!.'
			);
			persistTimerState(timeMsLeft, false);
			setTimeout(() => { window.location.href = 'final.html'; }, 2500);
			return;
		}
	}

		// Check collision with teleporters
		for (const tp of teleporters) {
			const tpBox = new THREE.Box3().setFromObject(tp.mesh);
			if (collisionBox.intersectsBox(tpBox)) {
				console.log(`🌀 Teleport trigger: ${tp.name} → labs.html`);
				// Persist current timer state before navigating
				persistTimerState(timeMsLeft, false);
				window.location.href = 'labs.html';
				return;
			}
		}

    // Check collision with NPCs (only if not colliding with obstacles)
    if (npcs.length > 0) {
			// Use expanded box for easier NPC detection
			const npcDetectionBox = collisionBox.clone().expandByScalar(0.5);
        
        for (const npc of npcs) {
            const currentBox = npc.box; // cached
            
            if (npcDetectionBox.intersectsBox(currentBox)) {
                // Collision detected with NPC
                if (lastCollisionNPC !== npc.name) {
                    lastCollisionNPC = npc.name;
                    // Only count signatures for designated west NPCs
                    if (signableWest.has(npc.name)) {
                        const sigs = readSignatures();
                        const uniqueId = `${pageId}:${npc.name}`;
                        if (!sigs.has(uniqueId)) {
                            sigs.add(uniqueId);
                            persistSignatures(sigs);
                            const count = sigs.size;
                            showMessage(`Report signed (${count}/3)`);
                            const reportsCounterEl = document.getElementById('reports-counter');
                            if (reportsCounterEl) reportsCounterEl.textContent = `${count}/3`;
                            console.log(`✅ Signature recorded for ${uniqueId} → ${count}/3`);
                        } else {
                            console.log(`ℹ️ Already signed: ${uniqueId}`);
                        }
                    } else {
                        console.log(`ℹ️ ${npc.name} does not grant a signature in west.`);
                    }
                }
                break; // Only show one message at a time
            }
        }
    }
    
    // Update last valid position if no obstacle collision
    lastCharacterPosition.copy(currentPosition);
    
    // Reset last collision NPC if no NPC collision detected
    if (lastCollisionNPC) {
		const npcDetectionBox = collisionBox.clone().expandByScalar(0.5);
        let stillColliding = false;
        for (const npc of npcs) {
            const currentBox = new THREE.Box3().setFromObject(npc.mesh);
            if (npcDetectionBox.intersectsBox(currentBox)) {
                stillColliding = true;
               break;
            }
        }
        if (!stillColliding) {
            lastCollisionNPC = null;
        }
    }
}


// === ANIMATION LOOP (MODIFIED) ===
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // --- 1. UPDATE LOGIC ---
    if (isFirstPerson) {
        // First-person: just update camera
        updateFirstPersonCamera(delta);
    } else {
        // Third-person: update character controls
        if (characterControls) {
            characterControls.update(delta, keysPressed);
        }
        orbitControls.update();
    }
    
    // Check for NPC collisions (this may revert character position)
    checkCollisions();
    
    // Update HERE markers (hovering/bobbing above NPCs)
    if (hereMarkers.length) {
        for (const marker of hereMarkers) {
            // Bobbing animation using cached bbox data
            const bob = Math.sin(elapsed * 2.0 + marker.phase) * 0.15;
            marker.group.position.set(marker.center.x, marker.topY + marker.yOffset + bob, marker.center.z);
        }
    }

    // Update portal labels to remain in front of their meshes and face the camera
    if (portalLabels.length) {
        for (const label of portalLabels) {
            const worldQuat = new THREE.Quaternion();
            label.mesh.getWorldQuaternion(worldQuat);
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize();
            const pos = label.baseCenter.clone().add(forward.multiplyScalar(label.forwardOffset));
            pos.y = label.topY + label.yOffset;
            label.group.position.copy(pos);
            label.group.lookAt(camera.position);
        }
    }

    // --- ADD MAP CAMERA UPDATE (AFTER COLLISIONS) ---
    if (characterModel) {
        mapCamera.position.set(
            characterModel.position.x,
            100, // Fixed height above player
            characterModel.position.z
        );
        mapCamera.lookAt(
            characterModel.position.x,
            0, // Look at the ground
            characterModel.position.z
        );
    }

    // Timer update & persist (throttled)
    if (!timerPaused) {
        timeMsLeft -= delta * 1000;
        if (timeMsLeft <= 0) { timeMsLeft = 0; timerPaused = true; }
        updateHUD();
        persistThrottle += delta;
        if (persistThrottle >= 1.0) {
            persistTimerState(timeMsLeft, true);
            persistThrottle = 0;
        }
    }

    // When all signatures are collected, show "OFFICE" in front of glass012 once
    if (!officeLabelCreated && glass012Mesh && getSignatureCount() === 3) {
        createPortalLabel(glass012Mesh, 'OFFICE');
        officeLabelCreated = true;
    }

    // --- 2. RENDER MAIN SCENE ---
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear(true, true); // Clear color and depth (since autoClear is false)
    renderer.render(scene, camera);

    // --- 3. RENDER MINIMAP ---
    renderer.setScissorTest(true);

    const mapLeft = window.innerWidth - mapWidthPx - mapMargin;
    const mapBottom = mapMargin;

    renderer.setScissor(mapLeft, mapBottom, mapWidthPx, mapHeightPx);
    renderer.setViewport(mapLeft, mapBottom, mapWidthPx, mapHeightPx);
    
    renderer.clearDepth(); // Clear only the depth in the minimap area
    renderer.render(scene, mapCamera); // Render with the map camera

    renderer.setScissorTest(false); // Reset scissor test
}

animate();

// === CAMERA TOGGLE EVENT ===
document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === CAMERA_TOGGLE_KEY) toggleCameraMode();
});

// === WINDOW RESIZE ===
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Note: Minimap viewport position is recalculated in animate(), so no update needed here
});