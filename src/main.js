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
    messageEl.style.top = '500px';
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
    overlay.style.background = 'rgba(0,0,0,0.4)';
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

    // Main HUD container - positioned at top center, BIGGER and more game-like
    hudEl = document.createElement('div');
    hudEl.style.position = 'fixed';
    hudEl.style.top = '20px';
    hudEl.style.left = '200px';
    hudEl.style.transform = 'translateX(-50%)';
    hudEl.style.padding = '20px 30px';
    hudEl.style.background = 'linear-gradient(145deg, rgba(0,0,0,0.1), rgba(20,20,30,0.9))';
    hudEl.style.color = '#fff';
    hudEl.style.fontFamily = 'Arial, sans-serif';
    hudEl.style.fontSize = '18px';
    hudEl.style.borderRadius = '16px';
    hudEl.style.zIndex = '9999';
    hudEl.style.display = 'flex';
    hudEl.style.flexDirection = 'column';
    hudEl.style.gap = '16px';
    hudEl.style.border = '3px solid rgba(255, 255, 0, 0.6)';
    hudEl.style.backdropFilter = 'blur(15px)';
    hudEl.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    hudEl.style.minWidth = '50px';
    hudEl.style.height;
    hudEl.style.textAlign = 'center';
  
    const progressContainer = document.createElement('div');
// After creating progressContainer, add this:
//progressContainer.style.opacity = '0.9'; // Set the same opacity as your HUD



    // Progress bar container - BIGGER
    
    progressContainer.style.position = 'relative';
    progressContainer.style.width = '200px';
    progressContainer.style.height = '12px';
    progressContainer.style.background = 'rgba(0, 0, 0, 0.8)';
    progressContainer.style.borderRadius = '6px';
    progressContainer.style.overflow = 'hidden';
    progressContainer.style.border = '2px solid rgba(255, 255, 0, 0.3)';
    progressContainer.style.margin = '0 auto';

    // Progress bar (yellow line that follows time) - THICKER
    const progressBar = document.createElement('div');
    progressBar.id = 'time-progress-bar';
    progressBar.style.position = 'absolute';
    progressBar.style.top = '0';
    progressBar.style.left = '0';
    progressBar.style.height = '100%';
    progressBar.style.background = 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00)';
    progressBar.style.borderRadius = '4px';
    progressBar.style.transition = 'width 0.5s ease';
    progressBar.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
    progressBar.style.animation = 'pulse 2s infinite';
    progressContainer.appendChild(progressBar);
    progressContainer.style.opacity = 1.5; // Set the same opacity as your HUD

    // 
    // progressBar.addEventListener("click", ()=>{
    //     progressBar.style.opacity
    // })

    // Add CSS animation for the progress bar
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
            50% { box-shadow: 0 0 25px rgba(255, 215, 0, 1), inset 0 1px 0 rgba(255, 255, 255, 0.5); }
        }
    `;
    document.head.appendChild(style);

    //
   
    //

    // Main content row - BIGGER spacing
    const mainContentRow = document.createElement('div');
    mainContentRow.style.display = 'flex';
    mainContentRow.style.alignItems = 'left';
    mainContentRow.style.justifyContent = 'center';
    mainContentRow.style.gap = '10px';
    mainContentRow.style.margin = '0px 0';

    // Reports Tracker Container - BIGGER and more game-like
    const reportsContainer = document.createElement('div');
    reportsContainer.style.display = 'flex';
    reportsContainer.style.flexDirection = 'row';
    reportsContainer.style.alignItems = 'center';
    reportsContainer.style.gap = '8px';
    reportsContainer.style.padding = '15px 20px';
    reportsContainer.style.background = 'linear-gradient(145deg, rgba(0, 100, 200, 0.3), rgba(0, 150, 255, 0.2))';
    reportsContainer.style.borderRadius = '12px';
    reportsContainer.style.border = '2px solid rgba(0, 150, 255, 0.6)';
    reportsContainer.style.boxShadow = '0 6px 20px rgba(0, 150, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    reportsContainer.style.width = '180px';
    reportsContainer.style.height = '10px';

    const reportsLabel = document.createElement('div');
    reportsLabel.textContent = 'REPORTS:';
   // reportsLabel.style.left = '2000px'
    reportsLabel.alignItems= "left"
    reportsLabel.style.fontSize = '14px';
    reportsLabel.style.color = '#87CEEB';
    reportsLabel.style.fontWeight = 'bold';
    reportsLabel.style.textShadow = '0 0 10px rgba(135, 206, 235, 0.5)';

    const reportsCounter = document.createElement('div');
    reportsCounter.id = 'reports-counter';
    reportsCounter.style.fontSize = '24px';
    reportsCounter.style.marginLeft = '30px';
    reportsCounter.style.color = '#fff';
    reportsCounter.style.fontWeight = 'bold';
    reportsCounter.style.textShadow = '0 0 15px rgba(255, 255, 255, 0.5)';

    reportsContainer.appendChild(reportsLabel);
    reportsContainer.appendChild(reportsCounter);

    mainContentRow.appendChild(reportsContainer);

    // Controls container - BIGGER buttons
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.gap = '20px';
    controlsRow.style.justifyContent = 'center';
    controlsRow.style.marginTop = '10px';

    // Beautiful Pause Button - BIGGER and more game-like
    pauseBtn = document.createElement('button');
    pauseBtn.textContent = '⏸ PAUSE';
    pauseBtn.style.cursor = 'pointer';
   // pauseBtn.style.padding = '0px 2px';
    pauseBtn.style.border = 'none';
    pauseBtn.style.borderRadius = '12px';
    pauseBtn.style.background = 'linear-gradient(145deg, #ff6b6b, #ee5a52, #d63031)';
    pauseBtn.style.opacity = 0.1;
    pauseBtn.style.color = '#fff';
    pauseBtn.style.fontSize = '11px';
    pauseBtn.style.fontWeight = 'bold';
    pauseBtn.style.transition = 'all 0.3s ease';
    pauseBtn.style.boxShadow = '0 8px 25px rgba(255, 107, 107, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    pauseBtn.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    pauseBtn.style.width = '100px';
    pauseBtn.style.height = '25px';
    pauseBtn.addEventListener('mouseenter', () => {
        pauseBtn.style.transform = 'translateY(-3px) scale(1.05)';
        pauseBtn.style.boxShadow = '0 12px 35px rgba(255, 107, 107, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
        pauseBtn.style.opacity = 1;
    });
    pauseBtn.addEventListener('mouseleave', () => {
        pauseBtn.style.transform = 'translateY(0) scale(1)';
        pauseBtn.style.boxShadow = '0 8px 25px rgba(255, 107, 107, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        pauseBtn.style.opacity = 0.1;
    });
    pauseBtn.addEventListener('click', () => {
        if (!gameStarted || gameEnded) return;
        gamePaused = true;
    });

    // Beautiful Play Button - BIGGER and more game-like
    playBtn = document.createElement('button');
    playBtn.textContent = '▶ PLAY';
    playBtn.style.cursor = 'pointer';
  //  playBtn.style.padding = '15px 25px';
    playBtn.style.border = 'none';
    playBtn.style.borderRadius = '12px';
    playBtn.style.background = 'linear-gradient(145deg, #4ecdc4, #44a08d, #2d8659)';
    playBtn.style.opacity = 0.2
    playBtn.style.color = '#fff';
    playBtn.style.fontSize = '11px';
    playBtn.style.fontWeight = 'bold';
    playBtn.style.transition = 'all 0.3s ease';
    playBtn.style.boxShadow = '0 8px 25px rgba(78, 205, 196, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    playBtn.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    playBtn.style.width = '100px';
    playBtn.style.height = '25px';
    playBtn.addEventListener('mouseenter', () => {
        playBtn.style.transform = 'translateY(-3px) scale(1.05)';
        playBtn.style.boxShadow = '0 12px 35px rgba(78, 205, 196, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
        playBtn.style.opacity = 1;
    });
    playBtn.addEventListener('mouseleave', () => {
        playBtn.style.transform = 'translateY(0) scale(1)';
        playBtn.style.boxShadow = '0 8px 25px rgba(78, 205, 196, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        playBtn.style.opacity = 0.1;
    });
    playBtn.addEventListener('click', () => {
        if (gameEnded) return;
        gameStarted = true;
        gamePaused = false;
    });

    controlsRow.appendChild(playBtn);
    controlsRow.appendChild(pauseBtn);

    // Assemble HUD
    hudEl.appendChild(progressContainer);
    hudEl.appendChild(mainContentRow);
    hudEl.appendChild(controlsRow);
    //
    hudEl.addEventListener("mouseleave", ()=>{
        hudEl.style.opacity = 0.3;
     // mainContentRow.style.opacity = 0.3;
      progressBar.style.opacity = 1;
        // Force the progress container to stay fully opaque
       // progressContainer.style.opacity = '1.0 !important';
    })
    //
    hudEl.addEventListener("mouseenter", ()=>{
        hudEl.style.opacity = 1;
        mainContentRow.style.opacity = 1;
        });
    //


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
   

    // Update reports counter
    const reportsCounter = document.getElementById('reports-counter');
    if (reportsCounter) {
        reportsCounter.textContent = `${reportsCollected}/${totalReports}`;
    }
    
    // Update time display (highlighted in yellow)
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
        timeDisplay.textContent = formatTime(timeMsLeft);
    }
    
    // Update progress bar (yellow line that follows time)
    const progressBar = document.getElementById('time-progress-bar');
    if (progressBar) {
        const progressPercent = (timeMsLeft / timeMsTotal) * 100;
        progressBar.style.width = `${Math.max(0, progressPercent)}%`;
        
        // Change color as time runs out with more dramatic effects
        if (progressPercent < 25) {
            progressBar.style.background = 'linear-gradient(90deg, #ff4444, #cc0000, #990000)';
            progressBar.style.boxShadow = '0 0 25px rgba(255, 68, 68, 1), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
        } else if (progressPercent < 50) {
            progressBar.style.background = 'linear-gradient(90deg, #ffaa00, #ff6600, #cc4400)';
            progressBar.style.boxShadow = '0 0 20px rgba(255, 170, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
        } else {
            progressBar.style.background = 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00)';
            progressBar.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
        }
    }
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
// After creating progressContainer, add this:
//progressContainer.style.opacity = '1.0'; // Keep progress bar fully visible
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

     
     // add a intermediary loading screen so a diff html load screen that loads and when it gets to 100% 
     // olnyu then do we load carcross
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
