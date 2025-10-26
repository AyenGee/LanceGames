import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === MOUSE LOOK SETTINGS ===
let mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;

// Pointer Lock for immersive mouse look
document.body.addEventListener('click', () => {
    renderer?.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
    // No need for isMouseActive flag
});

// === SCENE SETUP ===
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Clock and key input
const clock = new THREE.Clock();
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

// Lights
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10);
light.castShadow = true;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// Background
const textureLoader = new THREE.TextureLoader();
textureLoader.load('/models/sky.jpeg', (texture) => {
    texture.encoding = THREE.sRGBEncoding;
    scene.background = texture;
});

// === LOAD ENVIRONMENT ===
const loader = new GLTFLoader();
let environment;
let planeObject = null;
let characterModel = null;

loader.load("/models/west.glb", (gltf) => {
    environment = gltf.scene;
    scene.add(environment);

    environment.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.name === "Plane") {
                planeObject = child;
                console.log("Found Plane object:", child);
                if (characterModel) positionCharacterOnPlane();
            }
        }
    });
});

// === LOAD CHARACTER ===
let characterControls;

loader.load("/models/Soldier.glb", (gltf) => {
    const model = gltf.scene;
    model.scale.set(2, 2, 2);
    model.castShadow = true;
    scene.add(model);

    characterModel = model;

    if (planeObject) positionCharacterOnPlane();
    else model.position.set(0, 2, 3);

    const mixer = new THREE.AnimationMixer(model);
    const animationsMap = new Map();
    gltf.animations.forEach(clip => animationsMap.set(clip.name, mixer.clipAction(clip)));

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, "Idle");
});

// === POSITION CHARACTER ON GROUND ===
function positionCharacterOnPlane() {
    if (characterModel && planeObject) {
        const bbox = new THREE.Box3().setFromObject(planeObject);
        const yPosition = bbox.max.y + 0.1;
        characterModel.position.y = yPosition;
    }
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
            
            // Position camera at character's head height
            camera.position.copy(charPos);
            camera.position.y += 2.5; // Head height
            
            // Set camera rotation to match character
            yaw = characterModel.rotation.y;
            pitch = 0;
            
            // Hide character
            characterModel.visible = false;
        }
        
        // Disable orbit controls
        orbitControls.enabled = false;
        
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
        
        // Enable orbit controls
        orbitControls.enabled = true;
        orbitControls.target.copy(characterModel.position);
        
        console.log('Switched to third-person view');
    }
}

// === MOUSE LOOK (First-Person Only) ===
document.addEventListener('mousemove', (e) => {
    if (isFirstPerson && document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * mouseSensitivity;
        pitch -= e.movementY * mouseSensitivity;
        // Clamp pitch to prevent over-rotation
        pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    }
});

// === FIRST-PERSON MOVEMENT ===
function updateFirstPersonCamera(delta) {
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

// === ANIMATION LOOP ===
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

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

    renderer.render(scene, camera);
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
});