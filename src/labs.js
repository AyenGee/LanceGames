import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === Scene Setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Light gray background

// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// === Camera ===
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// === Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// === Lighting for Indoor Lab Environment ===
// 1. Ambient light (base illumination)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// 2. Main directional light (simulating overhead lights)
const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
mainLight.position.set(0, 10, 0);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
mainLight.shadow.camera.left = -20;
mainLight.shadow.camera.right = 20;
mainLight.shadow.camera.top = 20;
mainLight.shadow.camera.bottom = -20;
scene.add(mainLight);

// 3. Additional point lights for room illumination (ceiling lights)
const pointLight1 = new THREE.PointLight(0xffffff, 0.7, 20);
pointLight1.position.set(-5, 8, -5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xffffff, 0.7, 20);
pointLight2.position.set(5, 8, -5);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0xffffff, 0.7, 20);
pointLight3.position.set(-5, 8, 5);
scene.add(pointLight3);

const pointLight4 = new THREE.PointLight(0xffffff, 0.7, 20);
pointLight4.position.set(5, 8, 5);
scene.add(pointLight4);

// 4. Warm accent lights (for desk/work areas)
const accentLight1 = new THREE.PointLight(0xffebcd, 0.4, 15);
accentLight1.position.set(0, 3, 0);
scene.add(accentLight1);

const accentLight2 = new THREE.PointLight(0xe6ffe6, 0.3, 15);
accentLight2.position.set(8, 3, 0);
scene.add(accentLight2);

// 5. Hemisphere light for subtle environmental lighting
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
hemisphereLight.position.set(0, 10, 0);
scene.add(hemisphereLight);

// === Helper Functions ===
function setShadowFlags(object3d) {
    object3d.traverse((obj) => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });
}

// === Load Labs Environment ===
const loader = new GLTFLoader();
let environment;
let playerModel = null;
let playerStart = null;
let planeObject = null; // Floor named Plane004

loader.load("/models/labs.glb", (gltf) => {
    environment = gltf.scene;
    setShadowFlags(environment);
    scene.add(environment);
    
    console.log('✅ Labs environment loaded successfully');
    
    // Log all objects in the scene for debugging
    console.log('🔍 === LABS.GLB OBJECT NAMES ===');
    environment.traverse((obj) => {
        console.log(`Name: "${obj.name}" | Type: ${obj.type}`);
    });
    console.log('🔍 === END LABS.GLB LISTING ===');
    
    // Find floor Plane004 and player spawn
    planeObject = null;
    environment.traverse((obj) => {
        if (obj.name === 'Plane004') planeObject = obj;
    });
    if (planeObject) {
        const planeBox = new THREE.Box3().setFromObject(planeObject);
        console.log(`✅ Plane004 found. Y max=${planeBox.max.y.toFixed(2)}`);
    } else {
        console.warn('⚠️ Plane004 not found in labs.glb');
    }

    // Find player spawn point (look for common naming patterns)
    const spawnMesh = findByNameDeep(environment, 'cube') || 
                      findByNameDeep(environment, 'spawn') ||
                      findByNameDeep(environment, 'start');
    
    if (spawnMesh) {
        const spawnBox = new THREE.Box3().setFromObject(spawnMesh);
        const spawnCenter = new THREE.Vector3();
        spawnBox.getCenter(spawnCenter);
        // Use spawn XZ but align Y to Plane004 top if available
        let y = spawnBox.max.y + 0.1;
        if (planeObject) {
            const planeBox = new THREE.Box3().setFromObject(planeObject);
            y = planeBox.max.y; // stand on floor
        }
        playerStart = new THREE.Vector3(spawnCenter.x, y, spawnCenter.z);
        console.log('✅ Player spawn found at:', playerStart);
        
        if (playerModel) {
            playerModel.position.copy(playerStart);
        }
    } else {
        console.warn('⚠️ No spawn point found, using default position');
        playerStart = new THREE.Vector3(0, 1, 0);
    }
}, undefined, (err) => {
    console.error('❌ Failed to load labs.glb:', err);
});

// === Helper: Find Object by Name ===
function findByNameDeep(root, nameLower) {
    let found = null;
    root.traverse((child) => {
        if (found) return;
        const n = (child.name || '').toLowerCase();
        if (n === nameLower.toLowerCase()) found = child;
    });
    return found;
}

// === Load Character ===
let characterControls = null;

loader.load("/models/Soldier.glb", (gltf) => {
    playerModel = gltf.scene;
    setShadowFlags(playerModel);
    
    if (playerStart) {
        playerModel.position.copy(playerStart);
    } else {
        playerModel.position.set(0, 1, 0);
    }
    // Ensure character stands on Plane004 if available
    if (planeObject) {
        const planeBox = new THREE.Box3().setFromObject(planeObject);
        playerModel.position.y = planeBox.max.y;
    }
    
    scene.add(playerModel);

    const mixer = new THREE.AnimationMixer(playerModel);
    const animationsMap = new Map();
    gltf.animations.forEach((clip) => {
        animationsMap.set(clip.name, mixer.clipAction(clip));
    });

    characterControls = new CharacterControls(playerModel, mixer, animationsMap, controls, camera, 'Idle');
    console.log('✅ Character loaded successfully');
}, undefined, (err) => {
    console.error('❌ Failed to load Soldier.glb:', err);
});

// === Input ===
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

// === Animate ===
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    
    const dt = clock.getDelta();
    
    if (characterControls) {
        characterControls.update(dt, keysPressed);
    }
    
    controls.update();
    renderer.render(scene, camera);
}

animate();

// === Resize ===
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

