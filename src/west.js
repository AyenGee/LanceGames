import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// --- Mouse Look ---
let mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;
let isMouseActive = false;

document.addEventListener('mousedown', () => {
    isMouseActive = true;
});

document.addEventListener('mouseup', () => {
    isMouseActive = false;
});

document.addEventListener('mousemove', (e) => {
    if (isFirstPerson && isMouseActive) {
        yaw -= e.movementX * mouseSensitivity;
        pitch -= e.movementY * mouseSensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        // Apply rotation to character + camera
        if (characterModel) {
            // Rotate the character left/right (yaw)
            characterModel.rotation.y = yaw;
        
            // Apply pitch as a quaternion rotation to the camera
            const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
            const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        
            const finalQuat = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch);
            camera.quaternion.copy(finalQuat);
        }
        
    }
});


// === Scene Setup ===
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Clock and key handling
const clock = new THREE.Clock();
const keysPressed = {};
document.addEventListener("keydown", e => keysPressed[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keysPressed[e.key.toLowerCase()] = false);

// Camera mode toggle
let isFirstPerson = false;
const CAMERA_TOGGLE_KEY = 'v'; // Press V to toggle camera mode

// OrbitControls (debug)
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

// Load sky texture as background
const textureLoader = new THREE.TextureLoader();
textureLoader.load('/models/sky.jpeg', (texture) => {
    texture.encoding = THREE.sRGBEncoding; 
    scene.background = texture;
});

// === Load West Environment ===
const loader = new GLTFLoader();
let environment;
let planeObject = null;
let characterModel = null;

loader.load("/models/west.glb", (gltf) => {
    environment = gltf.scene;
    scene.add(environment);

    // Find the Plane object and enable shadows
    environment.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Find the Plane object
            if (child.name === "Plane") {
                planeObject = child;
                console.log("Found Plane object:", child);
                
                // If character is already loaded, position it now
                if (characterModel) {
                    positionCharacterOnPlane();
                }
            }
        }
    });
});

// Function to position character on plane
function positionCharacterOnPlane() {
    if (characterModel && planeObject) {
        const bbox = new THREE.Box3().setFromObject(planeObject);
        const yPosition = bbox.max.y + 0.1; // Position slightly above the plane surface
        characterModel.position.y = yPosition;
        console.log("Plane bounding box:", bbox);
        console.log("Character Y position:", yPosition);
        
        // Position camera based on current mode
        updateCameraPosition();
    }
}

// Function to update camera position based on current mode
function updateCameraPosition() {
    if (!characterModel) return;

    const headHeight = 1.6; // Eye height
    const offsetBehind = new THREE.Vector3(0, 2, 5);

    if (isFirstPerson) {
        // Detach first to prevent transform conflicts
        scene.attach(camera);

        // Find character’s world rotation
        const charWorldQuat = new THREE.Quaternion();
        characterModel.getWorldQuaternion(charWorldQuat);

        // Compute eye position in world space
        const charPos = new THREE.Vector3();
        characterModel.getWorldPosition(charPos);
        const eyeOffset = new THREE.Vector3(0, headHeight, 0).applyQuaternion(charWorldQuat);
        const cameraPos = charPos.clone().add(eyeOffset);

        camera.position.copy(cameraPos);
        camera.quaternion.copy(charWorldQuat);

        // Disable orbit and attach smooth rotation control
        orbitControls.enabled = false;
    } else {
        // Third-person mode
        scene.attach(camera);

        const charPos = new THREE.Vector3();
        characterModel.getWorldPosition(charPos);

        // Offset behind and above the character
        const offset = offsetBehind.clone().applyQuaternion(characterModel.quaternion);
        camera.position.copy(charPos.clone().add(offset));

        camera.lookAt(charPos);
        orbitControls.enabled = true;
    }
}



// Function to toggle camera mode
function toggleCameraMode() {
    isFirstPerson = !isFirstPerson;
    updateCameraPosition();
    
    // Update character controls with new camera mode
    if (characterControls) {
        characterControls.setFirstPersonMode(isFirstPerson);
    }
    
    console.log(`Switched to ${isFirstPerson ? 'first' : 'third'} person view`);
}

// === Load Soldier Character ===
let characterControls;

loader.load("/models/Soldier.glb", (gltf) => {
    const model = gltf.scene;
    model.scale.set(2, 2, 2);
    model.castShadow = true;
    scene.add(model);
    
    // Store reference to character model
    characterModel = model;

    // Try to position character on plane if environment is already loaded
    if (planeObject) {
        positionCharacterOnPlane();
    } else {
        // Fallback: use a higher Y position
        model.position.set(0, 2, 3);
        console.log("Environment not loaded yet, using fallback Y position");
    }

    const mixer = new THREE.AnimationMixer(model);
    const animationsMap = new Map();
    gltf.animations.forEach(clip => animationsMap.set(clip.name, mixer.clipAction(clip)));

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, "Idle");
});

// Add keyboard event listener for camera toggle
document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === CAMERA_TOGGLE_KEY) {
        toggleCameraMode();
    }
});

// === Animation Loop ===
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (characterControls) {
        characterControls.update(delta, keysPressed);
        
        // Update camera position in first-person mode
        // if (isFirstPerson && characterModel) {
        //     updateCameraPosition();
        // }
    }

    orbitControls.update();
    renderer.render(scene, camera);
}

animate();

// === Window Resize ===
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
