/*

Learn how to code this watch step by step on YouTube:

https://youtu.be/vNr3_hQ3Bws

or on:

https://javascriptgametutorials.com/

*/

import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const minTileIndex = -8;
const maxTileIndex = 8;
const tilesPerRow = maxTileIndex - minTileIndex + 1;
const tileSize = 42;

function Camera() {
  const size = 200; // smaller than 300 → zooms in closer
  const viewRatio = window.innerWidth / window.innerHeight;
  const width = viewRatio < 1 ? size : size * viewRatio;
  const height = viewRatio < 1 ? size / viewRatio : size;

  const camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    50,  // reduce near/far plane a bit since we’re closer
    600
  );

  camera.up.set(0, 0, 1);

  // closer to player → smaller distance
  camera.position.set(180, -180, 220);
  camera.lookAt(0, 0, 0);

  return camera;
}


function Texture(width, height, rects) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(0,0,0,0.6)";
  rects.forEach((rect) => {
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
  });
  return new THREE.CanvasTexture(canvas);
}

// Car textures
const carFrontTexture = new Texture(40, 80, [{ x: 0, y: 10, w: 30, h: 60 }]);
const carBackTexture = new Texture(40, 80, [{ x: 10, y: 10, w: 30, h: 60 }]);
const carRightSideTexture = new Texture(110, 40, [
  { x: 10, y: 0, w: 50, h: 30 },
  { x: 70, y: 0, w: 30, h: 30 },
]);
const carLeftSideTexture = new Texture(110, 40, [
  { x: 10, y: 10, w: 50, h: 30 },
  { x: 70, y: 10, w: 30, h: 30 },
]);

export const truckFrontTexture = Texture(30, 30, [{ x: 5, y: 0, w: 10, h: 30 }]);
export const truckRightSideTexture = Texture(25, 30, [{ x: 15, y: 5, w: 10, h: 10 }]);
export const truckLeftSideTexture = Texture(25, 30, [{ x: 15, y: 15, w: 10, h: 10 }]);

// ------------------- Vehicles -------------------
function Car(initialTileIndex, direction, color) {
  const car = new THREE.Group();
  car.position.x = initialTileIndex * tileSize;
  if (!direction) car.rotation.z = Math.PI;

  const main = new THREE.Mesh(
    new THREE.BoxGeometry(60, 30, 15),
    new THREE.MeshLambertMaterial({ color, flatShading: true })
  );
  main.position.z = 12;
  main.castShadow = true;
  main.receiveShadow = true;
  car.add(main);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(33, 24, 12), [
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carBackTexture }),
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carFrontTexture }),
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carRightSideTexture }),
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true, map: carLeftSideTexture }),
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }),
  ]);
  cabin.position.x = -6;
  cabin.position.z = 25.5;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  car.add(cabin);

  const frontWheel = Wheel(18);
  car.add(frontWheel);
  const backWheel = Wheel(-18);
  car.add(backWheel);

  return car;
}

function Truck(initialTileIndex, direction, color) {
  const truck = new THREE.Group();
  truck.position.x = initialTileIndex * tileSize;
  if (!direction) truck.rotation.z = Math.PI;

  const cargo = new THREE.Mesh(
    new THREE.BoxGeometry(70, 35, 35),
    new THREE.MeshLambertMaterial({ color: 0xb4c6fc, flatShading: true })
  );
  cargo.position.x = -15;
  cargo.position.z = 25;
  cargo.castShadow = true;
  cargo.receiveShadow = true;
  truck.add(cargo);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), [
    new THREE.MeshLambertMaterial({ color, flatShading: true, map: truckFrontTexture }),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
    new THREE.MeshLambertMaterial({ color, flatShading: true, map: truckLeftSideTexture }),
    new THREE.MeshLambertMaterial({ color, flatShading: true, map: truckRightSideTexture }),
    new THREE.MeshPhongMaterial({ color, flatShading: true }),
    new THREE.MeshPhongMaterial({ color, flatShading: true }),
  ]);
  cabin.position.x = 35;
  cabin.position.z = 20;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  truck.add(cabin);

  const frontWheel = Wheel(37);
  truck.add(frontWheel);
  const middleWheel = Wheel(5);
  truck.add(middleWheel);
  const backWheel = Wheel(-35);
  truck.add(backWheel);

  return truck;
}

function Wheel(x) {
  const wheel = new THREE.Mesh(
    new THREE.BoxGeometry(12, 33, 12),
    new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true })
  );
  wheel.position.x = x;
  wheel.position.z = 6;
  return wheel;
}

// ------------------- Environment -------------------
function DirectionalLight() {
  const dirLight = new THREE.DirectionalLight();
  dirLight.position.set(-100, -100, 200);
  dirLight.up.set(0, 0, 1);
  dirLight.castShadow = true;

  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.up.set(0, 0, 1);
  dirLight.shadow.camera.left = -400;
  dirLight.shadow.camera.right = 400;
  dirLight.shadow.camera.top = 400;
  dirLight.shadow.camera.bottom = -400;
  dirLight.shadow.camera.near = 50;
  dirLight.shadow.camera.far = 400;

  return dirLight;
}

function Grass(rowIndex) {
  const grass = new THREE.Group();
  grass.position.y = rowIndex * tileSize;
  const createSection = (color) =>
    new THREE.Mesh(
      new THREE.BoxGeometry(tilesPerRow * tileSize, tileSize, 3),
      new THREE.MeshLambertMaterial({ color })
    );
  const middle = createSection(0xbaf455);
  middle.receiveShadow = true;
  grass.add(middle);

  const left = createSection(0x99c846);
  left.position.x = -tilesPerRow * tileSize;
  grass.add(left);
  const right = createSection(0x99c846);
  right.position.x = tilesPerRow * tileSize;
  grass.add(right);

  return grass;
}

function Road(rowIndex) {
  const road = new THREE.Group();
  road.position.y = rowIndex * tileSize;

  const createSection = (color) =>
    new THREE.Mesh(
      new THREE.PlaneGeometry(tilesPerRow * tileSize, tileSize),
      new THREE.MeshLambertMaterial({ color })
    );

  const middle = createSection(0x454a59);
  middle.receiveShadow = true;
  road.add(middle);

  const left = createSection(0x393d49);
  left.position.x = -tilesPerRow * tileSize;
  road.add(left);
  const right = createSection(0x393d49);
  right.position.x = tilesPerRow * tileSize;
  road.add(right);

  return road;
}

function Tree(tileIndex, height) {
  const tree = new THREE.Group();
  tree.position.x = tileIndex * tileSize;

  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(15, 15, 20),
    new THREE.MeshLambertMaterial({ color: 0x4d2926, flatShading: true })
  );
  trunk.position.z = 10;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, height),
    new THREE.MeshLambertMaterial({ color: 0x7aa21d, flatShading: true })
  );
  crown.position.z = height / 2 + 20;
  crown.castShadow = true;
  crown.receiveShadow = true;
  tree.add(crown);

  return tree;
}

// ------------------- Player -------------------
const loader = new GLTFLoader();
let player = new THREE.Group();
let playerModel = null;

function Player() {
  const playerContainer = new THREE.Group();

  loader.load(
    "models/soldier.glb",
    (gltf) => {
      const playerModel = gltf.scene;

      // Rotate soldier upright and facing forward
      playerModel.rotation.x = Math.PI/2; // rotate if lying down
      playerModel.rotation.z = -Math.PI/30;      // adjust facing direction

      // Scale and position
      playerModel.scale.set(10 , 10, 10);
      playerModel.position.z = 0;

      playerContainer.add(playerModel);
    },
    undefined,
    (error) => {
      console.error("Error loading soldier model:", error);

      // Fallback box if model fails to load
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(15, 15, 20),
        new THREE.MeshLambertMaterial({ color: "white", flatShading: true })
      );
      body.position.z = 10;
      playerContainer.add(body);
    }
  );

  return playerContainer;
}

// ------------------- Game Logic -------------------
const metadata = [];
const map = new THREE.Group();
const position = { currentRow: 0, currentTile: 0 };
const movesQueue = [];

function initializeMap() {
  metadata.length = 0;
  map.remove(...map.children);
  for (let rowIndex = 0; rowIndex > -10; rowIndex--) {
    const grass = Grass(rowIndex);
    map.add(grass);
  }
  addRows();
}

function addRows() {
  const newMetadata = generateRows(20);
  const startIndex = metadata.length;
  metadata.push(...newMetadata);

  newMetadata.forEach((rowData, index) => {
    const rowIndex = startIndex + index + 1;

    if (rowData.type === "forest") {
      const row = Grass(rowIndex);
      rowData.trees.forEach(({ tileIndex, height }) => {
        const three = Tree(tileIndex, height);
        row.add(three);
      });
      map.add(row);
    }

    if (rowData.type === "car") {
      const row = Road(rowIndex);
      rowData.vehicles.forEach((vehicle) => {
        const car = Car(vehicle.initialTileIndex, rowData.direction, vehicle.color);
        vehicle.ref = car;
        row.add(car);
      });
      map.add(row);
    }

    if (rowData.type === "truck") {
      const row = Road(rowIndex);
      rowData.vehicles.forEach((vehicle) => {
        const truck = Truck(vehicle.initialTileIndex, rowData.direction, vehicle.color);
        vehicle.ref = truck;
        row.add(truck);
      });
      map.add(row);
    }
  });
}

// ------------------- Animation & Movement -------------------
const moveClock = new THREE.Clock(false);
const clock = new THREE.Clock();

function animatePlayer() {
  if (!movesQueue.length) return;
  if (!moveClock.running) moveClock.start();

  const stepTime = 0.2;
  const progress = Math.min(1, moveClock.getElapsedTime() / stepTime);

  setPosition(progress);
  setRotation(progress);

  if (progress >= 1) {
    stepCompleted();
    moveClock.stop();
  }
}

function setPosition(progress) {
  const startX = position.currentTile * tileSize;
  const startY = position.currentRow * tileSize;
  let endX = startX;
  let endY = startY;

  if (movesQueue[0] === "left") endX -= tileSize;
  if (movesQueue[0] === "right") endX += tileSize;
  if (movesQueue[0] === "forward") endY += tileSize;
  if (movesQueue[0] === "backward") endY -= tileSize;

  player.position.x = THREE.MathUtils.lerp(startX, endX, progress);
  player.position.y = THREE.MathUtils.lerp(startY, endY, progress);

  if (playerModel) playerModel.position.z = Math.sin(progress * Math.PI) * 8;
}

function setRotation(progress) {
  let endRotation = 0;
  if (movesQueue[0] === "forward") endRotation = 0;
  if (movesQueue[0] === "left") endRotation = Math.PI / 2;
  if (movesQueue[0] === "right") endRotation = -Math.PI / 2;
  if (movesQueue[0] === "backward") endRotation = Math.PI;

  if (playerModel) playerModel.rotation.z = THREE.MathUtils.lerp(
    playerModel.rotation.z,
    endRotation,
    progress
  );
}

function animateVehicles() {
  const delta = clock.getDelta();
  metadata.forEach((rowData) => {
    if (rowData.type === "car" || rowData.type === "truck") {
      const beginningOfRow = (minTileIndex - 2) * tileSize;
      const endOfRow = (maxTileIndex + 2) * tileSize;
      rowData.vehicles.forEach(({ ref }) => {
        if (!ref) throw Error("Vehicle reference missing");
        if (rowData.direction) {
          ref.position.x = ref.position.x > endOfRow ? beginningOfRow : ref.position.x + rowData.speed * delta;
        } else {
          ref.position.x = ref.position.x < beginningOfRow ? endOfRow : ref.position.x - rowData.speed * delta;
        }
      });
    }
  });
}

// ------------------- Game Initialization -------------------
const scene = new THREE.Scene();
player = Player();
scene.add(player);
scene.add(map);

const ambientLight = new THREE.AmbientLight();
scene.add(ambientLight);

const dirLight = DirectionalLight();
dirLight.target = player;
player.add(dirLight);

const camera = Camera();
player.add(camera);

const scoreDOM = document.getElementById("score");
const resultDOM = document.getElementById("result-container");
const finalScoreDOM = document.getElementById("final-score");

initializeGame();

document.querySelector("#retry")?.addEventListener("click", initializeGame);

function initializeGame() {
  position.currentRow = 0;
  position.currentTile = 0;
  movesQueue.length = 0;

  initializeMap();

  if (scoreDOM) scoreDOM.innerText = "0";
  if (resultDOM) resultDOM.style.visibility = "hidden";
}

// ------------------- Rendering -------------------
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("canvas.game"), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

renderer.setAnimationLoop(() => {
  animateVehicles();
  animatePlayer();
  renderer.render(scene, camera);
});

// ------------------- Input -------------------
document.getElementById("forward")?.addEventListener("click", () => queueMove("forward"));
document.getElementById("backward")?.addEventListener("click", () => queueMove("backward"));
document.getElementById("left")?.addEventListener("click", () => queueMove("left"));
document.getElementById("right")?.addEventListener("click", () => queueMove("right"));

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "w") queueMove("forward");
  if (key === "s") queueMove("backward");
  if (key === "a") queueMove("left");
  if (key === "d") queueMove("right");
});

// ------------------- Collision -------------------
function hitTest() {
  const row = metadata[position.currentRow - 1];
  if (!row) return;

  if (row.type === "car" || row.type === "truck") {
    const playerBoundingBox = new THREE.Box3().setFromObject(player);
    row.vehicles.forEach(({ ref }) => {
      const vehicleBoundingBox = new THREE.Box3().setFromObject(ref);
      if (playerBoundingBox.intersectsBox(vehicleBoundingBox)) {
        if (!resultDOM || !finalScoreDOM) return;
        resultDOM.style.visibility = "visible";
        finalScoreDOM.innerText = position.currentRow.toString();
      }
    });
  }
}

// ------------------- Movement Logic -------------------
function queueMove(direction) {
  const isValidMove = endsUpInValidPosition({ rowIndex: position.currentRow, tileIndex: position.currentTile }, [...movesQueue, direction]);
  if (!isValidMove) return;
  movesQueue.push(direction);
}

function stepCompleted() {
  const direction = movesQueue.shift();
  if (direction === "forward") position.currentRow += 1;
  if (direction === "backward") position.currentRow -= 1;
  if (direction === "left") position.currentTile -= 1;
  if (direction === "right") position.currentTile += 1;

  if (position.currentRow > metadata.length - 10) addRows();
  if (scoreDOM) scoreDOM.innerText = position.currentRow.toString();
}

function calculateFinalPosition(currentPosition, moves) {
  return moves.reduce((pos, dir) => {
    if (dir === "forward") return { rowIndex: pos.rowIndex + 1, tileIndex: pos.tileIndex };
    if (dir === "backward") return { rowIndex: pos.rowIndex - 1, tileIndex: pos.tileIndex };
    if (dir === "left") return { rowIndex: pos.rowIndex, tileIndex: pos.tileIndex - 1 };
    if (dir === "right") return { rowIndex: pos.rowIndex, tileIndex: pos.tileIndex + 1 };
    return pos;
  }, currentPosition);
}

function endsUpInValidPosition(currentPosition, moves) {
  const finalPosition = calculateFinalPosition(currentPosition, moves);
  if (finalPosition.rowIndex === -1 || finalPosition.tileIndex < minTileIndex || finalPosition.tileIndex > maxTileIndex) return false;
  const finalRow = metadata[finalPosition.rowIndex - 1];
  if (finalRow && finalRow.type === "forest" && finalRow.trees.some(t => t.tileIndex === finalPosition.tileIndex)) return false;
  return true;
}

// ------------------- Random Rows -------------------
function generateRows(amount) {
  return Array.from({ length: amount }, () => generateRow());
}

function generateRow() {
  const type = randomElement(["car", "truck", "forest"]);
  if (type === "car") return generateCarLaneMetadata();
  if (type === "truck") return generateTruckLaneMetadata();
  return generateForesMetadata();
}

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateForesMetadata() {
  const occupiedTiles = new Set();
  const trees = Array.from({ length: 4 }, () => {
    let tileIndex;
    do { tileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex); } while (occupiedTiles.has(tileIndex));
    occupiedTiles.add(tileIndex);
    const height = randomElement([20, 45, 60]);
    return { tileIndex, height };
  });
  return { type: "forest", trees };
}

function generateCarLaneMetadata() {
  const direction = randomElement([true, false]);
  const speed = randomElement([125, 156, 188]);
  const occupiedTiles = new Set();
  const vehicles = Array.from({ length: 3 }, () => {
    let initialTileIndex;
    do { initialTileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex); } while (occupiedTiles.has(initialTileIndex));
    occupiedTiles.add(initialTileIndex - 1);
    occupiedTiles.add(initialTileIndex);
    occupiedTiles.add(initialTileIndex + 1);
    const color = randomElement([0xa52523, 0xbdb638, 0x78b14b]);
    return { initialTileIndex, color };
  });
  return { type: "car", direction, speed, vehicles };
}

function generateTruckLaneMetadata() {
  const direction = randomElement([true, false]);
  const speed = randomElement([125, 156, 188]);
  const occupiedTiles = new Set();
  const vehicles = Array.from({ length: 2 }, () => {
    let initialTileIndex;
    do { initialTileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex); } while (occupiedTiles.has(initialTileIndex));
    [initialTileIndex - 2, initialTileIndex - 1, initialTileIndex, initialTileIndex + 1, initialTileIndex + 2].forEach(t => occupiedTiles.add(t));
    const color = randomElement([0xa52523, 0xbdb638, 0x78b14b]);
    return { initialTileIndex, color };
  });
  return { type: "truck", direction, speed, vehicles };
}
