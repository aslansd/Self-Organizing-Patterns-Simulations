import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Play, Pause, ChevronRight, RefreshCw, Layers, Grid, Sliders, CheckCircle, HelpCircle, TreePine } from 'lucide-react';
import { LSYSTEM_PRESETS, LSystemParameters } from '../types';

interface LSystemSim3DProps {
  params: LSystemParameters;
  onChangeParams: (p: LSystemParameters) => void;
  chapterMode?: boolean;
  onChallengeSuccess?: () => void;
  challengeCheck?: (rules: { from: string; to: string }[], angle: number) => boolean;
}

export default function LSystemSim3D({
  params,
  onChangeParams,
  chapterMode = false,
  onChallengeSuccess,
  challengeCheck,
}: LSystemSim3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  // Growth-time timeline sliders
  const [growthPercent, setGrowthPercent] = useState<number>(100);
  const [isGrowing, setIsGrowing] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>('plant');
  const [customRules, setCustomRules] = useState<{ from: string; to: string }[]>(params.rules);

  // Re-seed orbit rotation variables
  const isMouseDownRef = useRef<boolean>(false);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Generate expanded LSystem string from grammar
  const expandLSystem = (axiom: string, rules: { from: string; to: string }[], depth: number): string => {
    let current = axiom;
    const ruleMap = new Map(rules.map((r) => [r.from, r.to]));

    for (let d = 0; d < depth; d++) {
      let expanded = '';
      for (let i = 0; i < current.length; i++) {
        const char = current[i];
        if (ruleMap.has(char)) {
          expanded += ruleMap.get(char);
        } else {
          expanded += char;
        }
      }
      current = expanded;
      // Safeguard against infinite growth or exponential explosions
      if (current.length > 35000) {
        current = current.slice(0, 35000);
        break;
      }
    }
    return current;
  };

  // Build 3D branches from the expanded L-Systems commands
  const buildTreeGeometry = () => {
    if (!sceneRef.current || !groupRef.current) return;

    // Clear old branches
    const group = groupRef.current;
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    const expanded = expandLSystem(params.axiom, params.rules, params.depth);
    const angleRad = (params.angle * Math.PI) / 180;

    // Turtle stack definitions
    interface TurtleState {
      position: THREE.Vector3;
      direction: THREE.Vector3;
      up: THREE.Vector3;
      right: THREE.Vector3;
      width: number;
      length: number;
    }

    const stack: TurtleState[] = [];

    // Initial state
    let state: TurtleState = {
      position: new THREE.Vector3(0, -1.5, 0),
      direction: new THREE.Vector3(0, 1, 0), // Pointing upwards
      up: new THREE.Vector3(0, 0, 1),
      right: new THREE.Vector3(1, 0, 0),
      width: params.width,
      length: params.length,
    };

    // Keep track of the nodes/cylinders to support growth fraction animations
    interface BranchSegment {
      start: THREE.Vector3;
      end: THREE.Vector3;
      width: number;
      color: string;
      order: number; // Order index from trunk to flowers
    }

    const segments: BranchSegment[] = [];
    let stateHistoryIndex = 0;

    for (let i = 0; i < expanded.length; i++) {
      const char = expanded[i];

      switch (char) {
        case 'F':
        case 'G': {
          // Move forward and draw cylinder
          const prevPosition = state.position.clone();
          const targetOffset = state.direction.clone().multiplyScalar(state.length);
          const newPosition = prevPosition.clone().add(targetOffset);

          // Categorize branch types for natural coloring
          let segmentColor = '#3f6212'; // Grass green default
          if (params.colorTheme === 'coral') {
            segmentColor = state.width > params.width * 0.4 ? '#f87171' : '#fca5a5';
          } else if (params.colorTheme === 'forest') {
            segmentColor = state.width > params.width * 0.35 ? '#854d0e' : '#22c55e';
          } else if (params.colorTheme === 'glowing') {
            segmentColor = state.width > params.width * 0.4 ? '#6366f1' : '#a855f7';
          } else if (params.colorTheme === 'autumn') {
            segmentColor = state.width > params.width * 0.45 ? '#a16207' : '#ea580c';
          }

          segments.push({
            start: prevPosition,
            end: newPosition,
            width: state.width,
            color: segmentColor,
            order: stateHistoryIndex++,
          });

          state.position = newPosition;
          break;
        }
        case 'f':
        case 'g': {
          // Move forward without drawing
          state.position.add(state.direction.clone().multiplyScalar(state.length));
          break;
        }
        case '+': {
          // Turn right around 'up' vector
          const q = new THREE.Quaternion().setFromAxisAngle(state.up, -angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '-': {
          // Turn left around 'up' vector
          const q = new THREE.Quaternion().setFromAxisAngle(state.up, angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '&': {
          // Pitch down around 'right' vector
          const q = new THREE.Quaternion().setFromAxisAngle(state.right, angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.up.applyQuaternion(q).normalize();
          break;
        }
        case '^': {
          // Pitch up around 'right' vector
          const q = new THREE.Quaternion().setFromAxisAngle(state.right, -angleRad);
          state.direction.applyQuaternion(q).normalize();
          state.up.applyQuaternion(q).normalize();
          break;
        }
        case '\\': {
          // Roll right around 'direction' vector
          const q = new THREE.Quaternion().setFromAxisAngle(state.direction, angleRad);
          state.up.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '/': {
          // Roll left around 'direction' vector
          const q = new THREE.Quaternion().setFromAxisAngle(state.direction, -angleRad);
          state.up.applyQuaternion(q).normalize();
          state.right.applyQuaternion(q).normalize();
          break;
        }
        case '[': {
          // Push State
          stack.push({
            position: state.position.clone(),
            direction: state.direction.clone(),
            up: state.up.clone(),
            right: state.right.clone(),
            width: state.width,
            length: state.length,
          });
          break;
        }
        case ']': {
          // Pop State
          const popped = stack.pop();
          if (popped) {
            state = popped;
            // Introduce a natural branch thinning and shortening on forks
            state.width *= params.widthDecay;
            state.length *= params.lengthDecay;
          }
          break;
        }
      }
    }

    // Limit active segments rendered based on the dynamic timeline slider
    const totalSelectedSegments = Math.floor((segments.length * growthPercent) / 100);
    const renderableSegments = segments.slice(0, totalSelectedSegments);

    // Render Cylinders
    const materialCache = new Map<string, THREE.Material>();

    renderableSegments.forEach((seg) => {
      const height = seg.start.distanceTo(seg.end);
      if (height < 0.001) return;

      const radialSegments = 6;
      const geom = new THREE.CylinderGeometry(
        seg.width * params.widthDecay, // top radius
        seg.width, // bottom radius
        height,
        radialSegments
      );

      // Rotate and offset cylinder correctly between endpoints
      geom.translate(0, height / 2, 0);

      let mat = materialCache.get(seg.color);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(seg.color),
          roughness: 0.8,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        materialCache.set(seg.color, mat);
      }

      const branchMesh = new THREE.Mesh(geom, mat);
      branchMesh.position.copy(seg.start);

      // Calculate vector offset quaternion to align the cylinder with direction flow
      const upVec = new THREE.Vector3(0, 1, 0);
      const targetVec = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(upVec, targetVec);
      branchMesh.setRotationFromQuaternion(quat);

      group.add(branchMesh);
    });

    // Make an aesthetic leaf/flower node at terminal ends for the top 15% nodes
    const terminalCutoff = Math.floor(segments.length * 0.85);
    const bloomColor = params.colorTheme === 'coral' ? '#f43f5e' : params.colorTheme === 'autumn' ? '#facc15' : params.colorTheme === 'glowing' ? '#f472b6' : '#86efac';

    if (growthPercent > 80) {
      const flowerGeom = new THREE.SphereGeometry(0.06, 6, 6);
      const flowerMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bloomColor),
        emissive: new THREE.Color(bloomColor).multiplyScalar(0.2),
        roughness: 0.5,
      });

      segments.slice(terminalCutoff, segments.length).forEach((seg) => {
        const flowerMesh = new THREE.Mesh(flowerGeom, flowerMat);
        flowerMesh.position.copy(seg.end);
        group.add(flowerMesh);
      });
    }
  };

  // Re-build 3D branch set when parameters or growth steps change
  useEffect(() => {
    buildTreeGeometry();
  }, [params, growthPercent, params.colorTheme]);

  // Initial Scene loading for L-Systems
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = Math.max(380, containerRef.current.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#faf9f6'); // Off-white clean easel
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xfff5e6, 0.9, 50);
    pointLight.position.set(2, 4, 3);
    scene.add(pointLight);

    const backProjLight = new THREE.DirectionalLight(0xdbeafe, 0.4);
    backProjLight.position.set(-3, -2, -2);
    scene.add(backProjLight);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Animation runner loop for rotators and growth cycles
    let animId: number;
    let autoGrowthSpeed = 1.2;

    const tick = () => {
      if (groupRef.current && !isMouseDownRef.current) {
        groupRef.current.rotation.y += 0.0018; // Slowly rotate the tree
      }

      if (isGrowing) {
        setGrowthPercent((prev) => {
          if (prev >= 100) {
            setIsGrowing(false);
            return 100;
          }
          return Math.min(100, prev + autoGrowthSpeed);
        });
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animId = requestAnimationFrame(tick);
    };

    tick();

    // Trigger challenge evaluator
    if (chapterMode && challengeCheck && onChallengeSuccess) {
      const isComplete = challengeCheck(params.rules, params.angle);
      if (isComplete) {
        onChallengeSuccess();
      }
    }

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.max(380, containerRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (_) {}
      }
      cancelAnimationFrame(animId);
    };
  }, [isGrowing, params, chapterMode]);

  // Orbit rotation controllers via standard pointer drag
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
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

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  // Preset setter helper
  const applyPreset = (key: string) => {
    const preset = LSYSTEM_PRESETS[key];
    if (preset) {
      setActivePreset(key);
      onChangeParams({
        ...params,
        axiom: preset.axiom,
        rules: preset.rules,
        angle: preset.angle,
        depth: preset.depth,
      });
      setCustomRules(preset.rules);
      setGrowthPercent(0);
      setIsGrowing(true); // Watch it sprout!
    }
  };

  // Modify rule from interactive input fields
  const handleRuleChange = (idx: number, toVal: string) => {
    const updated = [...customRules];
    updated[idx] = { ...updated[idx], to: toVal };
    setCustomRules(updated);
    onChangeParams({
      ...params,
      rules: updated,
    });
  };

  const startGrowthCycle = () => {
    setGrowthPercent(0);
    setIsGrowing(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#faf9f6]/40 rounded-2xl border border-stone-200/60 overflow-hidden shadow-sm md:sticky md:top-4" id="lsystem-playground">
      {/* 3D Canvas Viewport */}
      <div className="relative flex-1 bg-stone-50 overflow-hidden cursor-grab active:cursor-grabbing min-h-[340px]">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full"
          id="lsystem-canvas"
        />

        {/* Action Heads Up Displays */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md border border-stone-100 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-600 shadow-sm flex items-center gap-2">
            <TreePine className="w-3.5 h-3.5 text-emerald-600" />
            <span>Drag to rotate, spin branching angles in 3D</span>
          </div>
        </div>

        {/* Seed trigger overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={startGrowthCycle}
            className="p-2.5 rounded-xl border bg-white hover:bg-emerald-50 hover:border-emerald-200 text-emerald-600 shadow-sm transition-all font-semibold flex items-center gap-1.5 text-xs"
            title="Sprout Seed again"
            id="sprout-btn"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            <span>Sprout Seed 🌿</span>
          </button>
        </div>

        {/* Growth timeline HUD slider */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-stone-200/60 p-3 rounded-2xl shadow-lg flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-stone-500 font-sans uppercase tracking-wider text-[10px] font-bold">Nature Developement Progression</span>
            <span className="text-emerald-700 font-mono font-semibold">{growthPercent.toFixed(0)}% Mature</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={growthPercent}
            onChange={(e) => setGrowthPercent(parseInt(e.target.value))}
            className="w-full h-1 bg-stone-100 rounded-lg cursor-pointer accent-emerald-600"
            id="slider-growth-timeline"
          />
        </div>
      </div>

      {/* Controller Parameters */}
      <div className="bg-white p-4 border-t border-stone-200/60 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Presets selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Grid className="w-3.5 h-3.5 text-stone-500" />
              <span>Plant Taxonomy / Presets</span>
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
                  id={`preset-lsystem-${key}`}
                >
                  🌴 {LSYSTEM_PRESETS[key].name}
                </button>
              ))}
            </div>
          </div>

          {/* Color theme selections */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-stone-500" />
              <span>Somatic / Color palette</span>
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
                  🎨 {theme}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* L-System Grammatical Grammar editor */}
        <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
          <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            <span>Interactive Developmental Rules (DNA Code)</span>
          </span>

          <div className="flex gap-4 items-center">
            <span className="text-xs text-stone-500 font-mono">Axiom (Seed):</span>
            <input
              type="text"
              value={params.axiom}
              onChange={(e) => onChangeParams({ ...params, axiom: e.target.value.toUpperCase() })}
              className="px-2.5 py-1 text-xs font-mono rounded border border-stone-200 focus:outline-emerald-500 w-24 bg-stone-50"
              placeholder="e.g. F"
              id="input-lsystem-axiom"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {customRules.map((r, i) => (
              <div key={i} className="flex gap-2 items-center text-xs font-mono">
                <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-bold">{r.from}</span>
                <span className="text-stone-400">→</span>
                <input
                  type="text"
                  value={r.to}
                  onChange={(e) => handleRuleChange(i, e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border border-stone-200 focus:outline-emerald-500 flex-1 bg-stone-50"
                  id={`input-lsystem-rule-${i}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tuning numbers dials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-stone-500">Bifurcation Branch Angle</span>
              <span className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded font-semibold">{params.angle}°</span>
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
              <span className="font-medium text-stone-500">Recursive Iteration Depth (Age)</span>
              <span className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded font-semibold">Generations: {params.depth}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={params.depth}
              onChange={(e) => onChangeParams({ ...params, depth: parseInt(e.target.value) })}
              className="w-full h-1 accent-emerald-600 bg-stone-100 rounded-lg cursor-pointer"
              id="slider-lsystem-depth"
            />
            <p className="text-[9px] text-stone-400 leading-normal">
              Warning: Each generation exponentially branches the plant complexity!
            </p>
          </div>
        </div>

        {/* Nicky Case style didactic tip text */}
        <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/50 flex gap-2 items-start text-xs text-stone-600">
          <HelpCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-stone-800 font-sans">Organic Instructions:</span>
            <span className="leading-relaxed">
              Use brackets <span className="font-mono bg-stone-100 px-0.5 text-stone-800">[</span> and <span className="font-mono bg-stone-100 px-0.5 text-stone-800">]</span> to establish side-branches! <span className="font-mono bg-stone-100 px-0.5 text-stone-800">+</span> tilts right, while <span className="font-mono bg-stone-100 px-0.5 text-stone-800">-</span> tilts left. Introduce <span className="font-mono bg-stone-100 text-stone-800 px-0.5">^</span> and <span className="font-mono bg-stone-100 text-stone-800 px-0.5">&amp;</span> for rich 3D volumes!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
