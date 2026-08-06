import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCw, Sparkles, Paintbrush, Move, Layers, Grid2X2, HelpCircle } from 'lucide-react';
import { TURING_PRESETS, TuringParameters } from '../types';

interface TuringSim3DProps {
  params: TuringParameters;
  onChangeParams: (p: TuringParameters) => void;
  onChallengeSuccess?: () => void;
  challengeCheck?: (grid: number[][]) => boolean;
}

/**
 * Seed amplitude.
 *
 * The original code seeded A = 0.5, B = 0.25. Gray-Scott is an excitable
 * (sub-critical) system: with B that small, A*B^2 barely exceeds (f+k)*B and
 * the activator dies out across most of the interesting parameter range.
 * That is why several presets used to render a blank surface. A = 0.25,
 * B = 0.5 is comfortably above the nucleation threshold everywhere.
 */
const SEED_A = 0.25;
const SEED_B = 0.5;

export default function TuringSim3D({
  params,
  onChangeParams,
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

  const gridARef = useRef<number[][]>([]);
  const gridBRef = useRef<number[][]>([]);
  const nextARef = useRef<number[][]>([]);
  const nextBRef = useRef<number[][]>([]);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [interactionMode, setInteractionMode] = useState<'paint' | 'rotate'>('paint');
  const [simSpeed, setSimSpeed] = useState<number>(12);
  const [showSubstrate, setShowSubstrate] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<'coral' | 'bioluminescence' | 'sunset' | 'emerald'>('coral');
  const [showStats, setShowStats] = useState({ variance: 0, coverage: 0, alive: true });

  const isMouseDownRef = useRef<boolean>(false);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouse3DRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Live values read by the rAF loop. Keeping them in refs means dragging a
  // slider no longer tears down and rebuilds the animation loop on every
  // input event (the original had `params` in the loop's dependency array).
  const paramsRef = useRef(params);
  const themeRef = useRef(colorTheme);
  const substrateRef = useRef(showSubstrate);
  const speedRef = useRef(simSpeed);
  const playingRef = useRef(isPlaying);
  const challengeRef = useRef(challengeCheck);
  const successRef = useRef(onChallengeSuccess);

  useEffect(() => {
    paramsRef.current = params;
    themeRef.current = colorTheme;
    substrateRef.current = showSubstrate;
    speedRef.current = simSpeed;
    playingRef.current = isPlaying;
    challengeRef.current = challengeCheck;
    successRef.current = onChallengeSuccess;
  });

  // ---------------------------------------------------------------------------
  // Grid setup
  // ---------------------------------------------------------------------------
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
        a[x][y] = 1.0;
        b[x][y] = 0.0;
        nextA[x][y] = 1.0;
        nextB[x][y] = 0.0;
      }
    }

    const r = Math.floor(res * 0.1) || 5;
    const cx = Math.floor(res / 2);
    const cy = Math.floor(res / 2);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx * dx + dy * dy < r * r) {
          const nx = (cx + dx + res) % res;
          const ny = (cy + dy + res) % res;
          a[nx][ny] = SEED_A;
          b[nx][ny] = SEED_B;
        }
      }
    }

    for (let i = 0; i < res * res * 0.08; i++) {
      const rx = Math.floor(Math.random() * res);
      const ry = Math.floor(Math.random() * res);
      a[rx][ry] = SEED_A + Math.random() * 0.1;
      b[rx][ry] = SEED_B + Math.random() * 0.1;
    }

    gridARef.current = a;
    gridBRef.current = b;
    nextARef.current = nextA;
    nextBRef.current = nextB;
  };

  const handleRandomSeed = () => {
    const res = paramsRef.current.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length) return;

    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        a[x][y] = 1.0;
        b[x][y] = 0.0;
      }
    }

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
            a[nx][ny] = SEED_A;
            b[nx][ny] = SEED_B + Math.random() * 0.25;
          }
        }
      }
    }

    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        if (Math.random() < 0.15) {
          a[x][y] = SEED_A + Math.random() * 0.1;
          b[x][y] = SEED_B + Math.random() * 0.15;
        }
      }
    }
    // Redraw immediately, so the button also works while paused.
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
  };

  const handleWipe = () => {
    const res = paramsRef.current.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length) return;
    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        a[x][y] = 1.0;
        b[x][y] = 0.0;
      }
    }
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
  };

  // ---------------------------------------------------------------------------
  // Gray-Scott step. Periodic BCs, 9-point Laplacian (centre -1, edges 0.2,
  // corners 0.05 - weights sum to zero, as required).
  //
  //   dA/dt = Da * lap(A) - A*B^2 + f * (1 - A)
  //   dB/dt = Db * lap(B) + A*B^2 - (f + k) * B
  // ---------------------------------------------------------------------------
  const runSimulationStep = () => {
    const p = paramsRef.current;
    const res = p.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    const nextA = nextARef.current;
    const nextB = nextBRef.current;

    if (!a.length || !b.length || !nextA.length) return;

    const { feed: f, kill: k, diffuseA: da, diffuseB: db, timeStep: dt } = p;

    for (let x = 0; x < res; x++) {
      const xm1 = (x - 1 + res) % res;
      const xp1 = (x + 1) % res;
      const aX = a[x], aM = a[xm1], aP = a[xp1];
      const bX = b[x], bM = b[xm1], bP = b[xp1];
      const nAx = nextA[x], nBx = nextB[x];

      for (let y = 0; y < res; y++) {
        const ym1 = (y - 1 + res) % res;
        const yp1 = (y + 1) % res;

        const valA = aX[y];
        const valB = bX[y];

        const lapA =
          -valA +
          (aM[y] + aP[y] + aX[ym1] + aX[yp1]) * 0.2 +
          (aM[ym1] + aP[ym1] + aM[yp1] + aP[yp1]) * 0.05;

        const lapB =
          -valB +
          (bM[y] + bP[y] + bX[ym1] + bX[yp1]) * 0.2 +
          (bM[ym1] + bP[ym1] + bM[yp1] + bP[yp1]) * 0.05;

        const abb = valA * valB * valB;

        const deltaA = da * lapA - abb + f * (1.0 - valA);
        const deltaB = db * lapB + abb - (f + k) * valB;

        nAx[y] = Math.max(0.0, Math.min(1.0, valA + deltaA * dt));
        nBx[y] = Math.max(0.0, Math.min(1.0, valB + deltaB * dt));
      }
    }

    gridARef.current = nextA;
    gridBRef.current = nextB;
    nextARef.current = a;
    nextBRef.current = b;
  };

  const updateTextureCanvas = () => {
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const res = paramsRef.current.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length || !b.length) return;
    if (canvas.width !== res) {
      canvas.width = res;
      canvas.height = res;
    }

    const theme = themeRef.current;
    const showA = substrateRef.current;
    const imgData = ctx.createImageData(res, res);
    let totalB = 0;
    let sumBSquared = 0;
    let activatedCount = 0;
    let maxB = 0;

    for (let x = 0; x < res; x++) {
      for (let y = 0; y < res; y++) {
        const concA = a[x][y];
        const concB = b[x][y];
        totalB += concB;
        sumBSquared += concB * concB;
        if (concB > 0.2) activatedCount++;
        if (concB > maxB) maxB = concB;

        // "Show substrate" maps chemical A instead of B, so the reader can
        // see the depletion moat that surrounds every activator blob.
        const value = showA ? 1 - concA : concB;
        const intensity = Math.min(1, value * 2.2);

        let r_val = 0, g_val = 0, b_val = 0;
        if (theme === 'coral') {
          r_val = 250 - intensity * 150;
          g_val = 245 - intensity * 200;
          b_val = 240 - intensity * 175;
        } else if (theme === 'bioluminescence') {
          r_val = 15 + intensity * 20;
          g_val = 20 + intensity * 215;
          b_val = 35 + intensity * 180;
        } else if (theme === 'sunset') {
          r_val = 240 - (1 - intensity) * 190;
          g_val = 230 - (1 - intensity) * 210;
          b_val = 220 - (1 - intensity) * 140;
        } else {
          r_val = 30 + intensity * 40;
          g_val = 35 + intensity * 200;
          b_val = 40 + intensity * 100;
        }

        const idx = (y * res + x) * 4;
        imgData.data[idx] = r_val;
        imgData.data[idx + 1] = g_val;
        imgData.data[idx + 2] = b_val;
        imgData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const meanB = totalB / (res * res);
    const varianceB = sumBSquared / (res * res) - meanB * meanB;
    setShowStats({
      variance: varianceB * 1000,
      coverage: activatedCount / (res * res),
      alive: maxB > 0.05,
    });
  };

  const paintAtUV = (u: number, v: number) => {
    const p = paramsRef.current;
    const res = p.resolution;
    const a = gridARef.current;
    const b = gridBRef.current;
    if (!a.length) return;

    const targetX = Math.floor(u * res);
    const targetY = Math.floor((1 - v) * res);

    const radius = p.brushSize;
    const brush = p.brushType;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const nx = (targetX + dx + res) % res;
          const ny = (targetY + dy + res) % res;

          if (brush === 'addB') {
            a[nx][ny] = SEED_A;
            b[nx][ny] = 0.9;
          } else if (brush === 'addA') {
            a[nx][ny] = 1.0;
            b[nx][ny] = 0.0;
          } else {
            a[nx][ny] = SEED_A + Math.random() * 0.1;
            b[nx][ny] = SEED_B + Math.random() * 0.35;
          }
        }
      }
    }
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
  };

  // Rebuild grids only when the resolution changes.
  useEffect(() => {
    initGrids(params.resolution);
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.resolution]);

  // ---------------------------------------------------------------------------
  // Three.js scene. Depends on meshType ONLY. The original also rebuilt the
  // entire WebGL renderer whenever the colour theme changed, and never called
  // renderer.dispose(), so switching themes or meshes leaked GL contexts until
  // the browser hit its ~16-context ceiling and started killing old canvases.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canvas2dRef.current) return;

    const width = container.clientWidth || 600;
    const height = Math.max(380, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#faf9f6');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.2;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight1 = new THREE.DirectionalLight(0xfff3e0, 0.85);
    dirLight1.position.set(5, 5, 4);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xe0f7fa, 0.5);
    dirLight2.position.set(-5, -3, 2);
    scene.add(dirLight2);

    const texture = new THREE.CanvasTexture(canvas2dRef.current);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    textureRef.current = texture;

    let geometry: THREE.BufferGeometry;

    if (params.meshType === 'sphere') {
      geometry = new THREE.SphereGeometry(1.3, 64, 48);
    } else if (params.meshType === 'cylinder') {
      geometry = new THREE.CylinderGeometry(0.85, 0.85, 2.4, 64, 32);
    } else if (params.meshType === 'torus') {
      geometry = new THREE.TorusGeometry(1.0, 0.45, 32, 64);
    } else {
      const uvs: number[] = [];
      const positions: number[] = [];
      const indices: number[] = [];

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

          const bump = 1.0 + 0.18 * Math.sin(5 * phi) * Math.sin(3 * theta);
          const r = 1.25 * bump;

          positions.push(r * sinTheta * cosPhi, r * cosTheta, r * sinTheta * sinPhi);
          uvs.push(i / radialSegments, j / heightSegments);
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
      geometry.setIndex(indices);
      // The original pushed sphere normals onto a lobed surface, so the bumps
      // were lit as if they were smooth. Let three.js compute them properly.
      geometry.computeVertexNormals();
    }

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.15,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = -0.3;
    mesh.rotation.x = 0.2;
    scene.add(mesh);
    meshRef.current = mesh;

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 600;
      const h = Math.max(380, container.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    updateTextureCanvas();
    texture.needsUpdate = true;

    return () => {
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      meshRef.current = null;
      textureRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.meshType]);

  // ---------------------------------------------------------------------------
  // Animation loop. Mounted once; reads live values from refs.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let animationFrameId = 0;
    let sinceCheck = 0;

    const tick = () => {
      if (playingRef.current) {
        for (let i = 0; i < speedRef.current; i++) runSimulationStep();
        updateTextureCanvas();
        if (textureRef.current) textureRef.current.needsUpdate = true;

        // Evaluating the challenge means a connected-component pass, so run it
        // a few times a second rather than on every frame.
        if (++sinceCheck >= 20) {
          sinceCheck = 0;
          if (challengeRef.current && successRef.current) {
            if (challengeRef.current(gridBRef.current)) successRef.current();
          }
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        if (meshRef.current && !isMouseDownRef.current) {
          meshRef.current.rotation.y += 0.0012;
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Redraw immediately when a display-only setting changes while paused.
  useEffect(() => {
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorTheme, showSubstrate]);

  // ---------------------------------------------------------------------------
  // Pointer input
  // ---------------------------------------------------------------------------
  const paintFromEvent = (clientX: number, clientY: number, rect: DOMRect) => {
    if (!cameraRef.current || !meshRef.current) return;
    mouse3DRef.current.x = (clientX / rect.width) * 2 - 1;
    mouse3DRef.current.y = -(clientY / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouse3DRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(meshRef.current);
    if (intersects.length > 0 && intersects[0].uv) {
      paintAtUV(intersects[0].uv.x, intersects[0].uv.y);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
    // Capture, so dragging off the canvas does not leave the drag stuck on.
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePositionRef.current = { x, y };
    if (interactionMode === 'paint') paintFromEvent(x, y, rect);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const deltaX = x - mousePositionRef.current.x;
    const deltaY = y - mousePositionRef.current.y;
    mousePositionRef.current = { x, y };

    if (interactionMode === 'rotate' && meshRef.current) {
      meshRef.current.rotation.y += deltaX * 0.01;
      meshRef.current.rotation.x += deltaY * 0.01;
    } else if (interactionMode === 'paint') {
      paintFromEvent(x, y, rect);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseDownRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const applyPreset = (key: string) => {
    const preset = TURING_PRESETS[key];
    if (!preset) return;
    onChangeParams({ ...params, feed: preset.feed, kill: preset.kill });
    initGrids(params.resolution);
    updateTextureCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
  };

  return (
    <div className="flex flex-col h-full bg-[#faf9f6]/40 rounded-2xl border border-stone-200/60 overflow-hidden shadow-sm" id="turing-playground">
      <canvas ref={canvas2dRef} width={params.resolution} height={params.resolution} className="hidden" id="hidden-rd-canvas" />

      <div className="relative flex-1 bg-stone-50 overflow-hidden cursor-crosshair min-h-[340px]">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full touch-none"
          id="webgl-canvas-container"
        />

        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-stone-100 px-3 py-1.5 rounded-full text-xs font-medium text-stone-600 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span>
              {interactionMode === 'paint'
                ? 'Paint mode: click and drag on the body'
                : 'Rotate mode: drag to orbit'}
            </span>
          </div>
          {!showStats.alive && (
            <div className="bg-amber-50/95 border border-amber-300 px-3 py-1.5 rounded-xl text-[11px] text-amber-900 shadow-sm max-w-[240px]">
              Activator has died out. Lower <strong>k</strong>, raise <strong>f</strong>, or paint a
              fresh blob &mdash; Gray-Scott needs a seed above threshold to restart.
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={() => setInteractionMode(interactionMode === 'paint' ? 'rotate' : 'paint')}
            className={`p-2.5 rounded-xl border shadow-sm transition-all flex items-center justify-center ${
              interactionMode === 'paint'
                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
            }`}
            title={interactionMode === 'paint' ? 'Switch to rotate mode' : 'Switch to paint mode'}
            id="toggle-interaction-btn"
          >
            {interactionMode === 'paint' ? <Paintbrush className="w-5 h-5" /> : <Move className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-2.5 rounded-xl border shadow-sm transition-all bg-white hover:bg-stone-100 border-stone-200 ${
              isPlaying ? 'text-stone-700' : 'text-emerald-500 bg-emerald-50/50'
            }`}
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            id="play-pause-sim-btn"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button
            onClick={handleRandomSeed}
            className="p-2.5 rounded-xl border bg-white hover:bg-stone-100 border-stone-200 text-stone-700 shadow-sm transition-all"
            title="Random chemical shock"
            id="random-shock-btn"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button
            onClick={handleWipe}
            className="p-2.5 rounded-xl border bg-white hover:bg-rose-50 border-stone-200 text-rose-500 shadow-sm transition-all"
            title="Clear all activator"
            id="wipe-sim-btn"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md border border-stone-200/60 p-2.5 sm:p-3 rounded-2xl text-[11px] font-mono text-stone-600 shadow-lg flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 font-sans font-bold">Field stats</div>
          <div>Pattern contrast: <span className="text-stone-800 font-semibold">{showStats.variance.toFixed(1)}</span></div>
          <div>Activator coverage: <span className="text-stone-800 font-semibold">{(showStats.coverage * 100).toFixed(1)}%</span></div>
          <button
            onClick={() => setShowSubstrate(!showSubstrate)}
            className={`mt-1 px-2 py-1 rounded-lg border text-[10px] font-sans font-bold transition-all ${
              showSubstrate
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
            id="toggle-substrate-btn"
          >
            {showSubstrate ? 'Showing substrate A' : 'Showing activator B'}
          </button>
        </div>

        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md border border-stone-200/50 px-2.5 py-1.5 rounded-full flex gap-1.5 shadow-sm text-xs items-center">
          <span className="text-[10px] text-stone-400 font-sans mr-1 font-semibold uppercase">Palette</span>
          {([
            ['coral', 'bg-red-400', 'Coral'],
            ['bioluminescence', 'bg-cyan-400', 'Bioluminescence'],
            ['sunset', 'bg-amber-400', 'Sunset'],
            ['emerald', 'bg-emerald-400', 'Emerald'],
          ] as const).map(([key, cls, label]) => (
            <button
              key={key}
              onClick={() => setColorTheme(key)}
              aria-label={`${label} palette`}
              className={`w-4 h-4 rounded-full ${cls} border transition-all ${
                colorTheme === key ? 'ring-2 ring-stone-900 border-white scale-110' : 'border-stone-300'
              }`}
              title={label}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 border-t border-stone-200/60 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-stone-500" />
              <span>Body geometry</span>
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
                  {mesh}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 italic">
              The grid wraps at all four edges, so the chemistry runs on a torus. Only the torus mesh
              matches that topology; the others show a seam and polar distortion.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Grid2X2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Verified pattern presets</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.keys(TURING_PRESETS).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all truncate text-left ${
                    Math.abs(params.feed - TURING_PRESETS[key].feed) < 0.0005 &&
                    Math.abs(params.kill - TURING_PRESETS[key].kill) < 0.0005
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  title={TURING_PRESETS[key].description}
                  id={`preset-select-${key}`}
                >
                  {TURING_PRESETS[key].name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-stone-100">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label htmlFor="slider-feed-rate" className="text-xs font-medium text-stone-500">
                Feed rate (<span className="font-mono text-stone-700 font-bold">f</span>)
              </label>
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
            <p className="text-[10px] text-stone-400 italic">
              How fast substrate A is replenished from the reservoir.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label htmlFor="slider-kill-rate" className="text-xs font-medium text-stone-500">
                Kill rate (<span className="font-mono text-stone-700 font-bold">k</span>)
              </label>
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
            <p className="text-[10px] text-stone-400 italic">
              Sets removal of activator B. Total loss is <span className="font-mono">f + k</span>, so
              the two dials are coupled.
            </p>
          </div>
        </div>

        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/50 flex gap-2 items-start text-xs text-stone-600">
          <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-stone-800">Two ways to get a blank screen</span>
            <span>
              <strong>Extinction:</strong> if <span className="font-mono bg-stone-100 px-0.5">k</span> is
              too high for the current <span className="font-mono bg-stone-100 px-0.5">f</span>, B is
              removed faster than autocatalysis can replace it and the surface returns to pure A.{' '}
              <strong>Saturation:</strong> if <span className="font-mono bg-stone-100 px-0.5">f</span> is
              high and <span className="font-mono bg-stone-100 px-0.5">k</span> low, B floods
              everything. Patterns live in the narrow band between the two.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-stone-500">Brush radius</span>
            <span className="font-mono text-xs text-stone-700">{params.brushSize} cells</span>
          </div>
          <div className="flex gap-2 flex-wrap">
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
                {size}
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              {(['addB', 'addA', 'noise'] as const).map((bType) => (
                <button
                  key={bType}
                  onClick={() => onChangeParams({ ...params, brushType: bType })}
                  className={`py-1 px-2 text-xs rounded-lg border transition-all ${
                    params.brushType === bType
                      ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  id={`brush-type-${bType}`}
                >
                  {/* FIXED: addA used to be labelled "+ Inhibitor". A is the substrate. */}
                  {bType === 'addB' ? '+ Activator B' : bType === 'addA' ? '+ Substrate A' : 'Noise'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-1">
            <label htmlFor="slider-sim-speed" className="text-xs font-medium text-stone-500">
              Simulation speed
            </label>
            <span className="font-mono text-xs text-stone-700">{simSpeed} steps/frame</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={simSpeed}
            onChange={(e) => setSimSpeed(parseInt(e.target.value))}
            className="w-full accent-stone-700 h-1 bg-stone-100 rounded-lg cursor-pointer"
            id="slider-sim-speed"
          />
        </div>
      </div>
    </div>
  );
}
