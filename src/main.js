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

// === UI: Message Overlay ===
let messageEl = null;
function setupMessageOverlay() {
    messageEl = document.createElement('div');
    messageEl.style.position = 'fixed';
    messageEl.style.top = '20px';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translateX(-50%)';
    messageEl.style.padding = '10px 16px';
    messageEl.style.background = 'rgba(0,0,0,0.7)';
    messageEl.style.color = '#fff';
    messageEl.style.fontFamily = 'sans-serif';
    messageEl.style.fontSize = '14px';
    messageEl.style.borderRadius = '6px';
    messageEl.style.zIndex = '9999';
    messageEl.style.display = 'none';
    document.body.appendChild(messageEl);
}

function showMessage(text, ms = 2000) {
    if (!messageEl) setupMessageOverlay();
    messageEl.textContent = text;
    messageEl.style.display = 'block';
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => {
        messageEl.style.display = 'none';
    }, ms);
}

setupMessageOverlay();

// === Start Screen (Instructions) ===
let gameStarted = false;
(function setupStartOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = 'sans-serif';
    overlay.style.padding = '24px';
    overlay.style.textAlign = 'center';
    overlay.style.zIndex = '10000';

    const text = document.createElement('div');
    text.style.maxWidth = '720px';
    text.style.marginBottom = '16px';
    text.style.lineHeight = '1.5';
    text.textContent = 'find the report and submit it before time runs out. NOTE, there are multiple challenges in the way.  PLAY!';

    const btn = document.createElement('button');
    btn.textContent = 'PLAY';
    btn.style.cursor = 'pointer';
    btn.style.padding = '10px 18px';
    btn.style.fontSize = '16px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.background = '#00a86b';
    btn.style.color = '#fff';

    btn.addEventListener('click', () => {
        gameStarted = true;
        gameEnded = false;
        timeMsLeft = timeMsTotal;
        overlay.remove();
    });

    overlay.appendChild(text);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
})();

// === Collectibles: Reports (3 papers) ===
const paperBoxes = [];
const papers = [];
let reportsCollected = 0;
const totalReports = 3;
let allReportsAnnounced = false;

// HUD for reports count + timer
let hudEl = null;
let hudTextEl = null;
let pauseBtn = null;
let playBtn = null;
let timeMsTotal = 120000; // 2 minutes
let timeMsLeft = timeMsTotal;
let gameEnded = false;
let gamePaused = false;
function setupHUD() {
    hudEl = document.createElement('div');
    hudEl.style.position = 'fixed';
    hudEl.style.top = '20px';
    hudEl.style.left = '20px';
    hudEl.style.padding = '10px 12px';
    hudEl.style.background = 'rgba(0,0,0,0.5)';
    hudEl.style.color = '#fff';
    hudEl.style.fontFamily = 'sans-serif';
    hudEl.style.fontSize = '14px';
    hudEl.style.borderRadius = '6px';
    hudEl.style.zIndex = '9999';
    hudEl.style.display = 'flex';
    hudEl.style.flexDirection = 'column';
    hudEl.style.gap = '8px';

    hudTextEl = document.createElement('div');
    hudTextEl.textContent = '';

    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.gap = '8px';

    pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.cursor = 'pointer';
    pauseBtn.style.padding = '6px 10px';
    pauseBtn.style.border = 'none';
    pauseBtn.style.borderRadius = '4px';
    pauseBtn.style.background = '#cc3333';
    pauseBtn.style.color = '#fff';
    pauseBtn.addEventListener('click', () => {
        if (!gameStarted || gameEnded) return;
        gamePaused = true;
    });

    playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.style.cursor = 'pointer';
    playBtn.style.padding = '6px 10px';
    playBtn.style.border = 'none';
    playBtn.style.borderRadius = '4px';
    playBtn.style.background = '#00a86b';
    playBtn.style.color = '#fff';
    playBtn.addEventListener('click', () => {
        if (gameEnded) return; // prevent resume after end
        gameStarted = true;
        gamePaused = false;
    });

    controlsRow.appendChild(playBtn);
    controlsRow.appendChild(pauseBtn);

    hudEl.appendChild(hudTextEl);
    hudEl.appendChild(controlsRow);
    document.body.appendChild(hudEl);
    updateHUD();
}

function formatTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateHUD() {
    if (hudTextEl) hudTextEl.textContent = `Reports: ${reportsCollected}/${totalReports} | Time: ${formatTime(timeMsLeft)}`;
}

function spawnPapers() {
    const positions = [
        new THREE.Vector3(1.2, 1.5, 2.5),
        new THREE.Vector3(-2.0, 1.5, -1.5),
        new THREE.Vector3(3.0, 1.5, -3.0),
    ];
    const geo = new THREE.PlaneGeometry(0.6, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });

    positions.slice(0, totalReports).forEach((pos) => {
        const paper = new THREE.Mesh(geo, mat.clone());
        paper.rotation.x = -Math.PI / 2;
        paper.position.copy(pos);
        paper.castShadow = false;
        paper.receiveShadow = true;
        paper.userData.collected = false;
        scene.add(paper);
        papers.push(paper);
        paperBoxes.push(new THREE.Box3());
    });
}

setupHUD();
spawnPapers();

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

    // Teleport collision (requires all reports)
    if (teleportTarget && charBox.intersectsBox(teleportTarget)) {
        if (reportsCollected >= totalReports) {
            teleportToMiniChallenge();
        } else {
            showMessage('Collect all 3 reports');
        }
    }

    // Reports pickup (collectibles)
    for (let i = 0; i < papers.length; i++) {
        const p = papers[i];
        if (!p || p.userData.collected) continue;
        paperBoxes[i].setFromObject(p);
        if (charBox.intersectsBox(paperBoxes[i])) {
            p.userData.collected = true;
            reportsCollected++;
            updateHUD();
            showMessage('Report found!');
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            papers[i] = null;
            if (!allReportsAnnounced && reportsCollected >= totalReports) {
                allReportsAnnounced = true;
                showMessage('All reports collected! Go through the portal.');
            }
        }
    }

    return false;
}

// === Teleport Function ===
function teleportToMiniChallenge() {
    // Persist game HUD/state for next scene
    const state = {
        reportsCollected,
        totalReports,
        timeMsLeft,
    };
    localStorage.setItem("gameState", JSON.stringify(state));

    window.location.href = "http://localhost:5173/carcross.html";
}

// === Animate Loop ===
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (characterControls && gameStarted && !gameEnded && !gamePaused) {
        const oldPos = characterControls.model.position.clone();
        characterControls.update(delta, keysPressed);

        if (checkCollisions(characterControls.model)) {
            characterControls.model.position.copy(oldPos);
        }
    }

    // Timer countdown
    if (gameStarted && !gameEnded && !gamePaused) {
        timeMsLeft -= delta * 1000;
        if (timeMsLeft <= 0) {
            timeMsLeft = 0;
            gameEnded = true;
            gameStarted = false;
            showMessage('Time is up!');
        }
        updateHUD();
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
