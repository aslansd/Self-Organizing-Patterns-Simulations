import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RefreshCw, Layers, Grid, Sliders, HelpCircle, TreePine } from 'lucide-react';
import { LSYSTEM_PRESETS, LSystemParameters } from '../types';

interface LSystemSim3DProps {
  params: LSystemParameters;
  onChangeParams: (p: LSystemParameters) => void;
  onChallengeSuccess?: () => void;
  challengeCheck?: (rules: { from: string; to: string }[], angle: number) => boolean;
}

const MAX_STRING = 60000;

export default function LSystemSim3D({
  params,
  onChangeParams,
  onChallengeSuccess,
  challengeCheck,
}: LSystemSim3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  // Branch meshes in draw order, so the growth slider can reveal them by
  // toggling visibility instead of rebuilding every geometry each frame.
  const branchMeshesRef = useRef<THREE.Mesh[]>([]);
  const bloomMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneReady = useRef(false);

  const [growthPercent, setGrowthPercent] = useState<number>(100);
  const [isGrowing, setIsGrowing] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>('plant');
  const [segmentCount, setSegmentCount] = useState<number>(0);

  const growthRef = useRef(growthPercent);
  const growingRef = useRef(isGrowing);
  const isMouseDownRef = useRef<boolean>(false);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    growthRef.current = growthPercent;
    growingRef.current = isGrowing;
  });

  // ---------------------------------------------------------------------------
  // Parallel rewriting. Every symbol is replaced simultaneously each
  // generation - that simultaneity is what makes this an L-system rather
  // than an ordinary grammar.
  // ---------------------------------------------------------------------------
  const expandLSystem = (axiom: string, rules: { from: string; to: string }[], depth: number): string => {
    let current = axiom;
    const ruleMap = new Map(rules.map((r) => [r.from, r.to]));

    for (let d = 0; d < depth; d++) {
      let expanded = '';
      for (let i = 0; i < current.length; i++) {
        const char = current[i];
        expanded += ruleMap.has(char) ? ruleMap.get(char) : char;
      }
      current = expanded;
      if (current.length > MAX_STRING) {
        // Truncate at a point where the bracket stack is balanced, so the
        // turtle does not end up stranded inside an unclosed branch.
        let depthCount = 0;
        let cut = 0;
        for (let i = 0; i < MAX_STRING; i++) {
          if (current[i] === '[') depthCount++;
          else if (current[i] === ']') depthCount--;
          if (depthCount === 0) cut = i + 1;
        }
        current = current.slice(0, cut || MAX_STRING);
        break;
      }
    }
    return current;
  };

  const disposeChildren = () => {
    const group = groupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }
    branchMeshesRef.current = [];
    bloomMeshesRef.current = [];
  };

  // ---------------------------------------------------------------------------
  // Turtle interpretation
  // ---------------------------------------------------------------------------
  const buildTreeGeometry = () => {
    const group = groupRef.current;
    if (!sceneRef.current || !group) return;

    disposeChildren();

    const expanded = expandLSystem(params.axiom, params.rules, params.depth);
    const angleRad = (params.angle * Math.PI) / 180;

    interface TurtleState {
      position: THREE.Vector3;
      direction: THREE.Vector3;
      up: THREE.Vector3;
      right: THREE.Vector3;
      width: number;
      length: number;
    }

    const stack: TurtleState[] = [];

    let state: TurtleState = {
      position: new THREE.Vector3(0, -1.5, 0),
      direction: new THREE.Vector3(0, 1, 0),
      up: new THREE.Vector3(0, 0, 1),
      right: new THREE.Vector3(1, 0, 0),
      width: params.width,
      length: params.length,
    };

    interface BranchSegment {
      start: THREE.Vector3;
      end: THREE.Vector3;
      width: number;
      endWidth: number;
      color: string;
    }

    const segments: BranchSegment[] = [];

    for (let i = 0; i < expanded.length; i++) {
      const char = expanded[i];

      switch (char) {
        case 'F':
        case 'G': {
          const prevPosition = state.position.clone();
          const newPosition = prevPosition
            .clone()
            .add(state.direction.clone().multiplyScalar(state.length));

          const depthFraction = state.width / params.width; // 1 at trunk, ->0 at tips
          let segmentColor = '#3f6212';
          if (params.colorTheme === 'coral') {
            segmentColor = depthFraction > 0.5 ? '#f87171' : '#fca5a5';
          } else if (params.colorTheme === 'forest') {
            segmentColor = depthFraction > 0.5 ? '#854d0e' : '#22c55e';
          } else if (params.colorTheme === 'glowing') {
            segmentColor = depthFraction > 0.5 ? '#6366f1' : '#a855f7';
          } else if (params.colorTheme === 'autumn') {
            segmentColor = depthFraction > 0.5 ? '#a16207' : '#ea580c';
          }

          segments.push({
            start: prevPosition,
            end: newPosition,
            width: state.width,
            endWidth: state.width * 0.92,
            color: segmentColor,
          });

          state.position = newPosition;
          break;
        }
        case 'f':
        case 'g':
          state.position.add(state.direction.clone().multiplyScalar(state.length));
          break;
        case '+': {
          const q = new THREE.Quaternion().setFromAxisAngle(state.up, -angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '-': {
          const q = new THREE.Quaternion().setFromAxisAngle(state.up, angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '&': {
          const q = new THREE.Quaternion().setFromAxisAngle(state.right, angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.up.applyQuaternion(q).normalize();
          break;
        }
        case '^': {
          const q = new THREE.Quaternion().setFromAxisAngle(state.right, -angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.up.applyQuaternion(q).normalize();
          break;
        }
        case '\\': {
          const q = new THREE.Quaternion().setFromAxisAngle(state.direction, angleRad);
          state.up.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '/': {
          const q = new THREE.Quaternion().setFromAxisAngle(state.direction, -angleRad);
          state.up.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '[': {
          // FIXED: taper on ENTERING a branch, and restore exactly on exit.
          //
          // The original applied width *= widthDecay and length *= lengthDecay
          // AFTER popping. Because pops accumulate along the string, decay
          // compounded with the running count of ']' rather than with nesting
          // depth. For the Symmetric Bush preset that drove 3,652 of 4,096
          // segments below the 0.001 render cutoff - roughly 89% of the plant
          // was invisible.
          stack.push({
            position: state.position.clone(),
            direction: state.direction.clone(),
            up: state.up.clone(),
            right: state.right.clone(),
            width: state.width,
            length: state.length,
          });
          state.width *= params.widthDecay;
          state.length *= params.lengthDecay;
          break;
        }
        case ']': {
          const popped = stack.pop();
          if (popped) state = popped;
          break;
        }
      }
    }

    setSegmentCount(segments.length);

    // Build every segment once. Growth is handled by visibility below.
    const materialCache = new Map<string, THREE.Material>();

    segments.forEach((seg) => {
      const height = seg.start.distanceTo(seg.end);
      if (height < 0.0005) return;

      const geom = new THREE.CylinderGeometry(seg.endWidth, seg.width, height, 6);
      geom.translate(0, height / 2, 0);

      let mat = materialCache.get(seg.color);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(seg.color),
          roughness: 0.8,
          metalness: 0.1,
        });
        materialCache.set(seg.color, mat);
      }

      const branchMesh = new THREE.Mesh(geom, mat);
      branchMesh.position.copy(seg.start);
      const targetVec = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
      branchMesh.setRotationFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetVec),
      );

      group.add(branchMesh);
      branchMeshesRef.current.push(branchMesh);
    });

    // Blooms on the final 15% of segments.
    const bloomColor =
      params.colorTheme === 'coral'
        ? '#f43f5e'
        : params.colorTheme === 'autumn'
        ? '#facc15'
        : params.colorTheme === 'glowing'
        ? '#f472b6'
        : '#86efac';

    const flowerGeom = new THREE.SphereGeometry(0.06, 6, 6);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bloomColor),
      emissive: new THREE.Color(bloomColor).multiplyScalar(0.2),
      roughness: 0.5,
    });

    segments.slice(Math.floor(segments.length * 0.85)).forEach((seg) => {
      const flowerMesh = new THREE.Mesh(flowerGeom, flowerMat);
      flowerMesh.position.copy(seg.end);
      group.add(flowerMesh);
      bloomMeshesRef.current.push(flowerMesh);
    });

    applyGrowthVisibility(growthRef.current);
  };

  const applyGrowthVisibility = (pct: number) => {
    const meshes = branchMeshesRef.current;
    const visibleCount = Math.floor((meshes.length * pct) / 100);
    for (let i = 0; i < meshes.length; i++) meshes[i].visible = i < visibleCount;
    const bloomsOn = pct > 80;
    for (const m of bloomMeshesRef.current) m.visible = bloomsOn;
  };

  // ---------------------------------------------------------------------------
  // Scene: created ONCE.
  //
  // The original had [isGrowing, params, chapterMode] as dependencies, so every
  // slider tick destroyed and rebuilt the WebGLRenderer - and never called
  // renderer.dispose(). Dragging the angle slider could allocate 30+ contexts
  // in a second and trip the browser's ~16-context limit.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = Math.max(380, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#faf9f6');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const pointLight = new THREE.PointLight(0xfff5e6, 40, 50);
    pointLight.position.set(2, 4, 3);
    scene.add(pointLight);
    const backLight = new THREE.DirectionalLight(0xdbeafe, 0.4);
    backLight.position.set(-3, -2, -2);
    scene.add(backLight);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    sceneReady.current = true;

    // FIXED: build the plant now. Previously the build effect was declared
    // before this one, so on first mount it ran while groupRef was still null,
    // returned early, and the viewport stayed empty until a control was touched.
    buildTreeGeometry();

    let animId = 0;
    const autoGrowthSpeed = 1.2;

    const tick = () => {
      if (groupRef.current && !isMouseDownRef.current) {
        groupRef.current.rotation.y += 0.0018;
      }

      if (growingRef.current) {
        const next = Math.min(100, growthRef.current + autoGrowthSpeed);
        growthRef.current = next;
        applyGrowthVisibility(next); // cheap: visibility only, no rebuild
        if (next >= 100) {
          growingRef.current = false;
          setIsGrowing(false);
        }
        setGrowthPercent(next);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animId = requestAnimationFrame(tick);
    };
    tick();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 600;
      const h = Math.max(380, container.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      disposeChildren();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneReady.current = false;
      rendererRef.current = null;
      groupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild geometry only when the grammar actually changes - not on every
  // frame of the growth animation.
  useEffect(() => {
    if (sceneReady.current) buildTreeGeometry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.axiom,
    params.depth,
    params.angle,
    params.colorTheme,
    params.width,
    params.length,
    params.widthDecay,
    params.lengthDecay,
    JSON.stringify(params.rules),
  ]);

  // Manual slider drags only need a visibility pass.
  useEffect(() => {
    applyGrowthVisibility(growthPercent);
  }, [growthPercent]);

  // Challenge evaluation. The original ran this inside the scene-setup effect,
  // so it only fired when the renderer happened to be rebuilt.
  useEffect(() => {
    if (challengeCheck && onChallengeSuccess && challengeCheck(params.rules, params.angle)) {
      onChallengeSuccess();
    }
  }, [params.rules, params.angle, challengeCheck, onChallengeSuccess]);

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !groupRef.current) return;
    const deltaX = e.clientX - mousePositionRef.current.x;
    const deltaY = e.clientY - mousePositionRef.current.y;
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    groupRef.current.rotation.y += deltaX * 0.008;
    groupRef.current.rotation.x += deltaY * 0.008;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseDownRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const applyPreset = (key: string) => {
    const preset = LSYSTEM_PRESETS[key];
    if (!preset) return;
    setActivePreset(key);
    onChangeParams({
      ...params,
      axiom: preset.axiom,
      rules: preset.rules,
      angle: preset.angle,
      depth: preset.depth,
    });
    setGrowthPercent(0);
    growthRef.current = 0;
    setIsGrowing(true);
  };

  // FIXED: edit params.rules directly. The original kept a `customRules` copy
  // in local state that was never re-synced when the parent changed the rules,
  // so after an auto-calibrate the editor displayed stale grammar.
  const handleRuleChange = (idx: number, toVal: string) => {
    const updated = params.rules.map((r, i) => (i === idx ? { ...r, to: toVal } : r));
    setActivePreset('');
    onChangeParams({ ...params, rules: updated });
  };

  const startGrowthCycle = () => {
    setGrowthPercent(0);
    growthRef.current = 0;
    setIsGrowing(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#faf9f6]/40 rounded-2xl border border-stone-200/60 overflow-hidden shadow-sm" id="lsystem-playground">
      <div className="relative flex-1 bg-stone-50 overflow-hidden cursor-grab active:cursor-grabbing min-h-[340px]">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full touch-none"
          id="lsystem-canvas"
        />

        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md border border-stone-100 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-600 shadow-sm flex items-center gap-2">
            <TreePine className="w-3.5 h-3.5 text-emerald-600" />
            <span>Drag to rotate &bull; {segmentCount.toLocaleString()} segments</span>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={startGrowthCycle}
            className="p-2.5 rounded-xl border bg-white hover:bg-emerald-50 hover:border-emerald-200 text-emerald-600 shadow-sm transition-all font-semibold flex items-center gap-1.5 text-xs"
            title="Replay growth from the seed"
            id="sprout-btn"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sprout seed</span>
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-stone-200/60 p-3 rounded-2xl shadow-lg flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-medium">
            <label
              htmlFor="slider-growth-timeline"
              className="text-stone-500 font-sans uppercase tracking-wider text-[10px] font-bold"
            >
              {/* FIXED typo: "Developement" */}
              Development progression
            </label>
            <span className="text-emerald-700 font-mono font-semibold">
              {growthPercent.toFixed(0)}% drawn
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={growthPercent}
            onChange={(e) => {
              setIsGrowing(false);
              const v = parseInt(e.target.value);
              growthRef.current = v;
              setGrowthPercent(v);
            }}
            className="w-full h-1 bg-stone-100 rounded-lg cursor-pointer accent-emerald-600"
            id="slider-growth-timeline"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 border-t border-stone-200/60 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Grid className="w-3.5 h-3.5 text-stone-500" />
              <span>Grammar presets</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(LSYSTEM_PRESETS).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border text-left truncate transition-all ${
                    activePreset === key
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  title={LSYSTEM_PRESETS[key].description}
                  id={`preset-lsystem-${key}`}
                >
                  {LSYSTEM_PRESETS[key].name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-stone-500" />
              <span>Colour palette</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['forest', 'coral', 'glowing', 'autumn'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => onChangeParams({ ...params, colorTheme: theme })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border capitalize transition-all ${
                    params.colorTheme === theme
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                  id={`theme-lsystem-${theme}`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
          <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            <span>Production rules</span>
          </span>

          <div className="flex gap-4 items-center">
            <label htmlFor="input-lsystem-axiom" className="text-xs text-stone-500 font-mono">
              Axiom (seed):
            </label>
            <input
              type="text"
              value={params.axiom}
              /* FIXED: the original forced .toUpperCase(), which made the
                 lowercase 'f' and 'g' move-without-drawing commands unusable. */
              onChange={(e) => onChangeParams({ ...params, axiom: e.target.value })}
              className="px-2.5 py-1 text-xs font-mono rounded border border-stone-200 focus:outline-emerald-500 w-32 bg-stone-50"
              placeholder="e.g. F"
              id="input-lsystem-axiom"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {params.rules.map((r, i) => (
              <div key={i} className="flex gap-2 items-center text-xs font-mono">
                <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-bold">{r.from}</span>
                <span className="text-stone-400">&rarr;</span>
                <input
                  type="text"
                  value={r.to}
                  onChange={(e) => handleRuleChange(i, e.target.value)}
                  aria-label={`Production for ${r.from}`}
                  className="px-2.5 py-1 text-xs rounded border border-stone-200 focus:outline-emerald-500 flex-1 bg-stone-50"
                  id={`input-lsystem-rule-${i}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="slider-lsystem-angle" className="font-medium text-stone-500">
                Branch angle
              </label>
              <span className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded font-semibold">
                {params.angle}&deg;
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              value={params.angle}
              onChange={(e) => onChangeParams({ ...params, angle: parseInt(e.target.value) })}
              className="w-full h-1 accent-emerald-600 bg-stone-100 rounded-lg cursor-pointer"
              id="slider-lsystem-angle"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="slider-lsystem-depth" className="font-medium text-stone-500">
                Generations
              </label>
              <span className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded font-semibold">
                {params.depth}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              value={params.depth}
              onChange={(e) => onChangeParams({ ...params, depth: parseInt(e.target.value) })}
              className="w-full h-1 accent-emerald-600 bg-stone-100 rounded-lg cursor-pointer"
              id="slider-lsystem-depth"
            />
            <p className="text-[9px] text-stone-400 leading-normal">
              Each generation rewrites every symbol at once, so segment count grows exponentially.
            </p>
          </div>
        </div>

        <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/50 flex gap-2 items-start text-xs text-stone-600">
          <HelpCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-stone-800 font-sans">Turtle alphabet</span>
            <span className="leading-relaxed">
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">F</span> draw forward,{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">f</span> move without
              drawing. <span className="font-mono bg-stone-100 px-0.5 text-stone-800">+</span> /{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">-</span> turn,{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">^</span> /{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">&amp;</span> pitch,{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">\</span> /{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">/</span> roll (these
              three make it genuinely 3D).{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">[</span> /{' '}
              <span className="font-mono bg-stone-100 px-0.5 text-stone-800">]</span> push and pop a
              side branch. Any other letter is a silent placeholder that only exists to be rewritten.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
