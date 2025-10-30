import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// Disable console.log output in production
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

// Load final scene and capture Plane
loader.load('/models/final.glb', (gltf) => {
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
loader.load('/models/Soldier.glb', (gltf) => {
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
  characterControls = new CharacterControls(playerModel, mixer, animationsMap, controls, camera, 'Idle');
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

