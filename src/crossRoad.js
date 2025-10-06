/*
Crossy Road + CharacterControls integration
-------------------------------------------
Soldier.glb is controlled using WASD keys via CharacterControls.
The world (cars, trees, etc.) remains from your Crossy Road environment.
*/

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from "./characterControls.js";

// --------------------------------------------------
// Scene setup
// --------------------------------------------------
const scene = new THREE.Scene();

// Camera setup
function Camera() {
  const size = 300;
  const viewRatio = window.innerWidth / window.innerHeight;
  const width = viewRatio < 1 ? size : size * viewRatio;
  const height = viewRatio < 1 ? size / viewRatio : size;

  const camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    100,
    900
  );

  camera.up.set(0, 0, 1);
  camera.position.set(300, -300, 300);
  camera.lookAt(0, 0, 0);

  return camera;
}
const camera = Camera();
scene.add(camera);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas.game'),
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // we'll drive camera manually for a steady follow

// --------------------------------------------------
// Lighting
// --------------------------------------------------
function DirectionalLight() {
  const dirLight = new THREE.DirectionalLight();
  dirLight.position.set(-100, -100, 200);
  dirLight.up.set(0, 0, 1);
  dirLight.castShadow = true;

  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -400;
  dirLight.shadow.camera.right = 400;
  dirLight.shadow.camera.top = 400;
  dirLight.shadow.camera.bottom = -400;
  dirLight.shadow.camera.near = 50;
  dirLight.shadow.camera.far = 400;

  return dirLight;
}
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = DirectionalLight();
scene.add(dirLight);

// --------------------------------------------------
// Environment (Grass, Roads, Cars, etc.)
// --------------------------------------------------
const minTileIndex = -8;
const maxTileIndex = 8;
const tilesPerRow = maxTileIndex - minTileIndex + 1;
const tileSize = 42;

function Texture(width, height, rects) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(0,0,0,0.6)";
  rects.forEach((r) => context.fillRect(r.x, r.y, r.w, r.h));
  return new THREE.CanvasTexture(canvas);
}

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

function Wheel(x) {
  const wheel = new THREE.Mesh(
    new THREE.BoxGeometry(12, 33, 12),
    new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true })
  );
  wheel.position.x = x;
  wheel.position.z = 6;
  return wheel;
}

function Car(initialTileIndex, direction, color) {
  const car = new THREE.Group();
  car.position.x = initialTileIndex * tileSize;
  if (!direction) car.rotation.z = Math.PI;

  const main = new THREE.Mesh(
    new THREE.BoxGeometry(60, 30, 15),
    new THREE.MeshLambertMaterial({ color, flatShading: true })
  );
  main.position.z = 12;
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
  car.add(cabin);

  car.add(Wheel(18));
  car.add(Wheel(-18));

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
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
    new THREE.MeshPhongMaterial({ color, flatShading: true }),
    new THREE.MeshPhongMaterial({ color, flatShading: true }),
  ]);
  cabin.position.x = 35;
  cabin.position.z = 20;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  truck.add(cabin);

  truck.add(Wheel(37));
  truck.add(Wheel(5));
  truck.add(Wheel(-35));

  return truck;
}

function Grass(rowIndex) {
  const grass = new THREE.Group();
  grass.position.y = rowIndex * tileSize;

  const section = (color) =>
    new THREE.Mesh(
      new THREE.BoxGeometry(tilesPerRow * tileSize, tileSize, 3),
      new THREE.MeshLambertMaterial({ color })
    );

  const middle = section(0xbaf455);
  middle.receiveShadow = true;
  grass.add(middle);

  const left = section(0x99c846);
  left.position.x = -tilesPerRow * tileSize;
  grass.add(left);

  const right = section(0x99c846);
  right.position.x = tilesPerRow * tileSize;
  grass.add(right);

  return grass;
}

function Road(rowIndex) {
  const road = new THREE.Group();
  road.position.y = rowIndex * tileSize;

  const section = (color) =>
    new THREE.Mesh(
      new THREE.PlaneGeometry(tilesPerRow * tileSize, tileSize),
      new THREE.MeshLambertMaterial({ color })
    );

  const middle = section(0x454a59);
  middle.receiveShadow = true;
  road.add(middle);

  const left = section(0x393d49);
  left.position.x = -tilesPerRow * tileSize;
  road.add(left);

  const right = section(0x393d49);
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

// Map and metadata (fixed layout)
const metadata = [];
const map = new THREE.Group();
scene.add(map);

// Define a fixed set of rows for a deterministic level
const FIXED_ROWS = [
  // Row 1..N (positive Y). Exactly 3 'car' rows; no trucks.
  { type: 'forest', trees: [ { tileIndex: -5, height: 45 }, { tileIndex: 0, height: 60 }, { tileIndex: 4, height: 20 } ] },
  { type: 'car', direction: true, speed: 140, vehicles: [ { initialTileIndex: -7, color: 0xa52523 }, { initialTileIndex: -1, color: 0x78b14b }, { initialTileIndex: 6, color: 0xbdb638 } ] },
  { type: 'forest', trees: [ { tileIndex: -6, height: 20 }, { tileIndex: 2, height: 60 }, { tileIndex: 7, height: 45 } ] },
  { type: 'forest', trees: [ { tileIndex: -3, height: 45 }, { tileIndex: 1, height: 20 }, { tileIndex: 5, height: 60 } ] },
  { type: 'car', direction: false, speed: 188, vehicles: [ { initialTileIndex: -8, color: 0xbdb638 }, { initialTileIndex: -2, color: 0x78b14b }, { initialTileIndex: 5, color: 0xa52523 } ] },
  { type: 'forest', trees: [ { tileIndex: -7, height: 20 }, { tileIndex: -1, height: 45 }, { tileIndex: 6, height: 60 } ] },
  { type: 'forest', trees: [ { tileIndex: -4, height: 60 }, { tileIndex: 0, height: 20 }, { tileIndex: 4, height: 45 } ] },
  { type: 'car', direction: true, speed: 156, vehicles: [ { initialTileIndex: -5, color: 0xa52523 }, { initialTileIndex: 0, color: 0xbdb638 }, { initialTileIndex: 7, color: 0x78b14b } ] },
  { type: 'forest', trees: [ { tileIndex: -8, height: 45 }, { tileIndex: -2, height: 20 }, { tileIndex: 3, height: 60 } ] },
  { type: 'forest', trees: [ { tileIndex: -6, height: 20 }, { tileIndex: -1, height: 60 }, { tileIndex: 6, height: 45 } ] },
  { type: 'forest', trees: [ { tileIndex: -5, height: 45 }, { tileIndex: 2, height: 20 }, { tileIndex: 5, height: 60 } ] },
];
const END_ROW_COUNT = FIXED_ROWS.length;
const END_Y = END_ROW_COUNT * tileSize;

function buildFixedRows() {
  const startIndex = metadata.length;
  metadata.push(...FIXED_ROWS);

  FIXED_ROWS.forEach((rowData, index) => {
    const rowIndex = startIndex + index + 1;

    if (rowData.type === 'forest') {
      const row = Grass(rowIndex);
      rowData.trees.forEach(({ tileIndex, height }) => {
        row.add(Tree(tileIndex, height));
      });
      map.add(row);
    }

    if (rowData.type === 'car') {
      const row = Road(rowIndex);
      rowData.vehicles.forEach((vehicle) => {
        const car = Car(vehicle.initialTileIndex, rowData.direction, vehicle.color);
        vehicle.ref = car;
        row.add(car);
      });
      map.add(row);
    }

    if (rowData.type === 'truck') {
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

// Initialize base grass rows and then dynamic rows
// Add base grass below the starting row
for (let rowIndex = 0; rowIndex > -10; rowIndex--) {
  map.add(Grass(rowIndex));
}
// Add forward rows with content (fixed level)
buildFixedRows();


// --------------------------------------------------
// Character setup (with CharacterControls)
// --------------------------------------------------
let characterControls;
const keysPressed = {};
const loader = new GLTFLoader();

loader.load(
  "/models/Soldier.glb",
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(10, 10, 10);
    model.position.set(0, 0, 10);
    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const animationsMap = new Map();
    gltf.animations.forEach((clip) => {
      animationsMap.set(clip.name, mixer.clipAction(clip));
    });

    // Soldier/glTF is typically Y-up; but this Crossy scene uses Z-up math. Rotate model and use Z-up controls.
    model.rotation.x = Math.PI / 2; // make front face upright relative to Z-up world
    // If forward is reversed, add Math.PI (180deg) forward offset.
    characterControls = new CharacterControls(model, mixer, animationsMap, controls, camera, 'Idle', 'Z', Math.PI);
  },
  undefined,
  (error) => console.error("Error loading soldier model:", error)
);

// --------------------------------------------------
// Input handling (WASD keys)
// --------------------------------------------------
document.addEventListener("keydown", (event) => {
  keysPressed[event.key.toLowerCase()] = true;
});
document.addEventListener("keyup", (event) => {
  keysPressed[event.key.toLowerCase()] = false;
});

// --------------------------------------------------
// Animation loop
// --------------------------------------------------

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();

  if (characterControls) {
    characterControls.update(delta, keysPressed);

    // Manual third-person camera follow (Z-up): behind the character, fixed height
    const CAMERA_BACK = 120;
    const CAMERA_HEIGHT = 90;
    const lookHeight = 40;

    // Compute character forward in world (Z-up)
    const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(characterControls.model.quaternion);
    forward.z = 0; // project to ground
    if (forward.lengthSq() > 0) forward.normalize(); else forward.set(0,1,0);

    const desiredCamPos = new THREE.Vector3()
      .copy(characterControls.model.position)
      .addScaledVector(forward, -CAMERA_BACK)
      .add(new THREE.Vector3(0, 0, CAMERA_HEIGHT));

    camera.position.lerp(desiredCamPos, 0.2);
    const lookTarget = new THREE.Vector3()
      .copy(characterControls.model.position)
      .add(new THREE.Vector3(0, 0, lookHeight));
    camera.lookAt(lookTarget);
  }

  // Animate vehicles
  const beginningOfRow = (minTileIndex - 2) * tileSize;
  const endOfRow = (maxTileIndex + 2) * tileSize;
  metadata.forEach((rowData) => {
    if (rowData.type === 'car' || rowData.type === 'truck') {
      rowData.vehicles.forEach(({ ref }) => {
        if (!ref) return;
        if (rowData.direction) {
          ref.position.x = ref.position.x > endOfRow ? beginningOfRow : ref.position.x + rowData.speed * delta;
        } else {
          ref.position.x = ref.position.x < beginningOfRow ? endOfRow : ref.position.x - rowData.speed * delta;
        }
      });
    }
  });

  // Detect end-of-level: when character reaches beyond last row
  if (characterControls) {
    const playerY = characterControls.model.position.y;
    if (playerY >= END_Y + tileSize * 0.5) {
      window.location.href = 'http://localhost:5173/';
      return;
    }
  }

  renderer.render(scene, camera);
});

// --------------------------------------------------
// Responsive resize
// --------------------------------------------------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.updateProjectionMatrix();
});
