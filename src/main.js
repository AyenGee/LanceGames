import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === Scene Setup ===
const scene = new THREE.Scene();

// Load sky texture as background
const textureLoader = new THREE.TextureLoader();
textureLoader.load('/models/sky.jpeg', (texture) => {
    texture.encoding = THREE.sRGBEncoding; 
    scene.background = texture;
});

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
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
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// === Load Environment ===
const loader = new GLTFLoader();
let environment, obstacles = [], teleportTarget;

loader.load("/models/Gamestates.glb", (gltf) => {
    environment = gltf.scene;
    scene.add(environment);

    environment.traverse((child) => {
        if (child.isMesh) {
            child.geometry.computeBoundingBox();

            // Obstacles
            if (child.name.startsWith("Cube") || child.name.startsWith("Cylinder")) {
                const bbox = new THREE.Box3().setFromObject(child);
                obstacles.push(bbox);

                const helper = new THREE.Box3Helper(bbox, 0xff0000);
                scene.add(helper);
            }

            // Teleport target (Plane001)
            if (child.name === "Plane001") {
                teleportTarget = new THREE.Box3().setFromObject(child);
                const helper = new THREE.Box3Helper(teleportTarget, 0x00ff00);
                scene.add(helper);
            }
        }
    });
});

// === Load Soldier ===
let characterControls;
loader.load("/models/Soldier.glb", (gltf) => {
    const model = gltf.scene;
    model.scale.set(1, 1, 1);
    model.position.set(0, 0.1, 3);
    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const animationsMap = new Map();
    gltf.animations.forEach(clip => animationsMap.set(clip.name, mixer.clipAction(clip)));

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, "Idle");
});

// === Collision Check ===
function checkCollisions(character) {
    if (!obstacles.length) return false;

    const charBox = new THREE.Box3().setFromObject(character);

    // Obstacle collisions
    for (let obstacle of obstacles) {
        if (charBox.intersectsBox(obstacle)) return true;
    }

    // Teleport collision
    if (teleportTarget && charBox.intersectsBox(teleportTarget)) {
        teleportToMiniChallenge();
    }

    return false;
}

// === Teleport Function ===
function teleportToMiniChallenge() {
    window.location.href = "http://localhost:5173/crossRoad.html";
}

// === Animate Loop ===
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (characterControls) {
        const oldPos = characterControls.model.position.clone();
        characterControls.update(delta, keysPressed);

        if (checkCollisions(characterControls.model)) {
            characterControls.model.position.copy(oldPos);
        }
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
