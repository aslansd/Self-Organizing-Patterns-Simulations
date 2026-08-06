import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  RefreshCw,
  Trophy,
  BookOpen,
  Lightbulb,
} from 'lucide-react';
import { TuringParameters, LSystemParameters, Chapter } from '../types';
import TuringSim3D from './TuringSim3D';
import LSystemSim3D from './LSystemSim3D';

interface ChapterGuideProps {
  turingParams: TuringParameters;
  onChangeTuringParams: (p: TuringParameters) => void;
  lsystemParams: LSystemParameters;
  onChangeLsystemParams: (p: LSystemParameters) => void;
}

const TOTAL_CHAPTERS = 7;

export default function ChapterGuide({
  turingParams,
  onChangeTuringParams,
  lsystemParams,
  onChangeLsystemParams,
}: ChapterGuideProps) {
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [completedChapters, setCompletedChapters] = useState<Record<number, boolean>>({});
  // Chapter 7 is a free sandbox: let the reader pick which engine to play with.
  const [sandboxEngine, setSandboxEngine] = useState<'turing' | 'lsystem'>('turing');

  // ---------------------------------------------------------------------------
  // 1D reaction-diffusion toy (Chapters 1 & 2)
  //
  // Chapter 1 shows PURE diffusion (mass spreads out and flattens).
  // Chapter 2 turns the reaction on, so the reader can see the same diffusion
  // step produce the opposite outcome once autocatalysis is present. That
  // contrast is the whole point of Turing's 1952 argument, and the original
  // version of this app asserted it in prose without ever demonstrating it.
  // ---------------------------------------------------------------------------
  const INITIAL_A = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const INITIAL_B = [0, 0, 0, 0.5, 0.5, 0, 0, 0, 0, 0];

  const [cellsA, setCellsA] = useState<number[]>([...INITIAL_A]);
  const [cellsB, setCellsB] = useState<number[]>([...INITIAL_B]);
  const [stepCount, setStepCount] = useState<number>(0);

  const reactionOn = currentChapter === 2;

  const step1D = () => {
    const n = cellsA.length;
    // Substrate A diffuses fast, activator B diffuses slowly - the essential asymmetry.
    const dA = 0.4;
    const dB = 0.1;
    const f = 0.055;
    const k = 0.062;

    const nextA = [...cellsA];
    const nextB = [...cellsB];

    for (let i = 0; i < n; i++) {
      const im1 = (i - 1 + n) % n;
      const ip1 = (i + 1) % n;

      // 1D Laplacian: left + right - 2 * centre
      const lapA = cellsA[im1] + cellsA[ip1] - 2 * cellsA[i];
      const lapB = cellsB[im1] + cellsB[ip1] - 2 * cellsB[i];

      if (reactionOn) {
        const abb = cellsA[i] * cellsB[i] * cellsB[i];
        nextA[i] = Math.max(0, Math.min(1, cellsA[i] + dA * lapA - abb + f * (1 - cellsA[i])));
        nextB[i] = Math.max(0, Math.min(1, cellsB[i] + dB * lapB + abb - (f + k) * cellsB[i]));
      } else {
        // Pure diffusion, no reaction: total mass is conserved and the profile flattens.
        nextA[i] = cellsA[i];
        nextB[i] = Math.max(0, Math.min(1, cellsB[i] + dA * lapB));
      }
    }

    setCellsA(nextA);
    setCellsB(nextB);
    setStepCount((s) => s + 1);
  };

  const addConcentrationAt = (idx: number) => {
    const next = [...cellsB];
    next[idx] = Math.min(1, next[idx] + 0.4);
    setCellsB(next);
    if (reactionOn) {
      const nextA = [...cellsA];
      nextA[idx] = Math.max(0, nextA[idx] - 0.4);
      setCellsA(nextA);
    }
  };

  const reset1D = () => {
    setCellsA([...INITIAL_A]);
    setCellsB([...INITIAL_B]);
    setStepCount(0);
  };

  // Reset the toy when moving between chapter 1 (diffusion) and 2 (reaction+diffusion)
  useEffect(() => {
    if (currentChapter === 1 || currentChapter === 2) reset1D();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter]);

  // Total activator mass - shown so the reader can see conservation vs. amplification.
  const totalB = cellsB.reduce((s, v) => s + v, 0);

  // ---------------------------------------------------------------------------
  // Challenge evaluation
  //
  // A challenge is only satisfied when the SIMULATED FIELD actually shows the
  // target morphology, not merely when a slider sits in a numeric range. The
  // previous implementation marked chapters complete from parameter values
  // alone (and computed a NaN variance from a malformed dummy grid).
  // ---------------------------------------------------------------------------
  const measureField = (grid: number[][]) => {
    if (!grid.length || !Array.isArray(grid[0])) return null;
    let sum = 0;
    let sumSq = 0;
    let active = 0;
    let total = 0;
    for (let x = 0; x < grid.length; x++) {
      const col = grid[x];
      for (let y = 0; y < col.length; y++) {
        const v = col[y];
        sum += v;
        sumSq += v * v;
        if (v > 0.2) active++;
        total++;
      }
    }
    if (!total) return null;
    const mean = sum / total;
    return { variance: sumSq / total - mean * mean, coverage: active / total };
  };

  /** Count connected activator blobs (4-connectivity, periodic) on a coarsened grid. */
  const countBlobs = (grid: number[][], stride = 2) => {
    const w = Math.floor(grid.length / stride);
    if (w < 8) return 0;
    const mask: boolean[][] = [];
    for (let x = 0; x < w; x++) {
      mask[x] = [];
      for (let y = 0; y < w; y++) mask[x][y] = grid[x * stride][y * stride] > 0.2;
    }
    const seen: boolean[][] = mask.map((c) => c.map(() => false));
    let blobs = 0;
    let largest = 0;
    let activeTotal = 0;
    for (let x = 0; x < w; x++) for (let y = 0; y < w; y++) if (mask[x][y]) activeTotal++;

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < w; y++) {
        if (!mask[x][y] || seen[x][y]) continue;
        blobs++;
        let size = 0;
        const stack: [number, number][] = [[x, y]];
        seen[x][y] = true;
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          size++;
          const nb: [number, number][] = [
            [(cx + 1) % w, cy],
            [(cx - 1 + w) % w, cy],
            [cx, (cy + 1) % w],
            [cx, (cy - 1 + w) % w],
          ];
          for (const [nx, ny] of nb) {
            if (mask[nx][ny] && !seen[nx][ny]) {
              seen[nx][ny] = true;
              stack.push([nx, ny]);
            }
          }
        }
        if (size > largest) largest = size;
      }
    }
    return activeTotal ? (blobs >= 12 && largest < activeTotal * 0.35 ? blobs : 0) : 0;
  };

  const evaluateTuringMatch = useCallback(
    (grid: number[][], expected: 'spots' | 'ridges') => {
      const m = measureField(grid);
      if (!m) return false;
      // Reject blank / saturated fields regardless of parameters.
      if (m.coverage < 0.03 || m.coverage > 0.9 || m.variance < 0.004) return false;

      if (expected === 'spots') {
        // Many small disconnected islands.
        return countBlobs(grid) >= 12 && m.coverage < 0.55;
      }
      // Ridges: high coverage carried by few, large, connected components.
      return countBlobs(grid) === 0 && m.coverage > 0.25;
    },
    [],
  );

  const evaluateLsystemMatch = useCallback(
    (rules: { from: string; to: string }[], angle: number, expected: 'branching' | 'symmetric') => {
      if (expected === 'branching') {
        const hasBranches = rules.some((r) => r.to.includes('[') && r.to.includes(']'));
        return hasBranches && angle >= 15 && angle <= 45;
      }
      // Koch snowflake: 60 deg, and a rule with no bracketed side-branches.
      const noBranches = rules.every((r) => !r.to.includes('['));
      return angle === 60 && noBranches;
    },
    [],
  );

  const markComplete = (n: number) =>
    setCompletedChapters((prev) => (prev[n] ? prev : { ...prev, [n]: true }));

  // Navigation handlers
  const handleNext = () => setCurrentChapter((c) => Math.min(TOTAL_CHAPTERS, c + 1));
  const handlePrev = () => setCurrentChapter((c) => Math.max(1, c - 1));
  const jumpToChapter = (id: number) => setCurrentChapter(id);

  const chapter: Chapter = CHAPTERS[currentChapter - 1];
  const showTuring = currentChapter <= 4 || (currentChapter === 7 && sandboxEngine === 'turing');

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto px-4 py-6" id="narrative-layout">
      {/* LEFT COLUMN: Narrative guide */}
      <div
        className="flex flex-col lg:w-5/12 bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 sm:p-8 flex-shrink-0 flex-grow-0"
        id="chapter-narrative-card"
      >
        {/* Chapter stepper */}
        <nav className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-2" id="chapters-nav-stepper" aria-label="Chapters">
          {Array.from({ length: TOTAL_CHAPTERS }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => jumpToChapter(num)}
              aria-label={`Go to chapter ${num}${completedChapters[num] ? ' (completed)' : ''}`}
              aria-current={currentChapter === num ? 'step' : undefined}
              className={`flex-1 min-w-[32px] h-2 rounded-full transition-all ${
                currentChapter === num
                  ? 'bg-stone-950'
                  : completedChapters[num]
                  ? 'bg-emerald-500'
                  : 'bg-stone-100 hover:bg-stone-200'
              }`}
              title={`Jump to Chapter ${num}`}
              id={`step-jump-${num}`}
            />
          ))}
        </nav>

        {/* Headings */}
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 font-sans flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            <span>
              EXPLORABLE EXPLANATION &bull; CHAPTER {currentChapter} OF {TOTAL_CHAPTERS}
            </span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-sans tracking-tight text-stone-900 font-bold" id="chapter-title">
            {chapter.title}
          </h2>
          <p className="text-sm font-medium text-stone-500 italic" id="chapter-subtitle">
            {chapter.subtitle}
          </p>
        </div>

        {/* Story body */}
        <div
          className="flex-1 overflow-y-auto pr-1 text-sm text-stone-700 leading-relaxed flex flex-col gap-4 mb-6 border-t border-b border-stone-100 py-6 max-h-[360px] lg:max-h-[500px]"
          id="chapter-story-body"
        >
          {chapter.paragraphs.map((para, pIdx) => (
            <p key={pIdx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: para }} />
          ))}

          {/* 1D toy for Chapters 1 & 2 */}
          {(currentChapter === 1 || currentChapter === 2) && (
            <div
              className="bg-stone-50 p-4 rounded-2xl border border-stone-200/50 flex flex-col gap-3 mt-2"
              id="interactive-1d-diffusion-toy"
            >
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>{reactionOn ? '1D Reaction + Diffusion' : '1D Diffusion Only'}</span>
              </span>
              <p className="text-xs text-stone-500">
                {reactionOn
                  ? 'Same diffusion as before, but now B also eats A to make more B. Step it and watch the peak sharpen and split instead of flattening.'
                  : 'Click a cell to add activator B, then step. With no reaction, diffusion always smooths the profile towards a flat line.'}
              </p>

              <div className="flex gap-1.5 justify-center mt-1 items-end h-16">
                {cellsB.map((val, idx) => (
                  <button
                    key={idx}
                    onClick={() => addConcentrationAt(idx)}
                    className="flex-1 h-full rounded-md border flex flex-col items-center justify-end overflow-hidden transition-all relative hover:border-amber-400 group bg-white"
                    title={`Cell ${idx}: activator B = ${val.toFixed(2)}, substrate A = ${cellsA[idx].toFixed(2)}`}
                    aria-label={`Add activator to cell ${idx}`}
                    id={`cell-1d-${idx}`}
                  >
                    <span
                      className="w-full transition-all"
                      style={{ height: `${Math.max(2, val * 100)}%`, backgroundColor: '#ef4444' }}
                    />
                    <span className="absolute bottom-0.5 text-[9px] font-sans text-stone-700 font-bold leading-none select-none z-10">
                      {(val * 100).toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2 justify-between items-center">
                <span className="text-[10px] font-mono text-stone-500">
                  step {stepCount} &bull; total B ={' '}
                  <span className={reactionOn ? 'text-emerald-700 font-bold' : 'text-stone-700 font-bold'}>
                    {totalB.toFixed(3)}
                  </span>
                  {reactionOn ? ' (can grow)' : ' (conserved)'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={reset1D}
                    className="px-2.5 py-1 text-[11px] font-bold text-stone-500 hover:text-stone-700 font-sans transition-all"
                    id="reset-1d-btn"
                  >
                    Reset
                  </button>
                  <button
                    onClick={step1D}
                    className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-950 text-white hover:bg-neutral-800 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-all shadow-sm"
                    id="step-1d-btn"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Step &rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Challenge box */}
          {chapter.challenge && (
            <div
              className={`p-4 rounded-2xl border flex flex-col gap-2.5 mt-2 transition-all ${
                completedChapters[currentChapter]
                  ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800'
                  : 'bg-amber-50/50 border-amber-300 text-amber-900'
              }`}
              id="challenge-box"
            >
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                {completedChapters[currentChapter] ? (
                  <Trophy className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span>DEVELOPMENTAL CHALLENGE</span>
              </span>
              <p className="text-xs leading-relaxed">{chapter.challenge.prompt}</p>

              {!completedChapters[currentChapter] && (
                <div className="text-[11px] flex gap-1 bg-white/60 p-2 rounded-lg border border-amber-100 text-stone-600">
                  <span className="font-semibold select-none text-amber-700 shrink-0">HINT:</span>
                  <span>{chapter.challenge.hint}</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1 self-start">
                {completedChapters[currentChapter] ? (
                  <div className="bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-sm font-sans animate-bounce-short">
                    <Check className="w-3.5 h-3.5" />
                    <span>Pattern achieved!</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      // Apply the parameters the challenge asks for, then let the
                      // simulation decide whether the challenge is met. The button
                      // no longer force-marks the chapter complete.
                      if (currentChapter === 3) {
                        onChangeTuringParams({ ...turingParams, feed: 0.030, kill: 0.062 });
                      } else if (currentChapter === 4) {
                        onChangeTuringParams({ ...turingParams, feed: 0.026, kill: 0.055 });
                      } else if (currentChapter === 5) {
                        onChangeLsystemParams({
                          ...lsystemParams,
                          axiom: 'X',
                          rules: [
                            { from: 'X', to: 'F+[[X]-X]-F[-FX]+X' },
                            { from: 'F', to: 'FF' },
                          ],
                          angle: 25,
                          depth: 4,
                        });
                      } else if (currentChapter === 6) {
                        // FIXED: this used to apply the 22-degree bush preset,
                        // directly contradicting a challenge that asks for 60 degrees.
                        onChangeLsystemParams({
                          ...lsystemParams,
                          axiom: 'F++F++F',
                          rules: [{ from: 'F', to: 'F-F++F-F' }],
                          angle: 60,
                          depth: 3,
                        });
                      }
                    }}
                    className="text-[10px] font-sans font-bold px-2.5 py-1 text-amber-700 hover:text-amber-900 border border-amber-300 hover:bg-amber-100/40 rounded-lg transition-all"
                    id="autocalibrate-btn"
                  >
                    Auto-calibrate parameters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center gap-4 mt-auto pt-4 border-t border-stone-100" id="dialog-footer">
          <button
            onClick={handlePrev}
            disabled={currentChapter === 1}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold font-sans border flex items-center gap-1.5 transition-all ${
              currentChapter === 1
                ? 'opacity-30 border-stone-100 text-stone-400 cursor-not-allowed'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
            id="prev-chapter-btn"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <button
            onClick={handleNext}
            disabled={currentChapter === TOTAL_CHAPTERS}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans border flex items-center gap-1.5 transition-all shadow-sm ${
              currentChapter === TOTAL_CHAPTERS
                ? 'opacity-30 border-stone-100 text-stone-400 cursor-not-allowed'
                : 'bg-stone-900 border-stone-950 hover:bg-stone-800 text-white'
            }`}
            id="next-chapter-btn"
          >
            <span>Next Chapter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: active simulator */}
      <div className="flex-1 w-full lg:w-7/12 flex flex-col gap-3" id="active-sim-view-wrapper">
        {currentChapter === 7 && (
          <div className="flex gap-2 bg-white border border-stone-200 rounded-2xl p-1.5" id="sandbox-engine-toggle">
            {(['turing', 'lsystem'] as const).map((eng) => (
              <button
                key={eng}
                onClick={() => setSandboxEngine(eng)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  sandboxEngine === eng
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
                id={`sandbox-toggle-${eng}`}
              >
                {eng === 'turing' ? 'Reaction-Diffusion' : 'L-System Growth'}
              </button>
            ))}
          </div>
        )}

        {showTuring ? (
          <TuringSim3D
            params={turingParams}
            onChangeParams={onChangeTuringParams}
            onChallengeSuccess={() => markComplete(currentChapter)}
            challengeCheck={(grid) => {
              if (currentChapter === 3) return evaluateTuringMatch(grid, 'spots');
              if (currentChapter === 4) return evaluateTuringMatch(grid, 'ridges');
              return false;
            }}
          />
        ) : (
          <LSystemSim3D
            params={lsystemParams}
            onChangeParams={onChangeLsystemParams}
            onChallengeSuccess={() => markComplete(currentChapter)}
            challengeCheck={(rules, angle) => {
              if (currentChapter === 5) return evaluateLsystemMatch(rules, angle, 'branching');
              if (currentChapter === 6) return evaluateLsystemMatch(rules, angle, 'symmetric');
              return false;
            }}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Narrative text
//
// NOTE: these strings are injected with dangerouslySetInnerHTML, so they must
// use plain HTML attributes. The original used React's `className=`, which
// browsers ignore - every inline highlight in the text was silently unstyled.
// =============================================================================
const CODE = 'font-mono text-xs bg-stone-100 text-stone-800 px-1 rounded font-bold';

const CHAPTERS: Chapter[] = [
  {
    title: 'The Symmetry Mystery',
    subtitle: 'How does an embryo decide where to put its spots?',
    paragraphs: [
      'Many animal embryos start out looking almost featureless: a single cell divides into a hollow ball called a <strong>blastula</strong>. Zoom out far enough and it is nearly round, nearly uniform.',
      '<em>Nearly.</em> Real eggs are rarely perfectly symmetric \u2014 frog and fruit-fly eggs carry maternal gradients laid down before fertilisation. But the puzzle stands: a handful of coarse cues cannot possibly specify the position of every leopard rosette or every stripe on a zebra\u2019s flank.',
      'The nineteenth-century idea that the adult form was somehow pre-folded inside the egg (<em>preformationism</em>) had been abandoned long before, but by the 1940s biologists still tended to assume patterns were read off a pre-existing map. In 1952, <strong>Alan Turing</strong> proposed something stranger in <em>The Chemical Basis of Morphogenesis</em>: a chemical system with <em>no</em> map at all can generate one, because a uniform state can be <em>unstable</em>.',
      'That should sound wrong. <strong>Play with the 1D toy below.</strong> Add some chemical to a cell and step it forward. Diffusion does exactly what you expect \u2014 it spreads things out, flattens peaks, and conserves the total. Watch the running total: it does not change.',
      'So how do you get lumps out of a process whose entire job is removing lumps? Turing\u2019s answer is in the next chapter.',
    ],
  },
  {
    title: 'Activator & Substrate',
    subtitle: 'Local self-amplification, long-range starvation',
    paragraphs: [
      'This simulation runs the <strong>Gray-Scott</strong> model, which has two chemicals with very different jobs:',
      '1. <strong>Activator B</strong> \u2014 <em>autocatalytic</em>. B consumes A to make more B, in the reaction <span class="' +
        CODE +
        '">A + 2B &rarr; 3B</span>. More B means faster B production: a positive feedback loop.',
      '2. <strong>Substrate A</strong> \u2014 the feedstock. It is <em>eaten</em> by the reaction and topped back up from a reservoir at the feed rate <span class="' +
        CODE +
        '">f</span>.',
      '<strong>A common mix-up, worth getting right:</strong> A is not an inhibitor that B manufactures. Inhibition here is <em>indirect</em>. A patch of B strips the local A, and because <strong>A diffuses twice as fast as B</strong> (D<sub>A</sub>=1.0 vs D<sub>B</sub>=0.5), the starved zone spreads outward faster than the patch itself can. Each blob digs its own moat and keeps its neighbours away.',
      'This is the principle of <strong>local activation with long-range inhibition</strong>. Gierer and Meinhardt (1972) achieved it with a genuinely separate inhibitor molecule; Gray-Scott achieves the same effect by <em>substrate depletion</em>. Either way, the fast-spreading species is the one that does the suppressing.',
      '<strong>Now switch the reaction on in the toy below.</strong> Same diffusion, same starting bump \u2014 but the total no longer holds still, and the peak sharpens instead of flattening. That is symmetry-breaking in one dimension.',
    ],
  },
  {
    title: 'Painting Spots on a Sphere',
    subtitle: 'Feed, kill, and the parameters that decide everything',
    paragraphs: [
      'The right-hand panel runs the same equations on a 128&times;128 grid, wrapped onto a 3D body. Two numbers control the whole system:',
      '<span class="' +
        CODE +
        '">f</span> (feed) sets how fast substrate A is replenished; <span class="' +
        CODE +
        '">k</span> (kill) sets how fast activator B is removed. B\u2019s total loss rate is actually <span class="' +
        CODE +
        '">f + k</span>, which is why the two dials interact rather than acting independently.',
      'Try <strong>clicking and dragging on the body</strong> to paint activator. A blob that is too small dies out. Gray-Scott is <em>excitable</em>, not spontaneously unstable: unlike the textbook Turing instability, it will not pattern from an infinitesimal ripple \u2014 it needs a seed of finite size to get going. That is a real difference between this model and the one Turing analysed, and it is why the simulation starts you with a seeded blob rather than pure noise.',
      '<strong>Challenge:</strong> produce isolated leopard spots. Around <span class="' +
        CODE +
        '">f = 0.030</span>, <span class="' +
        CODE +
        '">k = 0.062</span> each blob\u2019s moat is wide enough to stop it merging with its neighbours, and the surface settles into a lattice of separate dots.',
      '<em>Caveat worth knowing:</em> the grid wraps around at all four edges, so the chemistry actually lives on a <strong>torus</strong> that is then painted onto whichever body you pick. Only the torus mesh is geometrically honest; on the sphere you will see stretching near the poles and a seam where the texture meets itself.',
    ],
    challenge: {
      prompt: 'Drive the surface into a field of separate, isolated spots \u2014 the challenge checks the actual pattern, not just your slider positions.',
      hint: 'Try f \u2248 0.030 and k \u2248 0.062, then give it a few seconds to settle. Painting extra activator speeds things up.',
    },
  },
  {
    title: 'When Spots Become Ridges',
    subtitle: 'And why real zebra stripes need something extra',
    paragraphs: [
      'Lower the kill rate and each blob survives a little longer before its moat closes in. Spots stretch, touch, and fuse into long winding <strong>ridges</strong>.',
      '<strong>Be honest about what you are seeing:</strong> Gray-Scott ridges are <em>labyrinthine</em> \u2014 they meander and branch like a maze or a brain-coral surface. They are not the parallel bands of a zebra. Getting stripes to line up requires an extra ingredient the model does not have on its own: a growth axis, a tissue that is much longer than it is wide, a pre-existing gradient, or anisotropic diffusion.',
      'You can feel this yourself: switch the body to a <strong>cylinder</strong>. The geometry itself supplies a direction, and the ridges start to wrap around it.',
      'How much of this happens in real animals is still an active question. Turing-like mechanisms are well supported in <em>zebrafish</em> stripes \u2014 though there the interaction is carried by direct contact between pigment cells rather than by diffusing morphogens (Nakamasu et al., 2009) \u2014 and in cat coat markings, where a reaction-diffusion prepattern involving DKK4 was identified in 2021. For zebras and leopards specifically, the reaction-diffusion account (Murray, 1981) remains a compelling hypothesis rather than a settled fact.',
      '<em>One more correction to a claim you will see repeated:</em> sand dunes are also self-organising, but they are <strong>not</strong> reaction-diffusion. Dune fields come from a sediment-transport instability \u2014 same beautiful idea, different physics.',
    ],
    challenge: {
      prompt: 'Merge the spots into connected, maze-like ridges covering a good fraction of the surface.',
      hint: 'Try f \u2248 0.026 and k \u2248 0.055. If the surface goes blank, your kill rate is too high and the activator has died out.',
    },
  },
  {
    title: 'Nature\u2019s Branching Grammar',
    subtitle: 'L-systems: development as a rewriting rule',
    paragraphs: [
      'Chemistry explains skin markings. It does not explain the <em>architecture</em> of a fern frond or a coral colony. For that we need a different kind of model.',
      'In 1968 the theoretical biologist <strong>Aristid Lindenmayer</strong> introduced <strong>L-systems</strong>. The defining feature is <em>parallel rewriting</em>: every symbol in the string is replaced at the same time, in every generation, the way every cell in a tissue divides on its own schedule. (This is what separates an L-system from an ordinary Chomsky grammar, where one symbol is rewritten at a time.)',
      'Lindenmayer\u2019s originals described filamentous algae \u2014 one-dimensional chains of cells. The branching, turtle-graphics interpretation you are about to play with came later, largely through Przemys\u0142aw Prusinkiewicz, and is set out in <em>The Algorithmic Beauty of Plants</em> (1990).',
      'A rule like <span class="' +
        CODE +
        '">X &rarr; F+[[X]-X]-F[-FX]+X</span> reads as: draw forward, turn, open a branch, recurse, close it, and so on. Four generations of that turns one symbol into hundreds of segments.',
      '<strong>An analogy, not a mechanism:</strong> it is tempting to say "DNA is the rewriting rule." DNA does not rewrite strings. L-systems are a <em>descriptive</em> model \u2014 they capture the geometry that recursive, locally-identical growth produces, without claiming to be the biochemistry that implements it.',
      '<strong>Challenge:</strong> grow something that actually branches. The grammar needs bracket pairs <span class="' +
        CODE +
        '">[ ]</span> to push and pop the turtle\u2019s state.',
    ],
    challenge: {
      prompt: 'Build a rule set containing bracketed side-branches, with a branch angle in a plant-like range.',
      hint: 'Use the Fractal Plant preset, or write your own rule containing [ and ] and set the angle between 15\u00b0 and 45\u00b0.',
    },
  },
  {
    title: 'Fractals Without Branches',
    subtitle: 'The Koch snowflake \u2014 and what real snowflakes actually do',
    paragraphs: [
      'Remove the brackets and the same machinery draws pure geometry. The axiom <span class="' +
        CODE +
        '">F++F++F</span> with the rule <span class="' +
        CODE +
        '">F &rarr; F-F++F-F</span> at <strong>60\u00b0</strong> gives the <strong>Koch snowflake</strong>: a closed curve of finite area and unbounded perimeter, with fractal dimension log4/log3 &asymp; 1.26.',
      '<strong>Now the correction this chapter exists for.</strong> The Koch snowflake is <em>not</em> a model of a snowflake. Its self-similarity is imposed by hand, level by level. Real snow crystals grow by <strong>diffusion-limited solidification</strong>: water vapour diffuses toward the crystal, tips stick out into richer vapour and so grow faster, and the flat interface goes unstable (the Mullins-Sekerka instability).',
      'That should sound familiar. A fast-diffusing resource being locally depleted, with the depletion suppressing growth nearby \u2014 it is the same logic as Chapter 2, running on ice instead of chemistry. The six-fold symmetry comes from the crystal lattice; the branching comes from the instability. Neither comes from a rewriting rule.',
      'The honest summary: <strong>L-systems and reaction-diffusion are two different ways of getting complexity from simple local rules.</strong> One is a grammar, one is a physics. Nature uses something more like the second, but the first is often a far better <em>description</em> of the result.',
      '<strong>Challenge:</strong> set the angle to exactly 60\u00b0 with a bracket-free rule.',
    ],
    challenge: {
      prompt: 'Grow the Koch snowflake: a rule with no bracketed branches, at exactly 60\u00b0.',
      hint: 'Select the Koch Snowflake preset, or set the axiom to F++F++F, the rule to F-F++F-F, and the angle slider to 60\u00b0.',
    },
  },
  {
    title: 'The Sandbox',
    subtitle: 'Both engines, no rules',
    paragraphs: [
      'That is the tour. You have seen two genuinely different routes from simple local rules to complex global form.',
      '<strong>Reaction-diffusion:</strong> a uniform state that destroys itself, because a fast-spreading species suppresses a slow-spreading one that amplifies itself. Spots, ridges, mazes, and endlessly shifting waves fall out of two numbers.',
      '<strong>L-systems:</strong> a string rewritten in parallel and read as drawing instructions, producing branching structures whose statistics look startlingly like real plants.',
      'Use the toggle above the viewport to switch between them. Paint, edit the grammar, drag the sliders, break things. If you find a parameter pair that does something the chapters never mentioned, that is the point \u2014 both of these systems have regions nobody has catalogued.',
    ],
  },
];
