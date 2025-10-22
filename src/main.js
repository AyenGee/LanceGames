import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';

// === Scene Setup ===
const scene = new THREE.Scene();
// 
let gameStarted = false;
// === LOADING SCREEN (CSS-driven) ===
let loadingOverlay;
let progressBar;
function createLoadingUI() {
  loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loading-screen';

  // Container to allow absolute-positioned progress over image
  const container = document.createElement('div');
  container.className = 'loading-container';

  const img = document.createElement('img');
  img.className = 'loading-image';
  img.src = '/models/main.png'; // optional splash image
  img.alt = 'Loading';
  container.appendChild(img);

  const progress = document.createElement('div');
  progress.className = 'loading-progress';
  progressBar = document.createElement('div');
  progressBar.className = 'loading-progress__bar';
  progress.appendChild(progressBar);
  container.appendChild(progress);

  loadingOverlay.appendChild(container);

  document.body.appendChild(loadingOverlay);
  
}

createLoadingUI();


// === THREE.js Loading Manager ===
const manager = new THREE.LoadingManager();
let loadStart = null;
const MIN_LOAD_MS = 4000; // minimum time to keep the loader visible
manager.onStart = function () {
  if (progressBar) progressBar.style.width = '0%';
  loadStart = performance.now();
};
manager.onProgress = function (_url, itemsLoaded, itemsTotal) {
  if (!progressBar || !itemsTotal) return;
  const pct = Math.round((itemsLoaded / itemsTotal) * 100);
  progressBar.style.width = `${pct}%`;
};
manager.onLoad = function () {
  if (!loadingOverlay) return;
  const elapsed = loadStart ? (performance.now() - loadStart) : MIN_LOAD_MS;
  const delay = Math.max(0, MIN_LOAD_MS - elapsed);
  setTimeout(() => {
    loadingOverlay.classList.add('is-hidden');
    setTimeout(() => loadingOverlay.remove(), 500);
    setupStartOverlay()
  }, delay);
  
};
let animatee = true;

// Load sky texture as background
const textureLoader = new THREE.TextureLoader(manager);
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
    messageEl.className = 'message-overlay';
    document.body.appendChild(messageEl);
}

function showMessage(text, ms = 2000) {
    if (!messageEl) setupMessageOverlay();
    messageEl.textContent = text;
    messageEl.classList.add('is-visible');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => {
        messageEl.classList.remove('is-visible');
    }, ms);
}

setupMessageOverlay();

// === Start Screen (Instructions) ===


    function setupStartOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';

        const text = document.createElement('div');
        text.className = 'start-text';
        text.textContent = 'Find the report and submit it before time runs out. NOTE, there are multiple challenges in the way. PLAY!';

        const btn = document.createElement('button');
        btn.className = 'start-btn';
        btn.textContent = 'PLAY';

        btn.addEventListener('click', () => {
            gameStarted = true;
            gameEnded = false;
            timeMsLeft = timeMsTotal;
            overlay.remove();
        });

        overlay.appendChild(text);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);
        setupHUD();
    }


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
let timeMsTotal = 20*1000; //
let timeMsLeft = timeMsTotal;
let gameEnded = false;
let gamePaused = false;
function setupHUD() {
    // Main HUD container
    hudEl = document.createElement('div');
    hudEl.className = 'hud';

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';

    // Progress bar (time)
    const progressBar = document.createElement('div');
    progressBar.id = 'time-progress-bar';
    progressBar.className = 'time-progress-bar';
    progressContainer.appendChild(progressBar);

    // Main content row
    const mainContentRow = document.createElement('div');
    mainContentRow.className = 'main-content-row';

    // Reports Tracker
    const reportsContainer = document.createElement('div');
    reportsContainer.className = 'reports-container';

    const reportsLabel = document.createElement('div');
    reportsLabel.className = 'reports-label';
    reportsLabel.textContent = 'REPORTS:';

    const reportsCounter = document.createElement('div');
    reportsCounter.id = 'reports-counter';
    reportsCounter.className = 'reports-counter';

    reportsContainer.appendChild(reportsLabel);
    reportsContainer.appendChild(reportsCounter);
    mainContentRow.appendChild(reportsContainer);

    // Controls container
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';

    // Pause Button
    pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn btn--pause';
    pauseBtn.textContent = '⏸ PAUSE';
    pauseBtn.addEventListener('click', () => {
        if (!gameStarted || gameEnded) return;
        gamePaused = true;
    });

    // Play Button
    playBtn = document.createElement('button');
    playBtn.className = 'btn btn--play';
    playBtn.textContent = '▶ PLAY';
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
    document.body.appendChild(hudEl);
    updateHUD();
}

function formatTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
// create a restart button that restarts the games



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

        // Change color via CSS classes as time runs out
        progressBar.classList.remove('time-progress-bar--ok', 'time-progress-bar--mid', 'time-progress-bar--low');
        if (progressPercent < 25) {
            progressBar.classList.add('time-progress-bar--low');
        } else if (progressPercent < 50) {
            progressBar.classList.add('time-progress-bar--mid');
        } else {
            progressBar.classList.add('time-progress-bar--ok');
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


// After creating progressContainer, add this:
//progressContainer.style.opacity = '1.0'; // Keep progress bar fully visible
spawnPapers();

// === Load Environment ===
const loader = new GLTFLoader(manager);
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
    // Stop game time/loop immediately during transition
    gamePaused = true;
    gameStarted = false;
    gameEnded = true;
    animatee = false;

    loadCarcross(() => {
        // This callback runs after progress reaches 100%
       
    });
}
function loadCarcross() {
    // === Overlay container ===
    const overlay = document.createElement('div');
    overlay.id = 'loadingCC-overlay';
    overlay.className = 'loading-overlay'; // reuse CSS styles

    // === Image ===
    const img = document.createElement('img');
    img.id = 'loadingCC-image';
    img.src = '/models/carcross.png'; // replace with your Carcross image path
    img.alt = 'Carcross Loading';
    overlay.appendChild(img);

    // === Progress bar container ===
    const progressContainer = document.createElement('div');
    progressContainer.id = 'loadingCC-progress-container';
    progressContainer.className = 'loading-progress-container';
    overlay.appendChild(progressContainer);

    // === Progress bar fill ===
    const progressBar = document.createElement('div');
    progressBar.id = 'loadingCC-progress-bar';
    progressBar.className = 'loading-progress-bar';
    progressContainer.appendChild(progressBar);

    document.body.appendChild(overlay);

    // === Simulated progress (editable duration) ===
    let simulatedProgress = 0;
    const loadDuration = 10000; // 3 seconds
    const step = 50; // ms per update

    const interval = setInterval(() => {
        simulatedProgress += (step / loadDuration) * 100;
        if (simulatedProgress >= 100) simulatedProgress = 100;
        progressBar.style.width = `${simulatedProgress}%`;

        if (simulatedProgress >= 100) {
            clearInterval(interval);
            overlay.style.opacity = 0;
            setTimeout(() => overlay.remove(), 500);
            // Call the next step after loading completes
             window.location.href = "http://localhost:5173/carcross.html";
        }
    }, step);
}

// === Animate Loop ===
function animate() {
    if (!animatee) return;
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
            showTimesUp()
            //showMessage('Time is up!');
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

// ===== function times up overlay ==
function showTimesUp(){
    const overlay = document.createElement('div');
    overlay.className = 'timesup-overlay';
    const msg = document.createElement('h1');
    msg.textContent = 'Times Up!';
    overlay.appendChild(msg);
    restart(overlay);
    document.body.append(overlay);
   

}

function restart(attachment){
    const btn = document.createElement('button');
    btn.className = 'restart-btn';
    btn.textContent = 'Restart';
    btn.onclick = () => location.reload();
    attachment.appendChild(btn);
}
