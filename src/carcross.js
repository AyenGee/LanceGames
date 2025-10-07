import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// ------------------- Scene & Camera -------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 6, 12);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

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
    playerModel.position.y + 6,
    playerModel.position.z + 12
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
    for (let i = 0; i < spec.count; i++) {
      const z = spec.startZ + (spec.dir > 0 ? i * spec.spacing : -i * spec.spacing);
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
    const carNames = ['car1', 'car2', 'car3', 'car4', 'car5', 'car6'];
    carTemplates = [];

    env.traverse((obj) => {
      const n = (obj.name || '').toLowerCase();
      if (carNames.includes(n)) {
        carTemplates.push(obj);
      }
    });

    if (carTemplates.length === 0) {
      console.warn('⚠️ No car1–car6 found in scene.glb');
    } else {
      console.log(`✅ Found ${carTemplates.length} car templates:`, carTemplates.map(o => o.name));
      carTemplates.forEach(t => (t.visible = false)); // hide originals
      // Configure lanes from Cube008 and Cube009
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
          foundLanes.push({ x: center.x, minZ, maxZ });
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
        laneSpecs = [
          { x: -4.0, speed: 9.0, dir: 1, count: 3, spacing: 18, startZ: -60, minZ: -60, maxZ: 60 },
          { x:  4.0, speed: 10.0, dir: -1, count: 2, spacing: 24, startZ:  60, minZ: -60, maxZ: 60 },
        ];
      } else {
        // Build two lane specs based on found lanes (upwards and downwards flows)
        laneSpecs = foundLanes.slice(0, 2).map((lane, idx) => ({
          x: lane.x,
          speed: idx === 0 ? 9.0 : 12.0,
          dir: idx === 0 ? 1 : -1,
          count: idx === 0 ? 3 : 2,
          spacing: idx === 0 ? 18 : 22,
          startZ: idx === 0 ? lane.minZ : lane.maxZ,
          minZ: lane.minZ,
          maxZ: lane.maxZ,
        }));
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
  if (characterControls) characterControls.update(dt, keysPressed);
  else controls.update();

  // Clamp player within environment bounds
  if (playerModel && worldBounds) {
    const pad = 0.5; // small padding so we don't intersect edges
    const px = THREE.MathUtils.clamp(playerModel.position.x, worldBounds.minX + pad, worldBounds.maxX - pad);
    const pz = THREE.MathUtils.clamp(playerModel.position.z, worldBounds.minZ + pad, worldBounds.maxZ - pad);
    playerModel.position.x = px;
    playerModel.position.z = pz;
  }

  // Move vehicles
  lanes.forEach((lane) => {
    lane.vehicles.forEach((v) => {
      v.mesh.position.z += v.speed * dt * v.dir;
      if (v.dir > 0 && v.mesh.position.z > lane.maxZ) v.mesh.position.z = lane.minZ;
      if (v.dir < 0 && v.mesh.position.z < lane.minZ) v.mesh.position.z = lane.maxZ;
    });
  });

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

  renderer.render(scene, camera);
});

// ------------------- Resize -------------------
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
