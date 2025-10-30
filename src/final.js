import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

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

// Load final scene and capture Plane
loader.load('/models/final.glb', (gltf) => {
  const env = gltf.scene;
  env.scale.set(SCENE_SCALE, SCENE_SCALE, SCENE_SCALE);
  env.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.name === 'Plane') planeObject = obj;
    }
  });
  scene.add(env);
  
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
  if (characterControls) characterControls.update(dt, keysPressed);
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
    console.log(`Soldier position → x=${playerModel.position.x.toFixed(2)}, y=${playerModel.position.y.toFixed(2)}, z=${playerModel.position.z.toFixed(2)}`);
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


