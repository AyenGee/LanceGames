import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// Disable console.log output
try { if (console && typeof console.log === 'function') console.log = () => {}; } catch {}

// Scene
const scene = new THREE.Scene();
const SCENE_SCALE = 3; // make the scene bigger

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 6);
// Audio listener and footstep sound
const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();
const footstepSound = new THREE.Audio(listener);
audioLoader.load('assets/ES_Boots, Walking, Concrete 01 - Epidemic Sound.mp3', function(buffer) {
  footstepSound.setBuffer(buffer);
  footstepSound.setLoop(true);
  footstepSound.setVolume(0.5);
});
// Background music: Superhero Story 1 - Fredrik Ekstrom
const backgroundMusic = new THREE.Audio(listener);
audioLoader.load('assets/ES_Superhero Story 1 - Fredrik Ekstrom.mp3', function(buffer) {
  backgroundMusic.setBuffer(buffer);
  backgroundMusic.setLoop(true);
  backgroundMusic.setVolume(0.25);
  try { backgroundMusic.play(); } catch {}
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 1.2; // keep camera close indoors
controls.maxDistance = 1.8;
controls.zoomSpeed = 0.5;

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

// Loaders
const loader = new GLTFLoader();

// Refs
let planeObject = null;
let playerModel = null;
let characterControls = null;
const obstacles = [];
const SHOW_COLLISION_HELPERS = false; // disable red collision helpers
let mazeMesh = null; // precise collider target
let humanMesh = null; // target to win

// === Shared Timer (Persistent Across Pages) ===
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
let gameEnded = false;
let persistThrottle = 0;

// === HUD (match design used in west.js) ===
function formatTime(ms) { const totalSec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(totalSec / 60).toString().padStart(2, '0'); const s = (totalSec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }
const hud = document.createElement('div');
hud.className = 'hud';
Object.assign(hud.style, {
  position: 'fixed', top: '10px', right: '20px', zIndex: '9999', display: 'flex',
  flexDirection: 'column', gap: '10px', padding: '14px 16px', background: 'rgba(0,0,0,0.55)',
  color: '#fff', fontFamily: 'sans-serif', fontSize: '15px', borderRadius: '10px',
  boxShadow: '0 8px 24px rgba(0,0,0,.35)', backdropFilter: 'blur(6px)', width: '360px', minHeight: '120px'
});
// Progress bar
const progressContainer = document.createElement('div');
progressContainer.className = 'progress-container';
Object.assign(progressContainer.style, { width: '100%', height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' });
const progressBar = document.createElement('div');
progressBar.id = 'time-progress-bar';
progressBar.className = 'time-progress-bar';
Object.assign(progressBar.style, { width: '100%', height: '100%', background: '#00a86b', transition: 'width 0.2s linear' });
progressContainer.appendChild(progressBar);

// Main content row with TIME only (no reports in final)
const mainContentRow = document.createElement('div');
mainContentRow.className = 'main-content-row';
Object.assign(mainContentRow.style, { display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' });

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

hud.appendChild(progressContainer);
hud.appendChild(mainContentRow);
document.body.appendChild(hud);

function updateHUD() {
  const progressPercent = (timeMsLeft / timeMsTotal) * 100;
  progressBar.style.width = `${Math.max(0, progressPercent)}%`;
  progressBar.classList.remove('time-progress-bar--ok', 'time-progress-bar--mid', 'time-progress-bar--low');
  if (progressPercent < 25) { progressBar.classList.add('time-progress-bar--low'); }
  else if (progressPercent < 50) { progressBar.classList.add('time-progress-bar--mid'); }
  else { progressBar.classList.add('time-progress-bar--ok'); }
  const timeValueEl = document.getElementById('time-value');
  if (timeValueEl) timeValueEl.textContent = formatTime(timeMsLeft);
}
updateHUD();

/* =========================
   ARRIVAL OVERLAY
========================= */
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
    whiteSpace: 'pre-line',
  });
  text.textContent = 'Great. you have all the reports and signatures.  recently Rueben has been pissed at you students so he created a maze system such that it is a little harder for all of you to find his office. ALL THE BEST FINDING IT IN TIME!!.';

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
    overlay.remove();
  });

  overlay.appendChild(text);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
})();

// Load final scene and capture Plane
loader.load('models/final.glb', (gltf) => {
  const env = gltf.scene;
  env.scale.set(SCENE_SCALE, SCENE_SCALE, SCENE_SCALE);
  const meshesInFinal = [];
  env.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      meshesInFinal.push(obj);
      if (obj.name === 'Plane') planeObject = obj;
      if (/9_by_9|maze|orthogonal/i.test(obj.name)) mazeMesh = obj;
      if (obj.name === 'Human') humanMesh = obj;
    }
  });
  scene.add(env);
  env.updateMatrixWorld(true);
  // Build static obstacle boxes for maze walls
  meshesInFinal.forEach((m) => {
    const isFloor = m.name === 'Plane';
    const looksLikeMaze = /maze|orthogonal|wall|9_by_9/i.test(m.name);
    if (!isFloor && looksLikeMaze) {
      const bbox = new THREE.Box3().setFromObject(m);
      obstacles.push(bbox);
    }
  });
  if (SHOW_COLLISION_HELPERS) {
    obstacles.forEach((box) => {
      const helper = new THREE.Box3Helper(box, 0xff0000);
      scene.add(helper);
    });
  }
  // Log all meshes in final.glb once after load
  try {
    console.log('final.glb meshes:', meshesInFinal.map((m) => ({ name: m.name, uuid: m.uuid })));
  } catch (e) {
    console.log('final.glb meshes (names):', meshesInFinal.map((m) => m.name));
  }
  
}, undefined, (err) => console.error('Failed to load final.glb', err));

// Load Soldier and place on Plane top
loader.load('models/Soldier.glb', (gltf) => {
  playerModel = gltf.scene;
  playerModel.traverse((obj) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  // Default position
  playerModel.position.set(24.02, -0.21, 1.65);
  scene.add(playerModel);

  const mixer = new THREE.AnimationMixer(playerModel);
  const animationsMap = new Map();
  gltf.animations.forEach((clip) => animationsMap.set(clip.name, mixer.clipAction(clip)));
  characterControls = new CharacterControls(playerModel, mixer, animationsMap, controls, camera, 'Idle', footstepSound);
}, undefined, (err) => console.error('Failed to load Soldier.glb', err));

// Input
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

// Animate
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (!gameEnded) {
    // Decrement and persist timer (throttled)
    timeMsLeft -= dt * 1000;
    if (timeMsLeft <= 0) {
      timeMsLeft = 0;
      gameEnded = true;
    }
    updateHUD();
    persistThrottle += dt;
    if (persistThrottle >= 1.0) {
      persistTimerState(timeMsLeft, true);
      persistThrottle = 0;
    }
  }
  if (characterControls) {
    const oldPos = characterControls.model.position.clone();
    characterControls.update(dt, keysPressed);
    if (checkCollisions(characterControls.model) || hitMazeAlongMove(oldPos, characterControls.model.position)) {
      characterControls.model.position.copy(oldPos);
    }
    // Clamp forward boundary: never allow z > 1.70
    if (characterControls.model.position.x > 25.00) {
      characterControls.model.position.x = 25.00;
    }
    if (characterControls.model.position.z < -15.00) {
        characterControls.model.position.z = -15.00;
      }
    if (characterControls.model.position.z > 18.40) {
        characterControls.model.position.z = 18.40;
      }
  }
  // Win check: touch Low_Poly_Human before time runs out
  if (!gameEnded && playerModel && humanMesh && timeMsLeft > 0) {
    const charBox = new THREE.Box3().setFromObject(playerModel);
    const humanBox = new THREE.Box3().setFromObject(humanMesh);
    if (charBox.intersectsBox(humanBox)) {
      gameEnded = true;
      persistTimerState(timeMsLeft, false);
      showWinOverlay();
    }
  }
  // Keep camera close to character indoors
  if (playerModel) {
    const target = playerModel.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    controls.target.copy(target);
    const desiredDistance = 1.6;
    const toCam = camera.position.clone().sub(controls.target);
    if (toCam.lengthSq() === 0) toCam.set(0, 0, desiredDistance);
    toCam.setLength(desiredDistance);
    camera.position.copy(controls.target.clone().add(toCam));
    // Log character world coordinates each frame
    // console.log(`Soldier position → x=${playerModel.position.x.toFixed(2)}, y=${playerModel.position.y.toFixed(2)}, z=${playerModel.position.z.toFixed(2)}`);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Win overlay
function showWinOverlay() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.8)';
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
  title.textContent = 'You Win!';
  title.style.fontSize = '28px';
  title.style.fontWeight = '800';
  title.style.marginBottom = '10px';

  const body = document.createElement('div');
  body.style.fontSize = '16px';
  body.style.lineHeight = '1.7';
  body.style.opacity = '0.95';
  body.textContent = 'You reached the office in time.';

  card.appendChild(title);
  card.appendChild(body);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// Simple AABB collision similar to main.js
function checkCollisions(character) {
  if (!obstacles.length) return false;
  const charBox = new THREE.Box3().setFromObject(character);
  charBox.expandByScalar(-0.1);
  for (let i = 0; i < obstacles.length; i++) {
    if (charBox.intersectsBox(obstacles[i])) return true;
  }
  return false;
}

// Raycast-based precise collision against maze wall mesh along movement path
function hitMazeAlongMove(oldPos, newPos) {
  if (!mazeMesh) return false;
  const move = newPos.clone().sub(oldPos);
  const stepLen = move.length();
  if (stepLen === 0) return false;
  const dir = move.clone().normalize();
  // Character radius and sample height
  const radius = 0.25;
  const y = (playerModel ? playerModel.position.y : 0) + 0.9; // around waist height
  const upOffset = new THREE.Vector3(0, y, 0);
  // Perpendicular in XZ for side rays
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const offsets = [0, radius * 0.7, -radius * 0.7];
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  for (let i = 0; i < offsets.length; i++) {
    const lateral = perp.clone().multiplyScalar(offsets[i]);
    const origin = new THREE.Vector3(oldPos.x, 0, oldPos.z).add(lateral).add(upOffset);
    raycaster.set(origin, new THREE.Vector3(dir.x, 0, dir.z).normalize());
    raycaster.near = 0;
    raycaster.far = stepLen + radius * 0.6;
    const hits = raycaster.intersectObject(mazeMesh, true);
    if (hits && hits.length > 0) return true;
  }
  return false;
}

