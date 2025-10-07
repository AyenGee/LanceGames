import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// Load saved game state (from main scene)
const savedState = JSON.parse(localStorage.getItem('gameState') || '{}');
let reportsCollected = savedState.reportsCollected || 0;
let totalReports = savedState.totalReports || 3;
let timeMsLeft = savedState.timeMsLeft || 120000;
let gamePaused = false;
let gameEnded = false;
let allReportsAnnounced = false;
let introCamAnimating = false;
let introCamT = 0;
const introCamDuration = 1.2; // seconds
let introStartEye = new THREE.Vector3();
let introStartTarget = new THREE.Vector3();
let introEndEye = new THREE.Vector3();
let introEndTarget = new THREE.Vector3();

// ------------------- Scene & Camera -------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 3.5, 7);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// HUD with pause/play
const hud = document.createElement('div');
hud.style.position = 'fixed';
hud.style.top = '20px';
hud.style.left = '20px';
hud.style.padding = '10px 12px';
hud.style.background = 'rgba(0,0,0,0.5)';
hud.style.color = '#fff';
hud.style.fontFamily = 'sans-serif';
hud.style.fontSize = '14px';
hud.style.borderRadius = '6px';
hud.style.zIndex = '9999';
hud.style.display = 'flex';
hud.style.flexDirection = 'column';
hud.style.gap = '8px';

const hudText = document.createElement('div');
hudText.textContent = '';

const controlsRow = document.createElement('div');
controlsRow.style.display = 'flex';
controlsRow.style.gap = '8px';

const playBtn = document.createElement('button');
playBtn.textContent = 'Play';
playBtn.style.cursor = 'pointer';
playBtn.style.padding = '6px 10px';
playBtn.style.border = 'none';
playBtn.style.borderRadius = '4px';
playBtn.style.background = '#00a86b';
playBtn.style.color = '#fff';
playBtn.addEventListener('click', () => {
  if (gameEnded) return;
  gamePaused = false;
});

const pauseBtn = document.createElement('button');
pauseBtn.textContent = 'Pause';
pauseBtn.style.cursor = 'pointer';
pauseBtn.style.padding = '6px 10px';
pauseBtn.style.border = 'none';
pauseBtn.style.borderRadius = '4px';
pauseBtn.style.background = '#cc3333';
pauseBtn.style.color = '#fff';
pauseBtn.addEventListener('click', () => {
  gamePaused = true;
});

controlsRow.appendChild(playBtn);
controlsRow.appendChild(pauseBtn);

hud.appendChild(hudText);
hud.appendChild(controlsRow);
document.body.appendChild(hud);

// Arrival overlay (full-screen) to introduce the challenge
gamePaused = true;
(function setupArrivalOverlay() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.color = '#fff';
  overlay.style.fontFamily = 'sans-serif';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '24px';
  overlay.style.zIndex = '10000';

  const text = document.createElement('div');
  text.style.maxWidth = '720px';
  text.style.lineHeight = '1.6';
  text.style.fontSize = '18px';
  text.style.marginBottom = '16px';
  text.textContent = "Oh no, you'll have to go throught the cars  before you can proceed.";

  const btn = document.createElement('button');
  btn.textContent = 'CONTINUE';
  btn.style.cursor = 'pointer';
  btn.style.padding = '10px 18px';
  btn.style.fontSize = '16px';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.background = '#00a86b';
  btn.style.color = '#fff';
  btn.addEventListener('click', () => {
    gamePaused = false;
    // Prepare camera intro animation from current view to a spot behind character along +X
    introCamAnimating = true;
    introCamT = 0;
    introStartEye.copy(camera.position);
    introStartTarget.copy(controls.target);
    const base = playerModel ? playerModel.position : new THREE.Vector3();
    // End eye: to the right side (negative X behind if moving +Z), tweak as needed
    introEndEye.set(base.x - 7, (playerModel ? playerModel.position.y : 0) + 3.5, base.z);
    introEndTarget.set(base.x, (playerModel ? playerModel.position.y : 0) + 1, base.z);
    overlay.remove();
  });

  overlay.appendChild(text);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
})();

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateHud() {
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

// ------------------- Lights -------------------
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

// ------------------- Ground -------------------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshPhongMaterial({ color: 0x5e8056 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Axis guidelines (red) and standard axes helper
function addAxisGuides() {
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const makeLine = (a, b) => {
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geom, material);
    line.renderOrder = 1;
    return line;
  };
  const L = 200;
  // X axis guideline (red)
  scene.add(makeLine(new THREE.Vector3(-L, 0, 0), new THREE.Vector3(L, 0, 0)));
  // Y axis guideline (red)
  scene.add(makeLine(new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0)));
  // Z axis guideline (red)
  scene.add(makeLine(new THREE.Vector3(0, 0, -L), new THREE.Vector3(0, 0, L)));

  // Also add a small axes helper for orientation (X=red, Y=green, Z=blue)
  const axes = new THREE.AxesHelper(5);
  axes.position.set(0, 0.01, 0);
  axes.renderOrder = 2;
  scene.add(axes);
}
addAxisGuides();

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

// ------------------- Helper Functions -------------------
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

function cloneVehicle(template, x, z) {
  if (!template) return null;
  const clone = template.clone(true);
  setShadowFlags(clone);
  clone.traverse((obj) => { obj.visible = true; obj.frustumCulled = false; });
  clone.position.set(x, 0, z);
  // Ensure it sits on ground: lift so its bbox min.y touches y=0
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
    // If count is 0 or not specified, compute number of cars to keep lane dense
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

// ------------------- Load Environment -------------------
loader.load(
  '/models/scene.glb',
  (gltf) => {
    const env = gltf.scene;
    setShadowFlags(env);
    scene.add(env);

    // Compute world bounds from the environment
    const envBox = new THREE.Box3().setFromObject(env);
    worldBounds = {
      minX: envBox.min.x,
      maxX: envBox.max.x,
      minZ: envBox.min.z,
      maxZ: envBox.max.z,
    };

    // ✅ Automatically find car1–car6 meshes
        carTemplates = [];

    env.traverse((obj) => {
      const n = (obj.name || '').toLowerCase();
      // Match cube016, cube017, ..., cube026
      if (/^cube0(1[6-9]|2[0-6])$/.test(n)) {
        carTemplates.push(obj);
      }
    });

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
    }
  },
  undefined,
  (err) => console.error('Failed to load environment scene.glb', err)
);

// ------------------- Load Character -------------------
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

    characterControls = new CharacterControls(playerModel, mixer, animationsMap, controls, camera, 'Idle');
  },
  undefined,
  (err) => console.error('Failed to load Soldier.glb', err)
);

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
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  // Update character
  if (characterControls && !gameEnded && !gamePaused) characterControls.update(dt, keysPressed);
  else controls.update();

  // Intro camera animation (lerp from current to behind-the-character view)
  if (introCamAnimating) {
    introCamT += dt / introCamDuration;
    const t = Math.min(1, introCamT);
    camera.position.lerpVectors(introStartEye, introEndEye, t);
    controls.target.lerpVectors(introStartTarget, introEndTarget, t);
    if (t >= 1) introCamAnimating = false;
  }

  // Clamp player within environment bounds
  if (playerModel && worldBounds) {
    const pad = 0.5; // small padding so we don't intersect edges
    const px = THREE.MathUtils.clamp(playerModel.position.x, worldBounds.minX + pad, worldBounds.maxX - pad);
    const pz = THREE.MathUtils.clamp(playerModel.position.z, worldBounds.minZ + pad, worldBounds.maxZ - pad);
    playerModel.position.x = px;
    playerModel.position.z = pz;
  }

  // Clamp camera/viewport horizontally within environment bounds
  if (worldBounds) {
    const padCam = 0.5;
    const minX = worldBounds.minX + padCam;
    const maxX = worldBounds.maxX - padCam;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, minX, maxX);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, minX, maxX);
  }

  // Move vehicles (halt when paused or ended)
  if (!gameEnded && !gamePaused) {
    lanes.forEach((lane) => {
      lane.vehicles.forEach((v) => {
        v.mesh.position.z += v.speed * dt * v.dir;
        if (v.dir > 0 && v.mesh.position.z > lane.maxZ) v.mesh.position.z = lane.minZ;
        if (v.dir < 0 && v.mesh.position.z < lane.minZ) v.mesh.position.z = lane.maxZ;
      });
    });
  }

  // Simple collision detection
  if (playerModel) {
    const playerBox = new THREE.Box3().setFromObject(playerModel);
    let hit = false;
    for (const lane of lanes) {
      for (const v of lane.vehicles) {
        const box = new THREE.Box3().setFromObject(v.mesh);
        if (playerBox.intersectsBox(box)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        // Reset player position if hit
        if (playerStart) playerModel.position.copy(playerStart);
        else playerModel.position.set(0, 0, 0);
        focusCameraOnPlayer();
        break;
      }
    }
  }

  // Update and persist timer
  if (!gameEnded && !gamePaused) {
    timeMsLeft -= dt * 1000;
    if (timeMsLeft <= 0) {
      timeMsLeft = 0;
      gameEnded = true;
    }
    updateHud();
    localStorage.setItem('gameState', JSON.stringify({ reportsCollected, totalReports, timeMsLeft }));
  }

  renderer.render(scene, camera);
});

// ------------------- Resize -------------------
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
