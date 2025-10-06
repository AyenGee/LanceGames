import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// ------------------- Scene & Camera -------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);
camera.lookAt(0, 0, 0);

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
controls.target.set(0, 0, 0);

// ------------------- Loaders -------------------
const loader = new GLTFLoader();

// Vehicle templates
let carTemplate1 = null;
let carTemplate2 = null;

// Lanes
const laneSpecs = [
  { x: -4.0, speed: 6.0, dir: 1, template: 'car1', count: 3, spacing: 18, startZ: -60 },
  { x:  0.0, speed: 8.0, dir: -1, template: 'car2', count: 2, spacing: 22, startZ:  60 },
  { x:  4.0, speed: 7.0, dir: 1, template: 'car1', count: 2, spacing: 24, startZ: -60 },
];
const lanes = [];

// ------------------- Helper Functions -------------------
function setShadowFlags(object3d) {
  object3d.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
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
  let clone;
  if (template.isMesh) {
    clone = template.clone(true);
  } else {
    // if group, clone the first mesh child
    const mesh = template.getObjectByProperty('type', 'Mesh');
    clone = mesh ? mesh.clone(true) : template.clone(true);
  }
  setShadowFlags(clone);
  clone.position.set(x, 0, z);
  scene.add(clone);
  return clone;
}

function buildLanes() {
  const minZ = -60;
  const maxZ = 60;

  laneSpecs.forEach((spec) => {
    const template = spec.template === 'car1' ? carTemplate1 : carTemplate2;
    if (!template) return;

    const vehicles = [];
    for (let i = 0; i < spec.count; i++) {
      const z = spec.startZ + (spec.dir > 0 ? i * spec.spacing : -i * spec.spacing);
      const mesh = cloneVehicle(template, spec.x, z);
      if (mesh) vehicles.push({ mesh, speed: spec.speed, dir: spec.dir });
    }
    lanes.push({ x: spec.x, vehicles, minZ, maxZ });
  });
}

// ------------------- Load Environment -------------------
loader.load(
  '/models/scene.glb',
  (gltf) => {
    const env = gltf.scene;
    setShadowFlags(env);
    scene.add(env);

    // Find car templates
    carTemplate1 = findByNameDeep(env, 'car1');
    carTemplate2 = findByNameDeep(env, 'car2');

    if (!carTemplate1 && !carTemplate2) {
      console.warn('No car1/car2 found in scene.glb');
    }

    if (carTemplate1) carTemplate1.visible = false;
    if (carTemplate2) carTemplate2.visible = false;

    buildLanes();
  },
  undefined,
  (err) => console.error('Failed to load environment scene.glb', err)
);

// ------------------- Load Character -------------------
let characterControls = null;
let playerModel = null;

loader.load(
  '/models/Soldier.glb',
  (gltf) => {
    playerModel = gltf.scene;
    setShadowFlags(playerModel);
    playerModel.position.set(0, 0, 0);
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

  // Move vehicles
  lanes.forEach((lane) => {
    lane.vehicles.forEach((v) => {
      v.mesh.position.z += v.speed * dt * v.dir;
      if (v.dir > 0 && v.mesh.position.z > lane.maxZ) v.mesh.position.z = lane.minZ;
      if (v.dir < 0 && v.mesh.position.z < lane.minZ) v.mesh.position.z = lane.maxZ;
    });
  });

  // Simple collision
  if (playerModel) {
    const playerBox = new THREE.Box3().setFromObject(playerModel);
    let hit = false;
    for (const lane of lanes) {
      for (const v of lane.vehicles) {
        const box = new THREE.Box3().setFromObject(v.mesh);
        if (playerBox.intersectsBox(box)) { hit = true; break; }
      }
      if (hit) {
        // Reset player
        playerModel.position.set(0, 0, 0);
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
