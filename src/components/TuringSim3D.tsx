import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCw, Sparkles, Paintbrush, Move, Layers, Grid2X2, Check, HelpCircle } from 'lucide-react';
import { TURING_PRESETS, TuringParameters } from '../types';

interface TuringSim3DProps {
  params: TuringParameters;
  onChangeParams: (p: TuringParameters) => void;
  chapterMode?: boolean;
  onChallengeSuccess?: () => void;
  challengeCheck?: (grid: number[][]) => boolean;
}

export default function TuringSim3D({
  params,
  onChangeParams,
  chapterMode = false,
  onChallengeSuccess,
  challengeCheck,
}: TuringSim3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Simulation grid states
  const gridARef = useRef<number[][]>([]);
  const gridBRef = useRef<number[][]>([]);
  const nextARef = useRef<number[][]>([]);
  const nextBRef = useRef<number[][]>([]);

  // Simulation interaction states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [interactionMode, setInteractionMode] = useState<'paint' | 'rotate'>('paint');
  const [simSpeed, setSimSpeed] = useState<number>(12); // Number of steps per frame
  const [showInhibitor, setShowInhibitor] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<'coral' | 'bioluminescence' | 'sunset' | 'emerald'>('coral');
  const [showStats, setShowStats] = useState({ variance: 0, spotsCount: 0 });

  // Input states tracking mouse/drag
  const isMouseDownRef = useRef<boolean>(false);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouse3DRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Initialize grids on resize/res
  const initGrids = (res: number) => {
    const a: number[][] = [];
    const b: number[][] = [];
    const nextA: number[][] = [];
    const nextB: number[][] = [];

    for (let x = 0; x < res; x++) {
      a[x] = [];
      b[x] = [];
      nextA[x] = [];
      nextB[x] = [];
      for (let y = 0; y < res; y++) {
        // Base state: fully saturated with chemical A, sterile of chemical B
        a[x][y] = 1.0;
        b[x][y] = 0.0;
        nextA[x][y] = 1.0;
        nextB[x][y] = 0.0;
      }
    }

    // Seed a central clump of B to trigger symmetry-breaking
    const r = Math.floor(res * 0.1) || 5;
    const cx = Math.floor(res / 2);
    const cy = Math.floor(res / 2);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const nx = (cx + dx + res) % res;
        const ny = (cy + dy + res) % res;
        if (dx * dx + dy * dy < r * r) {
          a[nx][ny] = 0.5;
          b[nx][ny] = 0.25;
        }
      }
    }

    // Add some random trace noise to simulate cellular fluctuations
    for (let i = 0; i < res * res * 0.08; i++) {
      const rx = Math.floor(Math.random() * res);
      const ry = Math.floor(Math.random() * res);
      a[rx][ry] = 0.5 + Math.random() * 0.1;
      b[rx][ry] = 0.25 + Math.random() * 0.1;
    }

    gridARef.current = a;
    gridBRef.current = b;
    nextARef.current = nextA;
    nextBRef.current = nextB;
  };

  // Re-seed grid with random patterns
  const handleRandomSeed = () => {
    const res = params.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length) return;

    // Clear
    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        a[x][y] = 1.0;
        b[x][y] = 0.0;
      }
    }

    // Seed multiple random spots
    const numSpots = 15 + Math.floor(Math.random() * 20);
    const rad = Math.max(2, Math.floor(res * 0.05));
    for (let s = 0; s < numSpots; s++) {
      const cx = Math.floor(Math.random() * res);
      const cy = Math.floor(Math.random() * res);
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dy = -rad; dy <= rad; dy++) {
          if (dx * dx + dy * dy < rad * rad) {
            const nx = (cx + dx + res) % res;
            const ny = (cy + dy + res) % res;
            a[nx][ny] = 0.5;
            b[nx][ny] = 0.25 + Math.random() * 0.25;
          }
        }
      }
    }

    // High frequency noise
    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        if (Math.random() < 0.15) {
          a[x][y] = 0.5 + Math.random() * 0.1;
          b[x][y] = 0.25 + Math.random() * 0.15;
        }
      }
    }
  };

  // Completely wipe the grid
  const handleWipe = () => {
    const res = params.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length) return;
    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        a[x][y] = 1.0;
        b[x][y] = 0.0;
      }
    }
  };

  // Run Gray-Scott Reaction Diffusion Simulation Step
  // Periodic boundary conditions and using 9-point Laplacian stencil
  const runSimulationStep = () => {
    const res = params.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    const nextA = nextARef.current;
    const nextB = nextBRef.current;

    if (!a.length || !b.length) return;

    const f = params.feed;
    const k = params.kill;
    const da = params.diffuseA;
    const db = params.diffuseB;
    const dt = params.timeStep;

    for (let x = 0; x < res; x++) {
      // Precompute neighboring indices for wrapped toroidal boundary conditions
      const xm1 = (x - 1 + res) % res;
      const xp1 = (x + 1) % res;

      for (let y = 0; y < res; y++) {
        const ym1 = (y - 1 + res) % res;
        const yp1 = (y + 1) % res;

        // Current cell concentrations
        const valA = a[x][y];
        const valB = b[x][y];

        // 9-point weighted stencil
        // Center: -1.0
        // Card (left, right, top, bottom): 0.2 each
        // Diag (corners): 0.05 each
        const lapA =
          valA * -1.0 +
          (a[xm1][y] + a[xp1][y] + a[x][ym1] + a[x][yp1]) * 0.2 +
          (a[xm1][ym1] + a[xp1][ym1] + a[xm1][yp1] + a[xp1][yp1]) * 0.05;

        const lapB =
          valB * -1.0 +
          (b[xm1][y] + b[xp1][y] + b[x][ym1] + b[x][yp1]) * 0.2 +
          (b[xm1][ym1] + b[xp1][ym1] + b[xm1][yp1] + b[xp1][yp1]) * 0.05;

        const abb = valA * valB * valB;

        // Differential Equations
        const deltaA = da * lapA - abb + f * (1.0 - valA);
        const deltaB = db * lapB + abb - (f + k) * valB;

        nextA[x][y] = Math.max(0.0, Math.min(1.0, valA + deltaA * dt));
        nextB[x][y] = Math.max(0.0, Math.min(1.0, valB + deltaB * dt));
      }
    }

    // Swap buffers
    gridARef.current = nextA;
    gridBRef.current = nextB;
    nextARef.current = a;
    nextBRef.current = b;
  };

  // Color mapper based on concentrations
  const updateTextureCanvas = () => {
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const res = params.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length || !b.length) return;

    const imgData = ctx.createImageData(res, res);
    let totalB = 0;
    let sumBSquared = 0;
    let activatedCount = 0;

    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        const concA = a[x][y];
        const concB = b[x][y];
        totalB += concB;
        sumBSquared += concB * concB;
        if (concB > 0.35) activatedCount++;

        // Interpolated color schemas
        let r_val = 0, g_val = 0, b_val = 0;

        // Choose Theme
        // We render Activator in deep background or light contrasting shades, and Inhibitor as distinct colorful spots
        const intensity = Math.min(1, concB * 2.2); // scale factor for visual punch

        if (colorTheme === 'coral') {
          // Soft off-white turning into beautiful deep biological coral-red
          r_val = Math.floor(250 - intensity * 150);
          g_val = Math.floor(245 - intensity * 200);
          b_val = Math.floor(240 - intensity * 175);
        } else if (colorTheme === 'bioluminescence') {
          // Dark twilight blue turning into biological electric teal/green
          r_val = Math.floor(15 + intensity * 20);
          g_val = Math.floor(20 + intensity * 215);
          b_val = Math.floor(35 + intensity * 180);
        } else if (colorTheme === 'sunset') {
          // Soft dust turning into vibrant magenta-orange waves
          r_val = Math.floor(240 - (1 - intensity) * 190);
          g_val = Math.floor(230 - (1 - intensity) * 210);
          b_val = Math.floor(220 - (1 - intensity) * 140);
        } else if (colorTheme === 'emerald') {
          // Velvet charcoal turning into high-contrast neon mint chemistry
          r_val = Math.floor(30 + intensity * 40);
          g_val = Math.floor(35 + intensity * 200);
          b_val = Math.floor(40 + intensity * 100);
        }

        const idx = (y * res + x) * 4;
        imgData.data[idx] = r_val;
        imgData.data[idx + 1] = g_val;
        imgData.data[idx + 2] = b_val;
        imgData.data[idx + 3] = 255; // fully opaque
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Compute simple metrics for Chapter completion validation
    const meanB = totalB / (res * res);
    const varianceB = (sumBSquared / (res * res)) - (meanB * meanB);
    setShowStats({
      variance: varianceB * 1000,
      spotsCount: activatedCount,
    });
  };

  // Paint chemical B onto grid at UV coordinate
  const paintAtUV = (u: number, v: number) => {
    const res = params.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length) return;

    // Map UV coordinates (0 to 1) to grid coordinates (0 to resolution-1)
    const targetX = Math.floor(u * res);
    // Invert V coordinate to match web canvas texturing orientation
    const targetY = Math.floor((1 - v) * res);

    const radius = params.brushSize;
    const brush = params.brushType;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const nx = (targetX + dx + res) % res;
          const ny = (targetY + dy + res) % res;

          if (brush === 'addB') {
            a[nx][ny] = 0.4;
            b[nx][ny] = 0.9;
          } else if (brush === 'addA') {
            a[nx][ny] = 1.0;
            b[nx][ny] = 0.0;
          } else if (brush === 'noise') {
            a[nx][ny] = 0.5 + Math.random() * 0.1;
            b[nx][ny] = 0.25 + Math.random() * 0.35;
          }
        }
      }
    }
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
  };

  // Initialize Three.js Scene and simulation arrays
  useEffect(() => {
    initGrids(params.resolution);
  }, [params.resolution]);

  // Handle 3D canvas and canvas textures
  useEffect(() => {
    if (!containerRef.current || !canvas2dRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = Math.max(380, containerRef.current.clientHeight);

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#faf9f6'); // Beautiful off-white canvas
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.2;
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff3e0, 0.85); // Warm key light
    dirLight1.position.set(5, 5, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xe0f7fa, 0.5); // Cool fill light
    dirLight2.position.set(-5, -3, 2);
    scene.add(dirLight2);

    // 5. Texture Mapper from Canvas2D
    const texture = new THREE.CanvasTexture(canvas2dRef.current);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    textureRef.current = texture;

    // 6. Mesh Creation based on selected type
    let geometry: THREE.BufferGeometry;

    if (params.meshType === 'sphere') {
      // The Embryo / Egg
      geometry = new THREE.SphereGeometry(1.3, 64, 48);
    } else if (params.meshType === 'cylinder') {
      // A limb or growing plant organ
      geometry = new THREE.CylinderGeometry(0.85, 0.85, 2.4, 64, 32);
    } else if (params.meshType === 'torus') {
      // Toroidal tissue torus boundary
      geometry = new THREE.TorusGeometry(1.0, 0.45, 32, 64);
    } else {
      // Parametric Organic Bumpy starfish-like/cellular embryo
      // Built manually in modern Three.js using robust parametric math
      const uvs: number[] = [];
      const positions: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];

      const radialSegments = 64;
      const heightSegments = 64;

      for (let j = 0; j <= heightSegments; j++) {
        const theta = (j / heightSegments) * Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let i = 0; i <= radialSegments; i++) {
          const phi = (i / radialSegments) * 2 * Math.PI;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          // Organic bump formula: create a starfish / sea-urchin lobed embryo!
          // Symmetrical but bumpy structure
          const bump = 1.0 + 0.18 * Math.sin(5 * phi) * Math.sin(3 * theta);
          const r = 1.25 * bump;

          const x = r * sinTheta * cosPhi;
          const y = r * cosTheta;
          const z = r * sinTheta * sinPhi;

          positions.push(x, y, z);
          uvs.push(i / radialSegments, j / heightSegments);

          // Approximate normal for lighting
          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;
          normals.push(nx, ny, nz);
        }
      }

      for (let j = 0; j < heightSegments; j++) {
        for (let i = 0; i < radialSegments; i++) {
          const first = j * (radialSegments + 1) + i;
          const second = first + radialSegments + 1;

          indices.push(first, second, first + 1);
          indices.push(second, second + 1, first + 1);
        }
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setIndex(indices);
    }

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.15,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // Standard initial angle mapping
    mesh.rotation.y = -0.3;
    mesh.rotation.x = 0.2;
    scene.add(mesh);
    meshRef.current = mesh;

    // Handle Window Resize on container boundary
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.max(380, containerRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Initial fill
    updateTextureCanvas();

    // 7. Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (_) {}
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [params.meshType, colorTheme]);

  // Main Loop logic running the differential updates
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      if (isPlaying) {
        // Run several simulation iterations per visual frame for satisfying speed
        for (let i = 0; i < simSpeed; i++) {
          runSimulationStep();
        }
        updateTextureCanvas();
        if (textureRef.current) {
          textureRef.current.needsUpdate = true;
        }

        // Challenge Evaluation Hook
        if (chapterMode && challengeCheck && onChallengeSuccess) {
          const completed = challengeCheck(gridBRef.current);
          if (completed) {
            onChallengeSuccess();
          }
        }
      }

      // Render Scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Subtle constant rotation of the embryology body for biological life feeling
        if (meshRef.current && !isMouseDownRef.current) {
          meshRef.current.rotation.y += 0.0012;
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, simSpeed, params, chapterMode, colorTheme]);

  // Raycaster and rotation drag inputs
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    mousePositionRef.current = { x: clientX, y: clientY };

    if (interactionMode === 'paint' && cameraRef.current && meshRef.current) {
      // Calculate normalized device coordinates
      mouse3DRef.current.x = (clientX / rect.width) * 2 - 1;
      mouse3DRef.current.y = -(clientY / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouse3DRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(meshRef.current);

      if (intersects.length > 0 && intersects[0].uv) {
        paintAtUV(intersects[0].uv.x, intersects[0].uv.y);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const deltaX = clientX - mousePositionRef.current.x;
    const deltaY = clientY - mousePositionRef.current.y;

    mousePositionRef.current = { x: clientX, y: clientY };

    if (interactionMode === 'rotate' && meshRef.current) {
      // Orbiting
      meshRef.current.rotation.y += deltaX * 0.01;
      meshRef.current.rotation.x += deltaY * 0.01;
    } else if (interactionMode === 'paint' && cameraRef.current && meshRef.current) {
      // Paint drag
      mouse3DRef.current.x = (clientX / rect.width) * 2 - 1;
      mouse3DRef.current.y = -(clientY / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouse3DRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(meshRef.current);

      if (intersects.length > 0 && intersects[0].uv) {
        paintAtUV(intersects[0].uv.x, intersects[0].uv.y);
      }
    }
  };

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  // Helper presets setter
  const applyPreset = (key: string) => {
    const preset = TURING_PRESETS[key];
    if (preset) {
      onChangeParams({
        ...params,
        feed: preset.feed,
        kill: preset.kill,
      });
      initGrids(params.resolution);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#faf9f6]/40 rounded-2xl border border-stone-200/60 overflow-hidden shadow-sm" id="turing-playground">
      {/* 2D texture computation canvas hidden from view */}
      <canvas
        ref={canvas2dRef}
        width={params.resolution}
        height={params.resolution}
        className="hidden"
        id="hidden-rd-canvas"
      />

      {/* Main 3D Container */}
      <div className="relative flex-1 bg-stone-50 overflow-hidden cursor-crosshair group/panel min-h-[340px]">
        {/* Render Target */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full"
          id="webgl-canvas-container"
        />

        {/* Floating Tooltips & Hints */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-stone-100 px-3 py-1.5 rounded-full text-xs font-medium text-stone-600 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span>
              {interactionMode === 'paint'
                ? 'Paint Mode: Click & Drag directly on the body!'
                : 'Rotate Mode: Drag to orbit the organism'}
            </span>
          </div>
        </div>

        {/* Interactive Overlay Tool HUD on the right side of canvas */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={() => setInteractionMode(interactionMode === 'paint' ? 'rotate' : 'paint')}
            className={`p-2.5 rounded-xl border shadow-sm transition-all flex items-center justify-center ${
              interactionMode === 'paint'
                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
            }`}
            title={interactionMode === 'paint' ? 'Switch to Rotate Mode' : 'Switch to Paint Mode'}
            id="toggle-interaction-btn"
          >
            {interactionMode === 'paint' ? (
              <Paintbrush className="w-5 h-5" />
            ) : (
              <Move className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-2.5 rounded-xl border shadow-sm transition-all bg-white hover:bg-stone-100 border-stone-200 ${
              isPlaying ? 'text-stone-700' : 'text-emerald-500 font-bold bg-emerald-50/50'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            id="play-pause-sim-btn"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button
            onClick={handleRandomSeed}
            className="p-2.5 rounded-xl border bg-white hover:bg-stone-100 border-stone-200 text-stone-700 shadow-sm transition-all"
            title="Random Chemical Shock"
            id="random-shock-btn"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button
            onClick={handleWipe}
            className="p-2.5 rounded-xl border bg-white hover:bg-rose-50 border-stone-200 text-rose-500 shadow-sm transition-all"
            title="Chemical Clear (Blank)"
            id="wipe-sim-btn"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* Stats and Analytics in corner */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md border border-stone-200/60 p-2.5 sm:p-3 rounded-2xl text-[11px] font-mono text-stone-600 shadow-lg flex flex-col gap-1 pointer-events-auto">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 font-sans font-bold">EMBRYO STATS</div>
          <div>Pattern Contrast: <span className="text-stone-800 font-semibold">{showStats.variance.toFixed(1)}</span></div>
          <div>Activated Nodes: <span className="text-stone-800 font-semibold">{showStats.spotsCount}</span></div>
          <div className="flex gap-1.5 mt-1.5">
            <span className="w-3 h-3 rounded-full bg-[#fcd34d] block border border-amber-400/40" title="Chemical A: Feedstock/Inhibitor" />
            <span className="w-3 h-3 rounded-full bg-[#f87171] block border border-red-400/40" title="Chemical B: Autocatalytic Activator" />
            <span className="text-[9px] text-stone-400 font-sans">Active feedback loop</span>
          </div>
        </div>

        {/* Biological Color Palette toggler bottom right */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md border border-stone-200/50 px-2.5 py-1.5 rounded-full flex gap-1.5 shadow-sm text-xs items-center">
          <span className="text-[10px] text-stone-400 font-sans mr-1 font-semibold uppercase">LUT:</span>
          <button
            onClick={() => setColorTheme('coral')}
            className={`w-4 h-4 rounded-full bg-red-400 border transition-all ${
              colorTheme === 'coral' ? 'ring-2 ring-stone-900 border-white scale-110' : 'border-stone-300'
            }`}
            title="Biological Coral Theme"
          />
          <button
            onClick={() => setColorTheme('bioluminescence')}
            className={`w-4 h-4 rounded-full bg-cyan-400 border transition-all ${
              colorTheme === 'bioluminescence' ? 'ring-2 ring-stone-900 border-white scale-110' : 'border-stone-300'
            }`}
            title="Deep ocean bioluminescence"
          />
          <button
            onClick={() => setColorTheme('sunset')}
            className={`w-4 h-4 rounded-full bg-amber-400 border transition-all ${
              colorTheme === 'sunset' ? 'ring-2 ring-stone-900 border-white scale-110' : 'border-stone-300'
            }`}
            title="Retro sunset cells"
          />
          <button
            onClick={() => setColorTheme('emerald')}
            className={`w-4 h-4 rounded-full bg-emerald-400 border transition-all ${
              colorTheme === 'emerald' ? 'ring-2 ring-stone-900 border-white scale-110' : 'border-stone-300'
            }`}
            title="Acid Emerald chemistry"
          />
        </div>
      </div>

      {/* Control HUD / Calibration deck */}
      <div className="bg-white p-4 border-t border-stone-200/60 flex flex-col gap-4">
        {/* Dynamic biological models */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-stone-500" />
              <span>Embryo Geometry (3D Organism Envelope)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['sphere', 'cylinder', 'torus', 'organism'] as const).map((mesh) => (
                <button
                  key={mesh}
                  onClick={() => onChangeParams({ ...params, meshType: mesh })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border capitalize transition-all ${
                    params.meshType === mesh
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  id={`mesh-select-${mesh}`}
                >
                  {mesh === 'organism' ? 'Organism' : mesh}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Grid2X2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Turing Pattern Biological Target Presets</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.keys(TURING_PRESETS).slice(0, 3).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all truncate text-left ${
                    Math.abs(params.feed - TURING_PRESETS[key].feed) < 0.002 &&
                    Math.abs(params.kill - TURING_PRESETS[key].kill) < 0.002
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  title={TURING_PRESETS[key].description}
                  id={`preset-select-${key}`}
                >
                  🌱 {TURING_PRESETS[key].name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sliders for Feed and Kill rates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-stone-100">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
                <span>Concentration Feed Rate (</span>
                <span className="font-mono text-stone-700 font-bold">f</span>
                <span>)</span>
              </span>
              <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-700">
                {params.feed.toFixed(4)}
              </span>
            </div>
            <input
              type="range"
              min="0.0100"
              max="0.0900"
              step="0.0005"
              value={params.feed}
              onChange={(e) => onChangeParams({ ...params, feed: parseFloat(e.target.value) })}
              className="w-full accent-stone-700 h-1 bg-stone-100 rounded-lg cursor-pointer"
              id="slider-feed-rate"
            />
            <p className="text-[10px] text-stone-400 italic">Rate at which inactive Chemical A is replenished.</p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
                <span>Reaction Cleansing Rate (</span>
                <span className="font-mono text-stone-700 font-bold">k</span>
                <span>)</span>
              </span>
              <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-700">
                {params.kill.toFixed(4)}
              </span>
            </div>
            <input
              type="range"
              min="0.0450"
              max="0.0700"
              step="0.0005"
              value={params.kill}
              onChange={(e) => onChangeParams({ ...params, kill: parseFloat(e.target.value) })}
              className="w-full accent-stone-700 h-1 bg-stone-100 rounded-lg cursor-pointer"
              id="slider-kill-rate"
            />
            <p className="text-[10px] text-stone-400 italic">Rate at which active Chemical B is decayed/removed.</p>
          </div>
        </div>

        {/* Dynamic feedback display explaining reaction limits */}
        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/50 flex gap-2 items-start text-xs text-stone-600">
          <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-stone-800">Morphogenetic Feedback Rule:</span>
            <span>
              If Feed (<span className="font-mono bg-stone-100 px-0.5 text-stone-800">f</span>) is too high or Kill (<span className="font-mono bg-stone-100 px-0.5 text-stone-800">k</span>) is too low, Chemical A will be completely consumed, resulting in a solid activation wave. Find the delicate bifurcation border to spawn patterns!
            </span>
          </div>
        </div>

        {/* Advanced tuning parameters drawer */}
        <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-stone-500">Paint Brush Size (Radius)</span>
            <span className="font-mono text-xs text-stone-700">{params.brushSize} px</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 4, 8, 12].map((size) => (
              <button
                key={size}
                onClick={() => onChangeParams({ ...params, brushSize: size })}
                className={`py-1 px-2.5 text-xs font-mono rounded-lg border transition-all ${
                  params.brushSize === size
                    ? 'bg-stone-200 text-stone-800 border-stone-300'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-500'
                }`}
                id={`brush-size-${size}`}
              >
                {size}px
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              {(['addB', 'addA', 'noise'] as const).map((bType) => (
                <button
                  key={bType}
                  onClick={() => onChangeParams({ ...params, brushType: bType })}
                  className={`py-1 px-2 text-xs rounded-lg border capitalize transition-all ${
                    params.brushType === bType
                      ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  id={`brush-type-${bType}`}
                >
                  {bType === 'addB' ? '+ Activator' : bType === 'addA' ? '+ Inhibitor' : '⚡ Noise'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
