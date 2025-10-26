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

// (Add this function)
/**
 * Injects CSS for the fullscreen video intro overlay.
 */
function injectVideoIntroStyles() {
    if (document.getElementById('video-intro-styles')) return;
    const css = `
        #video-intro-overlay {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            z-index: 10000; /* On top of everything */
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 1;
            transition: opacity 400ms ease-out;
        }
        #video-intro-overlay video {
            width: 100%;
            height: 100%;
            object-fit: cover; /* Fill the screen */
        }
        #video-intro-overlay .skip-btn {
            position: absolute;
            bottom: 30px;
            right: 30px;
            z-index: 10001;
            padding: 10px 18px;
            font-size: 16px;
            background: rgba(255, 255, 255, 0.15);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 8px;
            cursor: pointer;
            backdrop-filter: blur(3px);
            opacity: 0.7;
            transition: all 200ms ease;
        }
        #video-intro-overlay .skip-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            opacity: 1;
        }
    `;
    const style = document.createElement('style');
    style.id = 'video-intro-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

// (Add this function)
/**
 * Creates and plays a fullscreen intro video.
 * @param {string} videoSrc - The path to the video file.
 * e.g., '/videos/my-intro.mp4'
 * @param {function} onComplete - Callback function to run when
 * video ends or is skipped.
 */
function playIntroVideo(videoSrc, onComplete) {
    injectVideoIntroStyles(); // Make sure styles are loaded

    const overlay = document.createElement('div');
    overlay.id = 'video-intro-overlay';

    const video = document.createElement('video');
    video.src = videoSrc;
    video.muted = true;   // REQUIRED for autoplay in all modern browsers
    video.autoplay = true;
    video.playsInline = true; // Good for mobile
    overlay.appendChild(video);

    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip Intro';
    skipBtn.className = 'skip-btn';
    overlay.appendChild(skipBtn);

    let isCleanedUp = false;
    function cleanup() {
        if (isCleanedUp) return;
        isCleanedUp = true;
        
        video.pause();
        overlay.style.opacity = '0'; // Fade out
        
        // Wait for fade-out, then remove and call next step
        overlay.addEventListener('transitionend', () => {
            overlay.remove();
            if (onComplete) onComplete();
        }, { once: true });
        
        // Fallback if transition event doesn't fire
        setTimeout(() => {
            if (overlay.isConnected) overlay.remove();
            if (onComplete) onComplete();
        }, 500); // 500ms > 400ms transition
    }

    // --- Event Listeners ---
    skipBtn.addEventListener('click', cleanup, { once: true });
    video.addEventListener('ended', cleanup, { once: true });
    
    // Handle cases where video fails to load
    video.addEventListener('error', (e) => {
        console.error("Intro video failed to load or play:", e);
        cleanup(); // Skip it and move on
    }, { once: true });

    // --- Add to DOM and Play ---
    document.body.appendChild(overlay);
    
    const playPromise = video.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            // Autoplay was prevented (e.g., browser policy)
            console.warn("Video autoplay was prevented. Skipping intro.", error);
            // Don't show a broken player; just skip to the start screen.
            overlay.remove(); // Remove immediately
            if (onComplete) onComplete();
        });
    }
}

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

/**
 * Creates the start screen DOM (same structure as your HTML).
 * - Ensures #app exists.
 * - Replaces any existing #start-screen.
 * - Returns refs and tiny helpers.
 */
// Inject start-screen styles once (runtime)
function injectStartScreenStyles() {
  if (document.getElementById('start-screen-styles')) return;

  const css = `
  html, body, #app { height: 100%; }
  html, body { margin: 0; }

  #start-screen.overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10,10,13,0.8);
    backdrop-filter: blur(2px);
    opacity: 1;
    transition: opacity 300ms ease;
  }
  #start-screen.overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  #start-screen .panel {
    width: min(92vw, 560px);
    padding: 28px 32px;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.45);
    background: linear-gradient(180deg, #1b1f2a, #0f1218);
    color: #fff;
    text-align: center;
  }

  #start-screen .title {
    margin: 0 0 8px;
    font-size: clamp(28px, 4vw, 40px);
    letter-spacing: 0.5px;
  }
  #start-screen .subtitle {
    margin: 0 0 24px;
    opacity: 0.9;
  }

  #start-screen .btn {
    display: inline-block;
    margin: 6px 0 14px;
    padding: 12px 22px;
    font-size: 16px;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    background: #ffd400;
    color: #111;
  }

  #start-screen .row {
    display: flex;
    gap: 16px;
    justify-content: center;
    align-items: center;
  }

  #start-screen .link {
    background: none;
    border: none;
    color: #9cc8ff;
    cursor: pointer;
    text-decoration: underline;
  }
  `;

  const style = document.createElement('style');
  style.id = 'start-screen-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Creates the start screen DOM and injects CSS at runtime.
 */
export function createStartScreen() {
  injectStartScreenStyles(); // <-- ensure styles exist

  // Ensure #app exists
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }

  // Remove any existing start screen
  const existing = document.getElementById('start-screen');
  if (existing) existing.remove();

  // Build DOM
  const startScreen = document.createElement('div');
  startScreen.id = 'start-screen';
  startScreen.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h1 = document.createElement('h1');
  h1.className = 'Lance: Trapped in Wits';
  h1.textContent = 'Lance: Trapped in Wits';

  const p = document.createElement('p');
  p.className = 'subtitle';
  p.textContent = 'Press Play to begin';

  const playBtn = document.createElement('button');
  playBtn.id = 'play-btn';
  playBtn.className = 'btn';
  playBtn.textContent = 'Play';

  const row = document.createElement('div');
  row.className = 'row';

  const label = document.createElement('label');
  const mute = document.createElement('input');
  mute.id = 'mute';
  mute.type = 'checkbox';
  mute.checked = true;
  label.appendChild(mute);
  label.appendChild(document.createTextNode(' Mute'));

  const settings = document.createElement('button');
  settings.id = 'settings';
  settings.className = 'link';
  settings.textContent = 'Settings';

  row.appendChild(label);
  row.appendChild(settings);

  panel.appendChild(h1);
  panel.appendChild(p);
  panel.appendChild(playBtn);
  panel.appendChild(row);
  startScreen.appendChild(panel);
  app.appendChild(startScreen);
  document.body.appendChild(startScreen);

  // Helpers: show/hide + keyboard
  const show = () => {
    startScreen.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // lock scroll while visible
  };
  const hide = () => {
    startScreen.classList.add('hidden');
    document.body.style.overflow = ''; // restore scroll
  };

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playBtn.click();
    }
  };
  startScreen.addEventListener('transitionend', () => {
    if (!startScreen.isConnected) document.removeEventListener('keydown', onKey);
  });

  return {
    root: startScreen,
    panel,
    playBtn,
    mute,
    settings,
    show,
    hide,
    enableKeyboardStart() { document.addEventListener('keydown', onKey); },
    disableKeyboardStart() { document.removeEventListener('keydown', onKey); },
  };
}


function showStartScreenAfterLoad() {
  const { root, playBtn, show, hide, enableKeyboardStart, disableKeyboardStart } = createStartScreen();

  // Reveal the start screen and allow Enter/Space to trigger Play
  show();
  enableKeyboardStart();

  const begin = () => {
    disableKeyboardStart();
    hide();          // for CSS transition if you use it
    root.remove();   // remove the start screen DOM
    setupStartOverlay(); // <-- NOW show your “PLAY to begin challenge” overlay
  };

  // One-time start
  playBtn.addEventListener('click', begin, { once: true });
}


//createStartScreen();

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
    // Fade out/remove the loader
    loadingOverlay.classList.add('is-hidden');
    setTimeout(() => loadingOverlay.remove(), 500);

    // 👉 Show Start Screen first; only after clicking Play do we call setupStartOverlay()
    playIntroVideo('./assets/intro.mp4',showStartScreenAfterLoad);
    //showStartScreenAfterLoad();
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
export function setupHUD() {
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

    const ctrlBtn = document.createElement('button');
    ctrlBtn.className = 'ctrl-btn';
    ctrlBtn.textContent = 'CONTROLS';
    ctrlBtn.textContent = '⌨ CONTROLS';

    const controlsPanel = document.createElement('div');
    controlsPanel.id = 'controls-panel';
    controlsPanel.className = 'controls-panel is-hidden';
    controlsPanel.setAttribute('role', 'dialog');
    controlsPanel.setAttribute('aria-modal', 'false');
    controlsPanel.innerHTML = `
        <div class="controls-panel__header">
            <strong>Game Controls</strong>
            <button class="controls-panel__close" aria-label="Close controls">✕</button>
        </div>
        <ul class="controls-panel__list">
            <li><kbd>W/A/S/D</kbd> or <kbd>Arrow Keys</kbd> — Move</li>
            <li><kbd>Space</kbd> — Action / Interact</li>
            <li><kbd>Shift</kbd> — Sprint</li>
            <li><kbd>P</kbd> — Pause</li>
            <li><kbd>M</kbd> — Mute/Unmute</li>
            <li><kbd>?</kbd> — Toggle Controls</li>
        </ul>
    `;

    const closeBtn = controlsPanel.querySelector('.controls-panel__close');
   /* const toggleControls = (forceState) => {
        const isHidden = controlsPanel.classList.contains('is-hidden');
        const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;
        controlsPanel.classList.toggle('is-hidden', !shouldOpen);
        ctrlBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    };*/

    ctrlBtn.addEventListener('click', () =>{
        controlsPanel.hidden = false;
    } )

    closeBtn.addEventListener('click', () => {
        if(controlsPanel.hidden === false){
            controlsPanel.hidden = true;
        }else{
            controlsPanel.hidden = false;
        }

    });
    //closeBtn.addEventListener('click', () => toggleControls(false));
    document.addEventListener('keydown', (e) => {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleControls();
        if (e.key === 'Escape') toggleControls(false);
    });

    controlsRow.appendChild(playBtn);
    controlsRow.appendChild(pauseBtn);
    controlsRow.appendChild(ctrlBtn);

    

    // Assemble HUD
    hudEl.appendChild(progressContainer);
    hudEl.appendChild(mainContentRow);
    hudEl.appendChild(controlsRow);
    hudEl.appendChild(controlsPanel);
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



export function updateHUD() {
   

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
