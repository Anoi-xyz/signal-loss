import * as THREE from 'three';
import { ASSET } from './assetlib.js';
import { soundEngine } from './assets/audio.js';

window.soundEngine = soundEngine;

// --- CONFIG & DIFFICULTY PRESETS ---
const RULES = {
  FORWARD_SPEED: 6.0,         // 6 m/s constant
  MAX_TURN_RATE: Math.PI / 2, // 90 deg/sec max
  TURN_LAG: 4.5,              // Steering inertia weight
  BASE_RADIUS: 40.0,
  MIN_RADIUS: 8.0,            // Floor before death check
  MAX_RADIUS: 70.0,           // Cap
  RADIUS_ON_HIT: 6.0,         // +6m on buoy hit
  DEATH_GRACE_TIME: 1.5,      // 1.5s grace period when radius <= 8m
  RAMP_DURATION: 90.0         // 90s difficulty ramp
};

const PRESETS = {
  EASY: {
    buoyMinLife: 8.0, buoyMaxLife: 12.0,
    spreadStart: 25, spreadEnd: 40,
    passiveDecay: 0.3,
    radiusOnMiss: -7.0,
    waveAmplitude: 0.3,                 // Calmer water (0.3m)
    maxTurnRate: (110 * Math.PI) / 180, // 110 deg/sec (responsive)
    baseFOV: 50,                        // Tighter camera framing
    camOffsetDist: -6.5,                // Closer camera distance
    camHeight: 3.8,
    multiBuoyChance: 0.0
  },
  NORMAL: {
    buoyMinLife: 6.0, buoyMaxLife: 10.0,
    spreadStart: 35, spreadEnd: 50,
    passiveDecay: 0.4,
    radiusOnMiss: -10.0,
    waveAmplitude: 0.5,                 // Current wave water (0.5m)
    maxTurnRate: (90 * Math.PI) / 180,  // 90 deg/sec
    baseFOV: 55,                        // Standard framing
    camOffsetDist: -7.5,
    camHeight: 4.2,
    multiBuoyChance: 0.0
  },
  HARD: {
    buoyMinLife: 4.0, buoyMaxLife: 7.0,
    spreadStart: 40, spreadEnd: 60,
    passiveDecay: 0.55,
    radiusOnMiss: -13.0,
    waveAmplitude: 0.8,                 // Rougher ocean water (0.8m)
    maxTurnRate: (70 * Math.PI) / 180,  // 70 deg/sec (heavier steering)
    baseFOV: 62,                        // Wider FOV (disorienting dark)
    camOffsetDist: -8.5,                // Further camera distance
    camHeight: 4.6,
    multiBuoyChance: 0.35               // ~1 in 3 spawns present real + decoy buoy
  }
};

let currentDiff = 'NORMAL';
let activeRules = { ...PRESETS.NORMAL };

// Colors from Palette
const COLORS = {
  DEEP_WATER: 0x0a1128,
  MID_WATER: 0x1c2541,
  HULL_WATER: 0x3a506b,
  BUOY_GLOW: 0xf4a261,
  MOON_HIGHLIGHT: 0xe0fbfc,
  SKY_FOG: 0x0b132b
};

// Harness State
const gameMetrics = {
  pos: [0, 0],
  fps: 60,
  speed: 0,
  score: 0,
  over: false,
  draws: 0,
  tris: 0
};

// Ready flag set immediately as soon as mounted
window.READY = true;
window.__READY__ = true;

window.GAME = gameMetrics;
window.__GAME__ = gameMetrics;

// Expose internal state for difficulty telemetry
window.getBoatHeight = () => (boatGroup ? boatGroup.position.y : 0);
window.getCameraFOV = () => (camera ? camera.fov : 55);
window.getActiveRules = () => activeRules;
window.getActiveBuoys = () => activeBuoys;
window.getBoatHeading = () => boatHeading;

// Global Scene Variables
let scene, camera, renderer;
let oceanMesh, oceanGeo, wavePositionsOriginal;
let boatGroup = null;
let buoyAssetModule = null;
let moonMesh, moonLight;

// Gameplay Variables
let gameStarted = false;
let gameOver = false;
let isPaused = false;
let runTime = 0;
let distanceTraveled = 0;

// Boost System Variables
let boostActiveTimer = 0;
let boostCooldownTimer = 0;

// Boat Physics
let boatPos = new THREE.Vector3(0, 0, 0);
let boatHeading = 0; // angle in radians (0 = +Z)
let turnInput = 0;   // -1 to 1
let currentTurnVel = 0;

// Visibility Resource
let visRadius = RULES.BASE_RADIUS;
let targetVisRadius = RULES.BASE_RADIUS;
let visSpringVel = 0;
let deathGraceTimer = 0;

// Camera Shake & Juice
let cameraShakeTime = 0;
let cameraShakeIntensity = 0;

// Buoy Management
let activeBuoys = [];
let buoySpawnTimer = 0;
let buoysSpawnedCount = 0;

// Input Handling
const keys = { left: false, right: false };

// --- DOM ELEMENTS ---
const startScreen = document.getElementById('start-screen');
const deathScreen = document.getElementById('death-screen');
const pauseScreen = document.getElementById('pause-screen');
const startBtn = document.getElementById('startb');
const restartBtn = document.getElementById('restart-button');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const boostBtn = document.getElementById('boost-btn');
const scoreText = document.getElementById('score-text');
const finalScoreText = document.getElementById('final-score-text');
const compassDirText = document.getElementById('compass-dir');
const btnLeft = document.getElementById('steerL');
const btnRight = document.getElementById('steerR');
const diffBtns = document.querySelectorAll('.diff-btn');

// --- INITIALIZATION ---
init();

async function init() {
  const container = document.getElementById('canvas-container');

  // 1. Three.js Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  // 2. Scene & Fog
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.SKY_FOG);
  scene.fog = new THREE.FogExp2(COLORS.SKY_FOG, 0.75 / RULES.BASE_RADIUS);

  // 3. Camera
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 300);
  camera.position.set(0, 4.2, -7.5);
  camera.lookAt(0, 1.2, 6.0);

  // 4. Lighting & Moon
  const ambientLight = new THREE.AmbientLight(COLORS.MID_WATER, 1.0);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(COLORS.MOON_HIGHLIGHT, COLORS.DEEP_WATER, 1.2);
  scene.add(hemiLight);

  // Directional Moonlight shining soft cold light across wave facets
  moonLight = new THREE.DirectionalLight(COLORS.MOON_HIGHLIGHT, 1.4);
  moonLight.position.set(-25, 35, 70);
  scene.add(moonLight);

  // Distant Glowing Moon Sphere in Upper-Left Horizon Sky (fog: false)
  const moonGeo = new THREE.SphereGeometry(3.0, 16, 16);
  const moonMat = new THREE.MeshBasicMaterial({ color: COLORS.MOON_HIGHLIGHT, fog: false });
  moonMesh = new THREE.Mesh(moonGeo, moonMat);
  scene.add(moonMesh);

  // 5. Ocean Setup (Non-indexed flat-shaded wave facets)
  createOcean();

  // 6. Load Assets via 404 Recipe assetlib
  try {
    boatGroup = await ASSET('./assets/boat.js', { height: 1.8 });

    // Subtle Bow Lantern PointLight (soft warm glow ON boat bow, no flashlight beam)
    const bowLight = new THREE.PointLight(0xffd166, 0.9, 4.5);
    bowLight.position.set(0, 1.1, 1.85);
    boatGroup.add(bowLight);

    scene.add(boatGroup);
  } catch (err) {
    console.warn('Fallback loading boat module:', err);
    boatGroup = new THREE.Group();
    scene.add(boatGroup);
  }

  // Pre-fetch Buoy prototype module
  try {
    const buoyModule = await import('./assets/buoy.js');
    buoyAssetModule = buoyModule.default;
  } catch (err) {
    console.warn('Fallback loading buoy module:', err);
  }

  // Ensure READY flags are set
  window.READY = true;
  window.__READY__ = true;

  // 7. Event Listeners & UI Inputs
  window.addEventListener('resize', onWindowResize);
  setupInputs();

  // Harness START hooks
  window.START = startGame;
  window.__START__ = startGame;

  // Start Animation Loop
  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt, now / 1000);
    render();
  }
  requestAnimationFrame(animate);
}

// --- OCEAN CREATION (NON-INDEXED FOR CRISP LOW-POLY WAVE FACETS) ---
function createOcean() {
  const size = 220;
  const segments = 60;
  const rawGeo = new THREE.PlaneGeometry(size, size, segments, segments);
  rawGeo.rotateX(-Math.PI / 2);

  oceanGeo = rawGeo.toNonIndexed();
  const pos = oceanGeo.attributes.position;
  wavePositionsOriginal = pos.clone();

  const oceanMat = new THREE.MeshStandardMaterial({
    color: COLORS.MID_WATER,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true
  });

  oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  scene.add(oceanMesh);
}

function getWaveHeight(x, z, time) {
  const amp = activeRules.waveAmplitude !== undefined ? activeRules.waveAmplitude : 0.5;
  const factor = amp / 0.5;
  return factor * (
    0.32 * Math.sin(x * 0.22 + time * 1.8) +
    0.22 * Math.cos(z * 0.26 + time * 1.4) +
    0.12 * Math.sin((x + z) * 0.18 + time * 2.2)
  );
}

function updateOcean(time) {
  const pos = oceanGeo.attributes.position;
  const orig = wavePositionsOriginal;

  for (let i = 0; i < pos.count; i++) {
    const vx = orig.getX(i) + oceanMesh.position.x;
    const vz = orig.getZ(i) + oceanMesh.position.z;
    const vy = getWaveHeight(vx, vz, time);
    pos.setY(i, vy);
  }

  pos.needsUpdate = true;
  oceanGeo.computeVertexNormals();

  oceanMesh.position.x = Math.floor(boatPos.x / 10) * 10;
  oceanMesh.position.z = Math.floor(boatPos.z / 10) * 10;
}

// --- INPUT HANDLERS & DIFFICULTY SELECTION ---
function setupInputs() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      triggerBoost();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  // Touch steering buttons
  const setLeft = (val) => (keys.left = val);
  const setRight = (val) => (keys.right = val);

  btnLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); setLeft(true); });
  btnLeft.addEventListener('pointerup', () => setLeft(false));
  btnLeft.addEventListener('pointerleave', () => setLeft(false));

  btnRight.addEventListener('pointerdown', (e) => { e.preventDefault(); setRight(true); });
  btnRight.addEventListener('pointerup', () => setRight(false));
  btnRight.addEventListener('pointerleave', () => setRight(false));

  // Boost button listener
  boostBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    triggerBoost();
  });

  // Difficulty preset selection logic
  diffBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      diffBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentDiff = btn.getAttribute('data-diff');
      activeRules = { ...PRESETS[currentDiff] };
    });
  });

  // Explicit start button trigger
  const handleStartTrigger = (e) => {
    if (e) e.stopPropagation();
    startGame();
  };

  startBtn.addEventListener('click', handleStartTrigger);
  startBtn.addEventListener('pointerdown', handleStartTrigger);
  startBtn.addEventListener('touchstart', handleStartTrigger);

  startScreen.addEventListener('click', handleStartTrigger);
  startScreen.addEventListener('pointerdown', handleStartTrigger);

  restartBtn.addEventListener('click', handleStartTrigger);
  restartBtn.addEventListener('pointerdown', handleStartTrigger);

  // Pause & Resume buttons
  pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); pauseGame(); });
  resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); resumeGame(); });
}

// --- BOOST MECHANIC ---
function triggerBoost() {
  if (isPaused || !gameStarted || gameOver) return;
  if (boostActiveTimer > 0 || boostCooldownTimer > 0) return;
  if (visRadius <= 11.0) return; // Prevent boost if it would cause instant death

  boostActiveTimer = 1.5;      // 1.5s boost duration
  boostCooldownTimer = 8.0;    // 8.0s cooldown
  targetVisRadius = Math.max(targetVisRadius - 3.0, RULES.MIN_RADIUS); // Costs 3m visibility radius
  visSpringVel -= 6.0;
}

// --- PAUSE & GAME CONTROL ---
function pauseGame() {
  if (!gameStarted || gameOver || isPaused) return;
  isPaused = true;
  pauseScreen.style.display = 'flex';
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  pauseScreen.style.display = 'none';
}

function startGame() {
  if (gameStarted && !gameOver) return;

  // Explicit AudioContext resume inside user gesture event
  soundEngine.initOnGesture();

  activeRules = { ...PRESETS[currentDiff] };
  gameStarted = true;
  gameOver = false;
  isPaused = false;
  runTime = 0;
  distanceTraveled = 0;
  boostActiveTimer = 0;
  boostCooldownTimer = 0;
  visRadius = RULES.BASE_RADIUS;
  targetVisRadius = RULES.BASE_RADIUS;
  visSpringVel = 0;
  deathGraceTimer = 0;
  buoySpawnTimer = 0;
  buoysSpawnedCount = 0;

  boatPos.set(0, 0, 0);
  boatHeading = 0;
  currentTurnVel = 0;

  activeBuoys.forEach((b) => scene.remove(b.group));
  activeBuoys = [];

  startScreen.style.display = 'none';
  deathScreen.style.display = 'none';
  pauseScreen.style.display = 'none';
  pauseBtn.style.display = 'block';

  // Start background ambient loop
  soundEngine.startAmbient();

  // Spawn Scripted First Buoy immediately
  spawnScriptedBuoy(1, 26, 0.05);
}

function endGame() {
  gameOver = true;
  gameStarted = false;
  isPaused = false;

  soundEngine.stopAmbient();
  pauseBtn.style.display = 'none';
  gameMetrics.over = true;
  finalScoreText.textContent = `${Math.floor(distanceTraveled)}m`;
  deathScreen.style.display = 'flex';
}

// --- BUOY SPAWNING SYSTEM ---
function spawnScriptedBuoy(id, dist, angleOffset) {
  const spawnAngle = boatHeading + angleOffset;
  const bx = boatPos.x + Math.sin(spawnAngle) * dist;
  const bz = boatPos.z + Math.cos(spawnAngle) * dist;

  createBuoyInstance(bx, bz, activeRules.buoyMaxLife);
}

function updateBuoySpawning(dt) {
  buoySpawnTimer += dt;

  const ramp = Math.min(runTime / RULES.RAMP_DURATION, 1.0);
  const lifetime = activeRules.buoyMaxLife - ramp * (activeRules.buoyMaxLife - activeRules.buoyMinLife);

  if (buoysSpawnedCount === 1 && runTime >= 8.0) {
    spawnScriptedBuoy(2, 32, -0.08);
    buoysSpawnedCount++;
    buoySpawnTimer = 0;
    return;
  }

  if (buoysSpawnedCount >= 2 && buoySpawnTimer >= 4.0) {
    buoySpawnTimer = 0;
    buoysSpawnedCount++;

    const spreadDeg = activeRules.spreadStart + ramp * (activeRules.spreadEnd - activeRules.spreadStart);
    const maxSpreadRad = (spreadDeg * 0.35) * (Math.PI / 180); // Scaled for mobile view frustum
    const randomSpread = (Math.random() * 2 - 1) * maxSpreadRad;

    const maxAhead = Math.min(42.0, visRadius * 1.05);
    const minAhead = Math.max(25.0, visRadius * 0.55);
    const spawnDist = minAhead + Math.random() * (maxAhead - minAhead);

    const isMultiBuoy = activeRules.multiBuoyChance > 0 && (Math.random() < activeRules.multiBuoyChance || buoysSpawnedCount % 3 === 0);

    if (isMultiBuoy) {
      // Primary Real Buoy (+6m reward)
      const spawnAngle = boatHeading + randomSpread;
      const bx = boatPos.x + Math.sin(spawnAngle) * spawnDist;
      const bz = boatPos.z + Math.cos(spawnAngle) * spawnDist;
      createBuoyInstance(bx, bz, lifetime, false);

      // Secondary Decoy Buoy (+2m reward, shorter lifetime ~55%)
      const decoyAngle = boatHeading - randomSpread * 0.85 + (Math.random() * 0.2 - 0.1);
      const bxDecoy = boatPos.x + Math.sin(decoyAngle) * (spawnDist * 0.9);
      const bzDecoy = boatPos.z + Math.cos(decoyAngle) * (spawnDist * 0.9);
      createBuoyInstance(bxDecoy, bzDecoy, lifetime * 0.55, true);
    } else {
      const spawnAngle = boatHeading + randomSpread;
      const bx = boatPos.x + Math.sin(spawnAngle) * spawnDist;
      const bz = boatPos.z + Math.cos(spawnAngle) * spawnDist;
      createBuoyInstance(bx, bz, lifetime, false);
    }
  }
}

function createBuoyInstance(x, z, lifetime, isDecoy = false) {
  let group;
  if (buoyAssetModule) {
    group = buoyAssetModule(THREE);
  } else {
    group = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8), new THREE.MeshStandardMaterial({ color: COLORS.MID_WATER }));
    group.add(m);
  }

  const buoyLight = new THREE.PointLight(COLORS.BUOY_GLOW, 3.0, 12.0);
  buoyLight.position.set(0, 0.75, 0);
  group.add(buoyLight);

  group.position.set(x, 0, z);
  scene.add(group);

  let lampMesh = group.userData.lampMesh;
  if (!lampMesh) {
    group.traverse((n) => {
      if (n.isMesh && (n.material.emissive || n.name === 'lampHead')) lampMesh = n;
    });
  }

  activeBuoys.push({
    group,
    lampMesh,
    buoyLight,
    pos: new THREE.Vector3(x, 0, z),
    maxLifetime: lifetime,
    lifetime: lifetime,
    reached: false,
    isDecoy: isDecoy
  });
}

// --- MAIN GAME UPDATE LOOP ---
function update(dt, time) {
  const fps = dt > 0 ? Math.round(1 / dt) : 60;

  // If paused, skip all gameplay state updates
  if (isPaused) {
    updateHUD();
    return;
  }

  // 1. Steering & Movement Physics
  turnInput = 0;
  if (keys.left) turnInput -= 1;
  if (keys.right) turnInput += 1;

  const maxTurn = activeRules.maxTurnRate !== undefined ? activeRules.maxTurnRate : RULES.MAX_TURN_RATE;
  const targetTurnVel = turnInput * maxTurn;
  currentTurnVel += (targetTurnVel - currentTurnVel) * RULES.TURN_LAG * dt;

  if (gameStarted && !gameOver) {
    runTime += dt;

    // Handle Boost Speed & Timers
    let currentSpeed = RULES.FORWARD_SPEED;
    if (boostActiveTimer > 0) {
      boostActiveTimer -= dt;
      currentSpeed = RULES.FORWARD_SPEED * 1.5; // 1.5x speed multiplier (9.0 m/s)
    }

    if (boostCooldownTimer > 0) {
      boostCooldownTimer -= dt;
    }

    boatHeading += currentTurnVel * dt;

    boatPos.x += Math.sin(boatHeading) * currentSpeed * dt;
    boatPos.z += Math.cos(boatHeading) * currentSpeed * dt;

    distanceTraveled += currentSpeed * dt;

    // 2. Passive Radius Decay
    if (window.__TEST_DROP_VIS__) {
      targetVisRadius = 14.0;
      visRadius = 14.0;
      window.__TEST_DROP_VIS__ = false;
    }
    targetVisRadius -= activeRules.passiveDecay * dt;
    targetVisRadius = THREE.MathUtils.clamp(targetVisRadius, RULES.MIN_RADIUS, RULES.MAX_RADIUS);

    // 3. Spring / Pulse Tween for Visibility Radius Changes
    const springK = 18.0;
    const springDamp = 6.5;
    const displacement = targetVisRadius - visRadius;
    visSpringVel += (displacement * springK - visSpringVel * springDamp) * dt;
    visRadius += visSpringVel * dt;

    // Update ambient audio crossfade based on visibility radius (< 20m triggers danger piano)
    soundEngine.updateVisibility(visRadius, dt);

    // 4. Death Grace Period Check
    if (visRadius <= RULES.MIN_RADIUS + 0.2) {
      deathGraceTimer += dt;
      if (deathGraceTimer >= RULES.DEATH_GRACE_TIME) {
        endGame();
      }
    } else {
      deathGraceTimer = 0;
    }

    // 5. Buoy Spawning & Collision / Expiration Check
    updateBuoySpawning(dt);
    updateBuoys(dt, time);
  }

  // 6. Update Ocean Mesh Waves
  updateOcean(time);

  // 7. Update Boat Mesh Pose, Moon Position & Camera Follow
  updateBoatAndCamera(time, dt);

  // 8. Update Fog Density (tied directly to visRadius)
  const clampedRadius = Math.max(visRadius, 5.0);
  scene.fog.density = 0.75 / clampedRadius;

  // 9. Update HUD & Harness Hooks
  updateHUD();

  gameMetrics.pos[0] = boatPos.x;
  gameMetrics.pos[1] = boatPos.z;
  gameMetrics.fps = fps;
  gameMetrics.speed = gameStarted && !gameOver && !isPaused ? (boostActiveTimer > 0 ? RULES.FORWARD_SPEED * 1.5 : RULES.FORWARD_SPEED) : 0;
  gameMetrics.score = Math.floor(distanceTraveled);
  gameMetrics.over = gameOver;
  gameMetrics.draws = renderer ? renderer.info.render.calls : 0;
  gameMetrics.tris = renderer ? renderer.info.render.triangles : 0;
}

// --- BUOY LIFETIME & REACHED MECHANICS ---
function updateBuoys(dt, time) {
  for (let i = activeBuoys.length - 1; i >= 0; i--) {
    const buoy = activeBuoys[i];
    buoy.lifetime -= dt;

    const buoyWaveY = getWaveHeight(buoy.pos.x, buoy.pos.z, time);
    buoy.group.position.y = buoyWaveY;

    const lifeRatio = Math.max(buoy.lifetime / buoy.maxLifetime, 0.0);
    const pulseFreq = 3.0 + (1.0 - lifeRatio) * 15.0;
    const pulseIntensity = 1.0 + 0.8 * Math.sin(time * pulseFreq);

    if (buoy.lampMesh && buoy.lampMesh.material) {
      buoy.lampMesh.material.emissiveIntensity = 2.8 * pulseIntensity * lifeRatio;
      buoy.lampMesh.scale.setScalar(0.9 + 0.25 * pulseIntensity);
    }

    if (buoy.buoyLight) {
      buoy.buoyLight.intensity = 3.0 * pulseIntensity * lifeRatio;
    }

    const distToBoat = boatPos.distanceTo(buoy.pos);
    if (!buoy.reached && distToBoat < 3.5) {
      buoy.reached = true;

      const reward = buoy.isDecoy ? 2.0 : RULES.RADIUS_ON_HIT;
      targetVisRadius = Math.min(targetVisRadius + reward, RULES.MAX_RADIUS);
      visSpringVel += buoy.isDecoy ? 8.0 : 18.0;

      soundEngine.playHit();

      scene.remove(buoy.group);
      activeBuoys.splice(i, 1);
      continue;
    }

    if (buoy.lifetime <= 0) {
      const missPenalty = buoy.isDecoy ? activeRules.radiusOnMiss * 0.2 : activeRules.radiusOnMiss;
      targetVisRadius = Math.max(targetVisRadius + missPenalty, RULES.MIN_RADIUS);
      visSpringVel -= buoy.isDecoy ? 4.0 : 12.0;

      if (!buoy.isDecoy) {
        cameraShakeTime = 0.09;
        cameraShakeIntensity = 0.45;
        soundEngine.playMiss();
      }

      scene.remove(buoy.group);
      activeBuoys.splice(i, 1);
    }
  }
}

// --- BOAT MESH POSE & CAMERA TRACKING ---
function updateBoatAndCamera(time, dt) {
  if (boatGroup) {
    const waveY = getWaveHeight(boatPos.x, boatPos.z, time);
    boatGroup.position.set(boatPos.x, waveY, boatPos.z);
    boatGroup.rotation.y = boatHeading;

    const waveYFront = getWaveHeight(boatPos.x + Math.sin(boatHeading) * 2, boatPos.z + Math.cos(boatHeading) * 2, time);
    const pitch = (waveYFront - waveY) * 0.25;
    const roll = -currentTurnVel * 0.15;

    boatGroup.rotation.x = pitch;
    boatGroup.rotation.z = roll;
  }

  // Update Moon Position in upper-left horizon sky ahead of boat
  if (moonMesh) {
    moonMesh.position.set(
      boatPos.x - 22.0,
      22.0,
      boatPos.z + 75.0
    );
  }

  if (moonLight) {
    moonLight.position.set(
      boatPos.x - 25.0,
      35.0,
      boatPos.z + 70.0
    );
  }

  // Dynamic Camera FOV stretch based on preset FOV + boost
  const baseFOV = activeRules.baseFOV || 55;
  const targetFOV = boostActiveTimer > 0 ? baseFOV + 7 : baseFOV;
  camera.fov += (targetFOV - camera.fov) * 8.0 * dt;
  camera.updateProjectionMatrix();

  // Camera Third-Person Damping & Shake
  const camOffsetDist = activeRules.camOffsetDist || -7.5;
  const camHeight = activeRules.camHeight || 4.2;

  const targetCamX = boatPos.x + Math.sin(boatHeading) * camOffsetDist;
  const targetCamZ = boatPos.z + Math.cos(boatHeading) * camOffsetDist;
  const targetCamY = boatPos.y + camHeight;

  camera.position.x += (targetCamX - camera.position.x) * 6.0 * dt;
  camera.position.z += (targetCamZ - camera.position.z) * 6.0 * dt;
  camera.position.y += (targetCamY - camera.position.y) * 6.0 * dt;

  if (cameraShakeTime > 0) {
    cameraShakeTime -= dt;
    camera.position.x += (Math.random() - 0.5) * cameraShakeIntensity;
    camera.position.y += (Math.random() - 0.5) * cameraShakeIntensity;
  }

  const lookTarget = new THREE.Vector3(
    boatPos.x + Math.sin(boatHeading) * 6.0,
    boatPos.y + 1.2,
    boatPos.z + Math.cos(boatHeading) * 6.0
  );
  camera.lookAt(lookTarget);
}

// --- HUD UPDATE & COMPASS ---
function updateHUD() {
  scoreText.textContent = `${Math.floor(distanceTraveled)}m`;

  // Real-time Needle Rotation driven directly by boatHeading
  const needleEl = document.getElementById('compass-needle');
  if (needleEl) {
    const deg = (boatHeading * 180 / Math.PI);
    needleEl.setAttribute('transform', `rotate(${deg} 22 22)`);
  }

  // Boost Button State
  const boostDisabled = boostActiveTimer > 0 || boostCooldownTimer > 0 || visRadius <= 11.0;
  if (boostBtn) {
    if (boostDisabled) {
      boostBtn.classList.add('disabled');
    } else {
      boostBtn.classList.remove('disabled');
    }
  }
}

// --- RENDER ---
function render() {
  if (renderer) renderer.render(scene, camera);
}

// --- WINDOW RESIZE ---
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
