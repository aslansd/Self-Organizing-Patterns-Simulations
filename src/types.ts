/**
 * Types & Configuration for Web Simulation of Self-Organized Patterns
 */

export interface TuringParameters {
  feed: number;
  kill: number;
  diffuseA: number;
  diffuseB: number;
  timeStep: number;
  brushSize: number;
  brushType: 'addA' | 'addB' | 'noise';
  resolution: number;
  meshType: 'sphere' | 'cylinder' | 'torus' | 'organism';
}

export interface LSystemParameters {
  axiom: string;
  rules: { from: string; to: string }[];
  angle: number; // in degrees
  depth: number;
  length: number;
  lengthDecay: number;
  width: number;
  widthDecay: number;
  colorTheme: 'forest' | 'coral' | 'glowing' | 'autumn';
}

export interface Challenge {
  id: string;
  prompt: string;
  hint: string;
  successMessage: string;
  checkType: 'turing' | 'lsystem';
  // evaluate returns true if challenge is successfully completed
  evaluate: (state: any) => boolean;
}

export interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  narration: string[];
  systemType: 'turing_intro' | 'turing_3d' | 'lsystem_3d' | 'sandbox';
  challenge?: Challenge;
}

export const TURING_PRESETS: Record<string, { name: string; feed: number; kill: number; description: string }> = {
  spots: {
    name: 'Leopard Spots',
    feed: 0.035,
    kill: 0.062,
    description: 'Isolated droplets of Activator A that push back Inhibitor B, perfect for spotting coats.',
  },
  stripes: {
    name: 'Zebra Stripes',
    feed: 0.0545,
    kill: 0.062,
    description: 'Alternating high-concentration ridges of activation, forming perfect pathways.',
  },
  labyrinth: {
    name: 'Brain Coral',
    feed: 0.058,
    kill: 0.065,
    description: 'Tight, undulating maze-like folds of highly balanced chemical reactions.',
  },
  mitosis: {
    name: 'Dividing Cells',
    feed: 0.028,
    kill: 0.057,
    description: 'Large droplets that grow, pinch, and divide symmetrically, imitating binary fission.',
  },
  chaos: {
    name: 'Dynamic Waves',
    feed: 0.020,
    kill: 0.050,
    description: 'Turbulent, shifting wavefronts that never settle, showing non-equilibrium thermodynamics.',
  },
};

export const LSYSTEM_PRESETS: Record<string, { name: string; axiom: string; rules: { from: string; to: string }[]; angle: number; depth: number; description: string }> = {
  plant: {
    name: 'Classic Fern',
    axiom: 'X',
    rules: [
      { from: 'X', to: 'F+[[X]-X]-F[-FX]+X' },
      { from: 'F', to: 'FF' }
    ],
    angle: 25,
    depth: 4,
    description: 'Aristid Lindenmayer’s iconic self-similar fern. Notice how simple rules produce lush, natural geometry.',
  },
  tree: {
    name: 'Symmetric Tree',
    axiom: 'F',
    rules: [
      { from: 'F', to: 'FF-[-F+F+F]+[+F-F-F]' }
    ],
    angle: 22,
    depth: 4,
    description: 'A mathematical evergreen displaying a striking ratio of split angles and continuous bifurcations.',
  },
  snowflake: {
    name: 'Koch Snowflake Curios',
    axiom: 'F++F++F',
    rules: [
      { from: 'F', to: 'F-F++F-F' }
    ],
    angle: 60,
    depth: 3,
    description: 'Triangular symmetry self-organizing recursively to construct infinite coastlines in finite spaces.',
  },
  coral: {
    name: 'Gnarled Sea Coral',
    axiom: 'X',
    rules: [
      { from: 'X', to: 'F-[[X]+X]+F[+FX]-X' },
      { from: 'F', to: 'FF' }
    ],
    angle: 30,
    depth: 4,
    description: 'A dense, calcium-like branching structure that curls outwards to harvest aquatic nutrients.',
  },
};
