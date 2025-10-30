import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// Disable console.log output in production
try { if (console && typeof console.log === 'function') console.log = () => {}; } catch {}

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
// Audio listener and footstep sound
const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();
const footstepSound = new THREE.Audio(listener);
audioLoader.load('assets/ES_Boots, Walking, Concrete 01 - Epidemic Sound.mp3', function(buffer) {
    footstepSound.setBuffer(buffer);
    footstepSound.setLoop(true);
    footstepSound.setVolume(0.5);
});

// === Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 1.2; // keep camera close indoors
controls.maxDistance = 1.8;
controls.zoomSpeed = 0.5;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // avoid going below ground

// === Shared Timer (Persistent Across Pages) ===
const TIMER_KEY = 'gameTimer';
const SIGN_KEY = 'signatures';
function readPersistedTimer() {
    try {
        const raw = localStorage.getItem(TIMER_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj.timeMsLeft !== 'number') return null;
        const last = typeof obj.lastUpdate === 'number' ? obj.lastUpdate : Date.now();
        const running = !!obj.running;
        let left = obj.timeMsLeft;
        if (running) {
            const delta = Date.now() - last;
            left = Math.max(0, left - delta);
        }
        return { timeMsLeft: left };
    } catch { return null; }
}
function persistTimerState(timeMsLeft, running) {
    try { localStorage.setItem(TIMER_KEY, JSON.stringify({ timeMsLeft, lastUpdate: Date.now(), running: !!running })); } catch {}
}
function readSignatures() {
    try {
        const raw = localStorage.getItem(SIGN_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr);
    } catch { return new Set(); }
}
function persistSignatures(sigSet) {
    try { localStorage.setItem(SIGN_KEY, JSON.stringify(Array.from(sigSet))); } catch {}
}
function getSignatureCount() { return readSignatures().size; }
let timeMsTotal = 180000;
let timeMsLeft = (readPersistedTimer()?.timeMsLeft) ?? (timeMsTotal);
let timerPaused = false;
function formatTime(ms) { const totalSec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(totalSec / 60).toString().padStart(2, '0'); const s = (totalSec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }

// Consistent HUD (progress bar like main.js)
let hudEl = null; let pauseBtn = null; let playBtn = null;
function updateHUD() {
    const progressBar = document.getElementById('time-progress-bar');
    if (progressBar) {
        const progressPercent = (timeMsLeft / timeMsTotal) * 100;
        progressBar.style.width = `${Math.max(0, progressPercent)}%`;
        progressBar.classList.remove('time-progress-bar--ok', 'time-progress-bar--mid', 'time-progress-bar--low');
        if (progressPercent < 25) { progressBar.classList.add('time-progress-bar--low'); }
        else if (progressPercent < 50) { progressBar.classList.add('time-progress-bar--mid'); }
        else { progressBar.classList.add('time-progress-bar--ok'); }
    }
    const reportsCounterEl = document.getElementById('reports-counter');
    if (reportsCounterEl) {
        reportsCounterEl.textContent = `${getSignatureCount()}/3`;
    }
}
function setupHUD() {
    hudEl = document.createElement('div');
    hudEl.className = 'hud';
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.id = 'time-progress-bar';
    progressBar.className = 'time-progress-bar';
    progressContainer.appendChild(progressBar);
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';
    playBtn = document.createElement('button');
    playBtn.className = 'btn btn--play';
    playBtn.textContent = '▶ PLAY';
    playBtn.addEventListener('click', () => { timerPaused = false; persistTimerState(timeMsLeft, true); });
    pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn btn--pause';
    pauseBtn.textContent = '⏸ PAUSE';
    pauseBtn.addEventListener('click', () => { timerPaused = true; persistTimerState(timeMsLeft, false); });
    controlsRow.appendChild(playBtn); controlsRow.appendChild(pauseBtn);
    hudEl.appendChild(progressContainer);
    // Add signatures counter
    const reportsContainer = document.createElement('div');
    const reportsLabel = document.createElement('div');
    reportsLabel.textContent = 'REPORTS:';
    const reportsCounter = document.createElement('div');
    reportsCounter.id = 'reports-counter';
    reportsContainer.appendChild(reportsLabel);
    reportsContainer.appendChild(reportsCounter);
    hudEl.appendChild(reportsContainer);
    hudEl.appendChild(controlsRow);
    document.body.appendChild(hudEl);
    updateHUD();
}
setupHUD();

// === First-Person Controls (like west.js/main.js) ===
let mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;
let isFirstPerson = false;
const CAMERA_TOGGLE_KEY = 'v';
const moveSpeed = 5.0;

// Request pointer lock only in first-person mode
document.body.addEventListener('click', () => {
    if (isFirstPerson && document.pointerLockElement !== renderer.domElement) {
        try { renderer.domElement.requestPointerLock(); } catch (e) { console.warn('Pointer lock request failed:', e); }
    }
});

// Keep OrbitControls disabled during FPS + pointer lock
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    controls.enabled = !isFirstPerson && !locked;
});

// Mouse look for FPS
document.addEventListener('mousemove', (e) => {
    if (isFirstPerson && document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * mouseSensitivity;
        pitch -= e.movementY * mouseSensitivity;
        pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    }
});

function updateFirstPersonCamera(delta) {
    if (!isFirstPerson) return;
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    const finalQuat = new THREE.Quaternion();
    finalQuat.multiplyQuaternions(qYaw, qPitch);
    camera.quaternion.copy(finalQuat);

    const moveVector = new THREE.Vector3();
    if (keysPressed['w']) moveVector.z -= 1;
    if (keysPressed['s']) moveVector.z += 1;
    if (keysPressed['a']) moveVector.x -= 1;
    if (keysPressed['d']) moveVector.x += 1;
    if (moveVector.length() > 0) {
        moveVector.normalize();
        const moveQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        moveVector.applyQuaternion(moveQuat);
        moveVector.multiplyScalar(moveSpeed * delta);
        camera.position.add(moveVector);
    }
}

function toggleCameraMode() {
    isFirstPerson = !isFirstPerson;
    if (isFirstPerson) {
        if (playerModel) {
            const charPos = new THREE.Vector3();
            playerModel.getWorldPosition(charPos);
            camera.position.copy(charPos);
            // Base head height on floor to avoid accumulated Y drift
            const planeY = planeObject ? new THREE.Box3().setFromObject(planeObject).max.y : charPos.y;
            camera.position.y = planeY + 1.5;
            yaw = playerModel.rotation.y;
            pitch = 0;
            playerModel.visible = false;
        } else {
            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            yaw = euler.y; pitch = 0;
        }
        controls.enabled = false;
        try { renderer.domElement.requestPointerLock(); } catch {}
        console.log('Switched to first-person view (labs)');
    } else {
        if (playerModel) {
            // Snap player to floor on exit, copying X/Z from camera, and fixing Y to plane top
            const planeY = planeObject ? new THREE.Box3().setFromObject(planeObject).max.y : playerModel.position.y;
            playerModel.position.set(camera.position.x, planeY, camera.position.z);
            playerModel.rotation.y = yaw;
            playerModel.visible = true;
            // Place camera close behind character for indoor scene
            const offset = new THREE.Vector3(0, 1.5, 1.6);
            offset.applyQuaternion(playerModel.quaternion);
            camera.position.copy(playerModel.position.clone().add(offset));
            camera.lookAt(playerModel.position);
            // Log heights when exiting FPS
            console.log(`📏 Heights (exit FPS) → Soldier Y=${playerModel.position.y.toFixed(2)} | Plane004 Y=${planeY !== null ? planeY.toFixed(2) : 'n/a'}`);
        }
        if (document.pointerLockElement === renderer.domElement) {
            try { document.exitPointerLock(); } catch {}
        }
        controls.enabled = true;
        console.log('Switched to third-person view (labs)');
    }
}

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
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 4.0);
hemisphereLight.position.set(0, 10, 0);
scene.add(hemisphereLight);

// 6. Soft fill lights to gently brighten darker areas
const softFillDir = new THREE.DirectionalLight(0xfff2cc, 0.25);
softFillDir.position.set(-6, 6, 4);
softFillDir.castShadow = false;
scene.add(softFillDir);

const softFillPoint = new THREE.PointLight(0xffffff, 0.3, 100);
softFillPoint.position.set(0, 4, 0);
softFillPoint.castShadow = false;
scene.add(softFillPoint);

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
let hasTeleportedToWest = false; // prevent multiple redirects
let line211Mesh = null; // teleporter back to west
let labHumanMesh = null; // the NPC in labs that grants the final signature

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
        // Find teleporter back to west; adjust name if needed in the model
        if (obj.name === 'Line211') line211Mesh = obj;
        if (obj.name === 'Human') labHumanMesh = obj; // final signature in labs
    });
    if (planeObject) {
        const planeBox = new THREE.Box3().setFromObject(planeObject);
        console.log(`✅ Plane004 found. Y max=${planeBox.max.y.toFixed(2)}`);
        if (playerModel) {
            console.log(`📏 Heights → Soldier Y=${playerModel.position.y.toFixed(2)} | Plane004 Y=${planeBox.max.y.toFixed(2)}`);
        }
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
        console.log(`📏 Heights (on load) → Soldier Y=${playerModel.position.y.toFixed(2)} | Plane004 Y=${planeBox.max.y.toFixed(2)}`);
    } else {
        console.log(`📏 Heights (on load) → Soldier Y=${playerModel.position.y.toFixed(2)} | Plane004 Y=n/a`);
    }
    
    scene.add(playerModel);

    const mixer = new THREE.AnimationMixer(playerModel);
    const animationsMap = new Map();
    gltf.animations.forEach((clip) => {
        animationsMap.set(clip.name, mixer.clipAction(clip));
    });

    characterControls = new CharacterControls(playerModel, mixer, animationsMap, controls, camera, 'Idle', footstepSound);
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

// Camera toggle key (V)
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === CAMERA_TOGGLE_KEY) toggleCameraMode();
});

// === Animate ===
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    
    const dt = clock.getDelta();
    
    if (isFirstPerson) {
        updateFirstPersonCamera(dt);
    } else {
        if (characterControls) {
            characterControls.update(dt, keysPressed);
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
        }
        controls.update();
    }

    // Collect final signature from labs Human
    if (playerModel && labHumanMesh) {
        const sigs = readSignatures();
        const uniqueId = 'labs:Human';
        const charBox = new THREE.Box3().setFromObject(playerModel);
        const humanBox = new THREE.Box3().setFromObject(labHumanMesh);
        if (!sigs.has(uniqueId) && charBox.intersectsBox(humanBox)) {
            sigs.add(uniqueId);
            persistSignatures(sigs);
            const count = sigs.size;
            const reportsCounterEl = document.getElementById('reports-counter');
            if (reportsCounterEl) reportsCounterEl.textContent = `${count}/3`;
            console.log(`✅ Signature recorded for ${uniqueId} → ${count}/3`);
        }
    }

    // Teleport back to West when touching Line211
    if (!hasTeleportedToWest && playerModel && line211Mesh) {
        const charBox = new THREE.Box3().setFromObject(playerModel);
        const lineBox = new THREE.Box3().setFromObject(line211Mesh);
        if (charBox.intersectsBox(lineBox)) {
            hasTeleportedToWest = true;
            console.log('🚪 Touching Line211 → teleporting to west.html');
            // Persist current timer state before navigating
            persistTimerState(timeMsLeft, false);
            window.location.href = 'west.html';
            return;
        }
    }
    // Timer update & persist
    if (!timerPaused) {
        timeMsLeft -= dt * 1000;
        if (timeMsLeft <= 0) { timeMsLeft = 0; timerPaused = true; }
        updateHUD();
        persistTimerState(timeMsLeft, true);
    }
    renderer.render(scene, camera);
}

animate();

// === Resize ===
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

