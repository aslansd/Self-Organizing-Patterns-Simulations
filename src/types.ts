/**
 * Types & Configuration for Web Simulation of Self-Organized Patterns
 *
 * NOMENCLATURE NOTE (important, and previously inconsistent across the app):
 * This simulation implements the GRAY-SCOTT model, which is a
 * *substrate-depletion* reaction-diffusion system:
 *
 *      A + 2B -> 3B          (B is autocatalytic: it consumes A to make more B)
 *      B      -> P           (B is removed at rate f + k)
 *      A is replenished from a reservoir at rate f * (1 - A)
 *
 *   Chemical A = SUBSTRATE / feedstock  (consumed, replenished; diffuses FAST, Da = 1.0)
 *   Chemical B = ACTIVATOR / autocatalyst (self-amplifying; diffuses SLOW, Db = 0.5)
 *
 * A is NOT an "inhibitor produced in response to B". Inhibition here is indirect:
 * a growing patch of B eats the local A, and because A diffuses twice as fast as B,
 * the depleted zone spreads outward and starves neighbouring patches. That is the
 * "local activation, long-range inhibition" principle realised via substrate depletion,
 * rather than via a separately synthesised inhibitor (as in Gierer-Meinhardt 1972).
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
  prompt: string;
  hint: string;
}

export interface Chapter {
  title: string;
  subtitle: string;
  paragraphs: string[];
  challenge?: Challenge;
}

/**
 * Gray-Scott presets.
 *
 * Every (f, k) pair below was verified by running this exact solver
 * (9-point stencil, Da = 1.0, Db = 0.5, dt = 1.0, 128x128 periodic grid,
 * ~15,000 steps) and inspecting the resulting field. The previous values
 * were mislabelled: f=0.035/k=0.062 gives worms rather than spots, and
 * f=0.058/k=0.065 lies close to the extinction boundary and renders a
 * nearly blank surface.
 */
export const TURING_PRESETS: Record<
  string,
  { name: string; feed: number; kill: number; description: string }
> = {
  spots: {
    name: 'Leopard Spots',
    feed: 0.030,
    kill: 0.062,
    description:
      'Isolated peaks of activator B, each surrounded by a "moat" of depleted substrate A that keeps its neighbours at arm\u2019s length. A hexagonal spot lattice.',
  },
  ridges: {
    name: 'Coral Ridges',
    feed: 0.026,
    kill: 0.055,
    description:
      'Spots elongate and fuse into long winding ridges. Note that Gray-Scott ridges are labyrinthine, not parallel \u2014 aligning them into zebra-like bands needs an extra directional cue (see Chapter 4).',
  },
  labyrinth: {
    name: 'Brain Coral',
    feed: 0.0545,
    kill: 0.062,
    description:
      'Tight, evenly-spaced folds packing the surface. The same class of pattern seen on brain-coral skeletons and on the roof of a mouth.',
  },
  mitosis: {
    name: 'Dividing Cells',
    feed: 0.0367,
    kill: 0.0649,
    description:
      'Spots that grow until substrate starvation splits them down the middle, then repeat \u2014 a visual analogy for binary fission (not an actual model of cell division).',
  },
  chaos: {
    name: 'Dynamic Waves',
    feed: 0.034,
    kill: 0.056,
    description:
      'Ridges and holes that keep re-arranging and never reach a steady state \u2014 a dissipative structure sustained only by continuous feed and removal.',
  },
};

/**
 * L-system presets.
 *
 * Attribution: the turtle-graphics interpretation of L-systems and the
 * "fractal plant" / bush grammars below are from Prusinkiewicz &
 * Lindenmayer, *The Algorithmic Beauty of Plants* (1990). Lindenmayer's
 * original 1968 systems described filamentous algae, not branching plants.
 */
export const LSYSTEM_PRESETS: Record<
  string,
  {
    name: string;
    axiom: string;
    rules: { from: string; to: string }[];
    angle: number;
    depth: number;
    description: string;
  }
> = {
  plant: {
    name: 'Fractal Plant',
    axiom: 'X',
    rules: [
      { from: 'X', to: 'F+[[X]-X]-F[-FX]+X' },
      { from: 'F', to: 'FF' },
    ],
    angle: 25,
    depth: 4,
    description:
      'The classic fern-like "fractal plant" from The Algorithmic Beauty of Plants. Two rules, applied in parallel, produce lush self-similar geometry.',
  },
  tree: {
    name: 'Symmetric Bush',
    axiom: 'F',
    rules: [{ from: 'F', to: 'FF-[-F+F+F]+[+F-F-F]' }],
    angle: 22,
    depth: 4,
    description:
      'Every segment splits into a mirror-symmetric pair of three-part sprays, giving a dense, evenly balanced bush.',
  },
  snowflake: {
    name: 'Koch Snowflake',
    axiom: 'F++F++F',
    rules: [{ from: 'F', to: 'F-F++F-F' }],
    angle: 60,
    depth: 3,
    description:
      'A purely geometric fractal (dimension log4/log3 \u2248 1.26): finite area, unbounded perimeter. A mathematical curiosity rather than a model of real snow crystals.',
  },
  coral: {
    name: 'Gnarled Sea Coral',
    axiom: 'X',
    rules: [
      { from: 'X', to: 'F-[[X]+X]+F[+FX]-X' },
      { from: 'F', to: 'FF' },
    ],
    angle: 30,
    depth: 4,
    description:
      'A mirrored version of the fractal plant. Branching corals lay down calcium-carbonate skeletons in comparable shapes to maximise surface area for feeding.',
  },
};
