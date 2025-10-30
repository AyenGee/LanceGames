import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === MOUSE LOOK SETTINGS ===
let mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;

// Pointer Lock for immersive mouse look (requested only in first-person mode)
document.body.addEventListener('click', () => {
    if (!renderer) return;
    // Only attempt pointer lock when in first-person and not already locked
    if (isFirstPerson && document.pointerLockElement !== renderer.domElement) {
        try {
            renderer.domElement.requestPointerLock();
        } catch (e) {
            console.warn('Pointer lock request failed:', e);
        }
    }
});

document.addEventListener('pointerlockchange', () => {
    if (!renderer) return;
    const locked = document.pointerLockElement === renderer.domElement;
    // Disable OrbitControls while locked to avoid pointer capture conflicts
    orbitControls.enabled = !locked && !isFirstPerson ? true : !locked;
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

// === OUTDOOR CAMPUS LIGHTING ===
// 1. Hemisphere Light (Sky + Ground ambient lighting for outdoor scenes)
const hemisphereLight = new THREE.HemisphereLight(
    0x87CEEB, // Sky blue color from above
    0x8B7355, // Ground/earth brown color from below
    0.6        // Intensity
);
scene.add(hemisphereLight);

// 2. Directional Light (Sunlight) - Main light source
const sunLight = new THREE.DirectionalLight(0xFFFFE0, 1.2); // Warm white sunlight
sunLight.position.set(50, 80, 40); // High up, mimicking afternoon sun
sunLight.castShadow = true;

// Configure shadow properties for realistic outdoor shadows
sunLight.shadow.mapSize.width = 4096;  // High resolution shadows
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunLight.shadow.bias = -0.0001; // Reduce shadow acne

scene.add(sunLight);

// 3. Additional Ambient Light for overall scene brightness
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.4); // Soft white ambient
scene.add(ambientLight);

// 4. Fill Light (Subtle directional from opposite side to soften shadows)
const fillLight = new THREE.DirectionalLight(0xB0C4DE, 0.3); // Light steel blue
fillLight.position.set(-30, 40, -30); // Opposite side of sun
scene.add(fillLight);

// Optional: Add fog for depth perception in outdoor scene
scene.fog = new THREE.Fog(0x87CEEB, 100, 300); // Sky blue fog

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
let npcs = []; // Array to store NPC collision boxes
let obstacles = []; // Array to store building/obstacle collision boxes

loader.load("/models/west.glb", (gltf) => {
    environment = gltf.scene;
    scene.add(environment);

    // Log all objects/meshes in the scene
    console.log('🔍 === WEST.GLB OBJECT NAMES ===');
    environment.traverse((child) => {
        console.log(`Name: "${child.name}" | Type: ${child.type}${child.isMesh ? ' (Mesh)' : ''}`);
        
        // Store NPCs for collision detection
        const npcNames = ["Human", "Human_1", "Human_2", "Low_Poly_Human", "Renzo"];
        if (npcNames.includes(child.name)) {
            child.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(child);
            npcs.push({ name: child.name, box: box, mesh: child });
            console.log(`✅ Added NPC collision box for: ${child.name}`);
        }
        
        // Store obstacles (Cube*, Cylinder*) for collision detection
        // Exclude: "Cube", "Cylinder", "Cylinder001", "Cylinder002"
        const excludedNames = ["Cube", "Cylinder", "Cylinder001", "Cylinder002","Cube001","Cube022"];
        if ((child.name.startsWith('Cube') || child.name.startsWith('Cylinder')) && 
            !excludedNames.includes(child.name)) {
            child.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(child);
            obstacles.push({ name: child.name, box: box, mesh: child });
            console.log(`✅ Added obstacle collision box for: ${child.name}`);
        } else if (excludedNames.includes(child.name)) {
            console.log(`⏭️  Skipping collision for excluded object: ${child.name}`);
        }
        
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.name === "Plane") {
                planeObject = child;
                const planeBox = new THREE.Box3().setFromObject(child);
                console.log("✅ Found Plane object for positioning:", child);
                console.log(`   Plane Y bounds: min=${planeBox.min.y.toFixed(2)}, max=${planeBox.max.y.toFixed(2)}`);
                if (characterModel) {
                    console.log(`   Character position before: y=${characterModel.position.y.toFixed(2)}`);
                    positionCharacterOnPlane();
                    console.log(`   Character position after: y=${characterModel.position.y.toFixed(2)}`);
                }
            }
        }
    });
    console.log('🔍 === END WEST.GLB LISTING ===');
    console.log(`✅ Found ${npcs.length} NPCs for collision detection`);
    console.log(`✅ Found ${obstacles.length} obstacles for collision detection`);
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
    
    // Initialize last character position for collision detection
    lastCharacterPosition.copy(model.position);

    const mixer = new THREE.AnimationMixer(model);
    const animationsMap = new Map();
    gltf.animations.forEach(clip => animationsMap.set(clip.name, mixer.clipAction(clip)));

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, "Idle");
});

// === POSITION CHARACTER ON GROUND ===
function positionCharacterOnPlane() {
    if (characterModel && planeObject) {
        // Calculate where the plane's top surface is
        const bbox = new THREE.Box3().setFromObject(planeObject);
        const yPosition = bbox.max.y;
        
        // Position character at the plane's surface
        characterModel.position.y = yPosition;
        
        // Update last known position for collision detection
        lastCharacterPosition.copy(characterModel.position);
        
        console.log(`✅ Character positioned on Plane at y=${yPosition.toFixed(2)}`);
    }
}

// === MESSAGE DISPLAY ===
let messageTimeout = null;
function showMessage(text) {
    // Remove existing message if any
    const existingMsg = document.getElementById('npc-message');
    if (existingMsg) {
        existingMsg.remove();
        if (messageTimeout) clearTimeout(messageTimeout);
    }
    
    // Create message element
    const msg = document.createElement('div');
    msg.id = 'npc-message';
    msg.textContent = text;
    msg.style.position = 'fixed';
    msg.style.top = '50%';
    msg.style.left = '50%';
    msg.style.transform = 'translate(-50%, -50%)';
    msg.style.background = 'rgba(0, 0, 0, 0.8)';
    msg.style.color = '#fff';
    msg.style.padding = '20px 40px';
    msg.style.borderRadius = '10px';
    msg.style.fontSize = '24px';
    msg.style.fontFamily = 'sans-serif';
    msg.style.zIndex = '10000';
    msg.style.pointerEvents = 'none';
    document.body.appendChild(msg);
    
    // Remove message after 2 seconds
    messageTimeout = setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transition = 'opacity 0.5s';
        setTimeout(() => msg.remove(), 500);
    }, 2000);
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
            
            // Position camera at character's head height (adjusted for ground)
            camera.position.copy(charPos);
            const headHeight = planeObject ? 
                new THREE.Box3().setFromObject(planeObject).max.y + 1.5 : 
                charPos.y + 1.5;
            camera.position.y = headHeight;
            
            // Set camera rotation to match character
            yaw = characterModel.rotation.y;
            pitch = 0;
            
            // Hide character
            characterModel.visible = false;
        }
        
        // Disable orbit controls
        orbitControls.enabled = false;
        // Request pointer lock on entering first-person
        try { renderer.domElement.requestPointerLock(); } catch {}
        
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
        
        // Exit pointer lock if active and re-enable orbit controls
        if (document.pointerLockElement === renderer.domElement) {
            try { document.exitPointerLock(); } catch {}
        }
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

// === COLLISION DETECTION ===
let lastCollisionNPC = null; // Track last NPC to prevent spam
let lastCharacterPosition = new THREE.Vector3();

function checkCollisions() {
    if (!characterModel) return;
    
    const currentPosition = characterModel.position.clone();
    
    // Clamp character Y position to plane surface if plane exists
    if (planeObject) {
        const planeBox = new THREE.Box3().setFromObject(planeObject);
        const minY = planeBox.max.y;
        if (characterModel.position.y < minY) {
            characterModel.position.y = minY;
        }
    }
    
    // Get character bounding box
    const charBox = new THREE.Box3().setFromObject(characterModel);
    
    // Check collision with obstacles (buildings)
    for (const obstacle of obstacles) {
        const currentBox = new THREE.Box3().setFromObject(obstacle.mesh);
        
        if (charBox.intersectsBox(currentBox)) {
            // Collision with building - revert to last valid position
            characterModel.position.copy(lastCharacterPosition);
            console.log(`⚠️ Collision with ${obstacle.name} - movement blocked`);
            return; // Exit early to prevent further movement
        }
    }
    
    // Check collision with NPCs (only if not colliding with obstacles)
    if (npcs.length > 0) {
        // Use expanded box for easier NPC detection
        const npcDetectionBox = charBox.clone().expandByScalar(0.5);
        
        for (const npc of npcs) {
            const currentBox = new THREE.Box3().setFromObject(npc.mesh);
            
            if (npcDetectionBox.intersectsBox(currentBox)) {
                // Collision detected with NPC
                if (lastCollisionNPC !== npc.name) {
                    lastCollisionNPC = npc.name;
                    showMessage("Report signed");
                    console.log(`✅ Collision with ${npc.name} - Report signed!`);
                }
                break; // Only show one message at a time
            }
        }
    }
    
    // Update last valid position if no obstacle collision
    lastCharacterPosition.copy(currentPosition);
    
    // Reset last collision NPC if no NPC collision detected
    if (lastCollisionNPC) {
        const npcDetectionBox = charBox.clone().expandByScalar(0.5);
        let stillColliding = false;
        for (const npc of npcs) {
            const currentBox = new THREE.Box3().setFromObject(npc.mesh);
            if (npcDetectionBox.intersectsBox(currentBox)) {
                stillColliding = true;
                break;
            }
        }
        if (!stillColliding) {
            lastCollisionNPC = null;
        }
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
    
    // Check for NPC collisions
    checkCollisions();

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