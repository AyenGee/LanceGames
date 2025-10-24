import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

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
        
        // Position camera behind and above the character
        camera.position.set(0, yPosition + 2, 5);
        console.log("Camera positioned at:", camera.position);
    }
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

// === Animation Loop ===
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (characterControls) {
        characterControls.update(delta, keysPressed);
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
