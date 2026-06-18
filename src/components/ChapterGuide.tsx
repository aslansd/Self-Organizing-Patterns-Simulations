import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Check, Sparkles, AlertCircle, HelpCircle, RefreshCw, Trophy, BookOpen, Lightbulb } from 'lucide-react';
import { TuringParameters, LSystemParameters, Chapter } from '../types';
import TuringSim3D from './TuringSim3D';
import LSystemSim3D from './LSystemSim3D';

interface ChapterGuideProps {
  turingParams: TuringParameters;
  onChangeTuringParams: (p: TuringParameters) => void;
  lsystemParams: LSystemParameters;
  onChangeLsystemParams: (p: LSystemParameters) => void;
}

export default function ChapterGuide({
  turingParams,
  onChangeTuringParams,
  lsystemParams,
  onChangeLsystemParams,
}: ChapterGuideProps) {
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [completedChapters, setCompletedChapters] = useState<Record<number, boolean>>({});

  // 1D Mini diffusion toy state (Chapter 1 & 2)
  const [diffusionCells, setDiffusionCells] = useState<number[]>([0, 0, 0, 100, 0, 0, 0, 0, 0, 0]);

  // Handle stepping the 1D diffusion chain
  const stepDiffusion1D = () => {
    const nextCells = [...diffusionCells];
    const rate = 0.3; // diffusion coefficient
    for (let i = 0; i < diffusionCells.length; i++) {
      const im1 = i === 0 ? diffusionCells.length - 1 : i - 1;
      const ip1 = (i + 1) % diffusionCells.length;

      // laplacian in 1D is: cell[left] + cell[right] - 2 * cell[center]
      const delta = rate * (diffusionCells[im1] + diffusionCells[ip1] - 2 * diffusionCells[i]);
      nextCells[i] = Math.max(0, Math.min(100, diffusionCells[i] + delta));
    }
    setDiffusionCells(nextCells);
  };

  const addConcentrationAt = (idx: number) => {
    const nextCells = [...diffusionCells];
    nextCells[idx] = Math.min(100, nextCells[idx] + 40);
    setDiffusionCells(nextCells);
  };

  const resetDiffusion1D = () => {
    setDiffusionCells([0, 0, 0, 100, 0, 0, 0, 0, 0, 0]);
  };

  // Chapter evaluation parameters & completed indicators
  const evaluateTuringMatch = (grid: number[][], expectedType: 'spots' | 'stripes') => {
    if (!grid.length) return false;
    let sum = 0;
    let sumSq = 0;
    let total = 0;
    for (let x = 0; x < grid.length; x++) {
      for (let y = 0; y < grid[x].length; y++) {
        sum += grid[x][y];
        sumSq += grid[x][y] * grid[x][y];
        total++;
      }
    }
    const average = sum / total;
    const variance = (sumSq / total) - (average * average);

    if (expectedType === 'spots') {
      // Spots are represented by distinct clusters, moderate variance (e.g., between 1 and 12)
      // And check if parameters match preset or similar ranges
      const feedCorrect = turingParams.feed >= 0.030 && turingParams.feed <= 0.045;
      const killCorrect = turingParams.kill >= 0.058 && turingParams.kill <= 0.065;
      return (variance > 0.005 && variance < 0.04) && (feedCorrect || (turingParams.feed < 0.05));
    } else {
      // Stripes have higher continuous variance
      const feedCorrect = turingParams.feed >= 0.048 && turingParams.feed <= 0.062;
      const killCorrect = turingParams.kill >= 0.058 && turingParams.kill <= 0.066;
      return (variance > 0.01) && feedCorrect;
    }
  };

  const evaluateLsystemMatch = (rules: { from: string; to: string }[], angle: number, expectedType: 'fern' | 'snowflake') => {
    if (expectedType === 'fern') {
      // Must contain branching grammar [ and ] and have an offset branch tilt
      const hasBranches = rules.some(r => r.to.includes('[') && r.to.includes(']'));
      const suitableAngle = angle >= 20 && angle <= 35;
      return hasBranches && suitableAngle;
    } else {
      // Symmetrical geometry Koch or hexagonal snowflake angles (usually 45, 60 or 90)
      const symmetricalAngle = angle === 60 || angle === 45 || angle === 90 || angle === 30;
      return symmetricalAngle;
    }
  };

  // Trigger completion indicators on successful states
  const checkChampionshipProgress = () => {
    if (currentChapter === 3) {
      // Turing Spots Check
      const matches = evaluateTuringMatch(Array(128).fill(0), 'spots'); // Checked inside the component primarily too
      if (turingParams.feed <= 0.042 && turingParams.feed >= 0.032) {
        setCompletedChapters(prev => ({ ...prev, 3: true }));
      }
    } else if (currentChapter === 4) {
      if (turingParams.feed >= 0.050 && turingParams.feed <= 0.058 && turingParams.kill >= 0.060 && turingParams.kill <= 0.064) {
        setCompletedChapters(prev => ({ ...prev, 4: true }));
      }
    } else if (currentChapter === 5) {
      // Fern Chapter
      const rules = lsystemParams.rules;
      const hasBranchStr = rules.some(r => r.to.includes('[') && r.to.includes(']'));
      if (hasBranchStr && lsystemParams.angle > 15 && lsystemParams.angle < 45) {
        setCompletedChapters(prev => ({ ...prev, 5: true }));
      }
    } else if (currentChapter === 6) {
      // Koch / symmetry
      if (lsystemParams.angle === 60 || lsystemParams.angle === 45) {
        setCompletedChapters(prev => ({ ...prev, 6: true }));
      }
    }
  };

  // Auto monitor state changes to approve challenges
  useEffect(() => {
    checkChampionshipProgress();
  }, [turingParams, lsystemParams, currentChapter]);

  // Navigation handlers
  const handleNext = () => {
    if (currentChapter < 7) {
      setCurrentChapter(currentChapter + 1);
    }
  };

  const handlePrev = () => {
    if (currentChapter > 1) {
      setCurrentChapter(currentChapter - 1);
    }
  };

  const jumpToChapter = (id: number) => {
    setCurrentChapter(id);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto px-4 py-6" id="narrative-layout">
      {/* LEFT COLUMN: Narrative Guide (Storybook / Nicky Case style card) */}
      <div className="flex flex-col lg:w-5/12 bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 sm:p-8 flex-shrink-0 flex-grow-0" id="chapter-narrative-card">
        {/* Chapter Steps Indicator */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-2 scrollbar-none" id="chapters-nav-stepper">
          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
            <button
              key={num}
              onClick={() => jumpToChapter(num)}
              className={`flex-1 min-w-[32px] h-2 rounded-full transition-all ${
                currentChapter === num
                  ? 'bg-stone-950 scale-102'
                  : completedChapters[num]
                  ? 'bg-emerald-500'
                  : 'bg-stone-100 hover:bg-stone-200'
              }`}
              title={`Jump to Chapter ${num}`}
              id={`step-jump-${num}`}
            />
          ))}
        </div>

        {/* Narrative Headings */}
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 font-sans flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            <span>EXPLAINABLE ADVENTURES • CHAPTER {currentChapter} OF 7</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-sans tracking-tight text-stone-900 font-bold" id="chapter-title">
            {CHpText[currentChapter - 1].title}
          </h1>
          <p className="text-sm font-medium text-stone-500 italic" id="chapter-subtitle">
            {CHpText[currentChapter - 1].subtitle}
          </p>
        </div>

        {/* Scrollable Story content */}
        <div className="flex-1 overflow-y-auto pr-1 text-sm text-stone-700 leading-relaxed flex flex-col gap-4 mb-6 border-t border-b border-stone-100 py-6 max-h-[360px] lg:max-h-[500px]" id="chapter-story-body">
          {CHpText[currentChapter - 1].paragraphs.map((para, pIdx) => (
            <p key={pIdx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: para }} />
          ))}

          {/* Interactive 1D Toy embedded for Chapters 1 & 2 */}
          {(currentChapter === 1 || currentChapter === 2) && (
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/50 flex flex-col gap-3 mt-2" id="interactive-1d-diffusion-toy">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Simulate 1D Molecular Diffusion</span>
              </span>
              <p className="text-xs text-stone-500">
                Click cells to add Chemical concentration, then hit <strong>Diffusive Step</strong> to watch it smooth out!
              </p>

              {/* Grid cell nodes */}
              <div className="flex gap-1.5 justify-center mt-1">
                {diffusionCells.map((val, idx) => (
                  <button
                    key={idx}
                    onClick={() => addConcentrationAt(idx)}
                    className="flex-1 h-9 rounded-md border flex flex-col items-center justify-end overflow-hidden transition-all relative hover:border-amber-400 group"
                    style={{
                      backgroundColor: `rgba(239, 68, 68, ${val / 100})`, // redness based on concentration
                      borderColor: val > 1 ? '#d6d3d1' : '#e7e5e4',
                    }}
                    title={`Cell concentration: ${val.toFixed(0)}%`}
                    id={`cell-1d-${idx}`}
                  >
                    <span className="text-[9px] font-sans text-stone-600 font-bold mb-0.5 leading-none select-none z-10 group-hover:text-stone-900">
                      {val.toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>

              {/* 1D Controllers */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={resetDiffusion1D}
                  className="px-2.5 py-1 text-[11px] font-bold text-stone-500 hover:text-stone-700 font-sans transition-all"
                  id="reset-1d-btn"
                >
                  Clear cells
                </button>
                <button
                  onClick={stepDiffusion1D}
                  className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-950 text-white hover:bg-neutral-800 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-all shadow-sm"
                  id="step-1d-btn"
                >
                  <RefreshCw className="w-3 h-3 animate-spin-slow" />
                  <span>Diffusive Step →</span>
                </button>
              </div>
            </div>
          )}

          {/* Chapters 3 to 6: Displays active Challenge box with gamified completion checks */}
          {CHpText[currentChapter - 1].challenge && (
            <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 mt-2 transition-all ${
              completedChapters[currentChapter]
                ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800'
                : 'bg-amber-50/50 border-amber-300 text-amber-900'
            }`} id="challenge-box">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                {completedChapters[currentChapter] ? (
                  <Trophy className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 font-bold" />
                )}
                <span>DEVELOPMENTAL CHALLENGE</span>
              </span>
              <p className="text-xs leading-relaxed">
                {CHpText[currentChapter - 1].challenge?.prompt}
              </p>

              {/* Dynamic suggestion tip */}
              {!completedChapters[currentChapter] && (
                <div className="text-[11px] flex gap-1 bg-white/60 p-2 rounded-lg border border-amber-100 text-stone-600">
                  <span className="font-semibold select-none text-amber-700 shrink-0">💡 HINT:</span>
                  <span>{CHpText[currentChapter - 1].challenge?.hint}</span>
                </div>
              )}

              {/* Completion Ribbon Status */}
              <div className="flex items-center gap-2 mt-1 self-start">
                {completedChapters[currentChapter] ? (
                  <div className="bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-sm font-sans animate-bounce-short">
                    <Check className="w-3.5 h-3.5 border-1 rounded-full border-white" />
                    <span>Challenge Unlocked!</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (currentChapter === 3) {
                        // Quick calibrate spot preset
                        onChangeTuringParams({ ...turingParams, feed: 0.035, kill: 0.062 });
                      } else if (currentChapter === 4) {
                        // Zebra stripes preset
                        onChangeTuringParams({ ...turingParams, feed: 0.0545, kill: 0.062 });
                      } else if (currentChapter === 5) {
                        // Fern preset
                        onChangeLsystemParams({
                          ...lsystemParams,
                          axiom: 'X',
                          rules: [
                            { from: 'X', to: 'F+[[X]-X]-F[-FX]+X' },
                            { from: 'F', to: 'FF' }
                          ],
                          angle: 25,
                        });
                      } else if (currentChapter === 6) {
                        // Symmetrical tree preset
                        onChangeLsystemParams({
                          ...lsystemParams,
                          axiom: 'F',
                          rules: [{ from: 'F', to: 'FF-[-F+F+F]+[+F-F-F]' }],
                          angle: 22,
                        });
                      }
                      setCompletedChapters(prev => ({ ...prev, [currentChapter]: true }));
                    }}
                    className="text-[10px] font-sans font-bold px-2.5 py-1 text-amber-700 hover:text-amber-900 border border-amber-300 hover:bg-amber-100/40 rounded-lg transition-all"
                    id="bypass-challenge-btn"
                  >
                    Auto-Calibrate DNA Presets 🧬
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Story Pagination bottom footer */}
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
            disabled={currentChapter === 7}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans border flex items-center gap-1.5 transition-all shadow-sm ${
              currentChapter === 7
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

      {/* RIGHT COLUMN: Active interactive simulator matched with narrative needs */}
      <div className="flex-1 w-full lg:w-7/12" id="active-sim-view-wrapper">
        {currentChapter <= 4 ? (
          /* Turing Morphogenesis 3D Playground (Chapters 1 to 4) */
          <TuringSim3D
            params={turingParams}
            onChangeParams={onChangeTuringParams}
            chapterMode={true}
            onChallengeSuccess={() => {
              if (!completedChapters[currentChapter]) {
                setCompletedChapters((prev) => ({ ...prev, [currentChapter]: true }));
              }
            }}
            challengeCheck={(grid) => {
              if (currentChapter === 3) return evaluateTuringMatch(grid, 'spots');
              if (currentChapter === 4) return evaluateTuringMatch(grid, 'stripes');
              return false;
            }}
          />
        ) : (
          /* L-Systems 3D Organic Branching (Chapters 5 to 7) */
          <LSystemSim3D
            params={lsystemParams}
            onChangeParams={onChangeLsystemParams}
            chapterMode={true}
            onChallengeSuccess={() => {
              if (!completedChapters[currentChapter]) {
                setCompletedChapters((prev) => ({ ...prev, [currentChapter]: true }));
              }
            }}
            challengeCheck={(rules, angle) => {
              if (currentChapter === 5) return evaluateLsystemMatch(rules, angle, 'fern');
              if (currentChapter === 6) return evaluateLsystemMatch(rules, angle, 'snowflake');
              return false;
            }}
          />
        )}
      </div>
    </div>
  );
}

// Nicky Case styled chapters writing logic
const CHpText = [
  {
    title: 'The Symmetry Mystery',
    subtitle: 'How does an embryo get its shape or spots?',
    paragraphs: [
      'Every living thing begins as a single, perfectly symmetrical sphere: a fertilized cell or egg. This sphere divides, multiplying into a uniform, blank hollow ball of cells called a <strong>blastula</strong>.',
      'But how does this blank sphere decide which side sprouts a leg, where the dark leopard spots land, or how stripes wrap neatly around a zebra’s ribs?',
      'For centuries, scientists believed this pattern was pre-folded inside like origami. But in 1952, legendary mathematician <strong>Alan Turing</strong> proposed an elegant theory: <em>uniform chemicals diffusion can build patterns out of absolute symmetry.</em>',
      '<strong>Play with the 1D toy below:</strong> Click cells to add chemical mass. Watch how it diffuses and evens out. Usually, diffusion smooths things out. But Turing found that adding reactions completely breaks this rule!',
    ],
  },
  {
    title: 'Activators & Inhibitors',
    subtitle: 'The yin and yang of chemical biology',
    paragraphs: [
      'In Turing’s model, two chemical keys compete in a delicate molecular ballet:',
      '1. <strong>The Activator (Chemical B):</strong> Autocatalytic! It feeds on feedstock and makes MORE of itself. This represents a positive feedback loop.',
      '2. <strong>The Inhibitor / Feeding Buffer (Chemical A):</strong> Created in response to chemical B, it dampens or shuts down chemical B’s production.',
      'The cosmic secret lies in their <strong>diffusion speeds</strong>. If the Inhibitor diffuses <em>faster</em> than the Activator, a localized peak of Activator is prevented from spreading infinitely. It forms a stable, localized spot surrounded by a moat of Inhibitor!',
      'This behavior is called <strong>local activation, lateral inhibition</strong>. Play with the 1D toy again, then shift to the 3D canvas of the egg/blastula on the right.',
    ],
  },
  {
    title: 'Embryogenesis: Painting Spots',
    subtitle: 'Triggering spots with reaction and clearance rates',
    paragraphs: [
      'Now, let’s observe these reactions on a 3D developmental embryo! Right now, the simulation is running a classic Turing reaction-diffusion solver.',
      'Try clicking and dragging directly on the 3D cell to <strong>paint droplets of high activator</strong>. Watch them branch out! If we calibrate Feed (<span className="font-mono text-xs bg-stone-100 text-stone-700 px-1 font-bold">f</span>) and Decay (<span className="font-mono text-xs bg-stone-100 text-stone-700 px-1 font-bold">k</span>) perfectly, the activator breaks symmetry on its own!',
      '<strong>Your developmental challenge:</strong> Create leopard spots! Dial the feed rate smaller (<span className="font-mono text-stone-700">f ~ 0.035</span>) or activate the Leopard Spots preset. Help the embryo build isolated dots!',
    ],
    challenge: {
      prompt: 'Successfully calibrate or paint the 3D blastula sphere to emerge into isolated "Leopard Spots"!',
      hint: 'Bring parameters to: Feed (0.0350) and Decay/Kill (0.0620). Or use the "Auto-Calibrate DNA Presets" button below!',
    },
  },
  {
    title: 'The Zebra Ribs',
    subtitle: 'Aligning droplets into stripes and labyrinth lines',
    paragraphs: [
      'What if we want stripes instead? If active molecules are supplied with higher feedstocks or slower decay, spots will stretch, merge, and organize into <strong>concentric bands and stripes</strong>.',
      'This process governs how zebra skins get marked, how desert sand dunes organize, and how brain coral grows standard maze-like ridges!',
      '<strong>Paint directly on the cell</strong> to seed striped streams, and adjust the geometry of the embryo in the bottom selection from a blastula SPHERE to a cylinder (representing the growth axis of a growing leg/tail) or a torus!',
      '<strong>Your developmental challenge:</strong> Form pristine Zebra Stripes! Adjust the sliders, or click the preset for stripes to achieve a banded state.',
    ],
    challenge: {
      prompt: 'Transition the embryo chemical concentrations to create long, connected "Zebra Stripes" ridges.',
      hint: 'Move Feed (f) to approximately 0.0545 and Decay/Kill (k) to approximately 0.0620.',
    },
  },
  {
    title: 'Nature’s Branching DNA',
    subtitle: 'Morphogenesis through recursive production codes',
    paragraphs: [
      'Chemical gradients explain spots and skin textures, but what about the complex <em>structural</em> growth of skeletons, plant architectures, and ocean corals? ',
      'In 1968, biologist <strong>Aristid Lindenmayer</strong> introduced <strong>L-Systems</strong>—a mathematical theory that models development as simple recursive code sequences.',
      'Imagine a cell DNA having single string replacement rules: <em>"A branch must split into two branches every day."</em> In L-Systems, we write this as a rule: <span className="font-mono text-xs bg-stone-100 text-stone-700 px-1 font-bold">X → F+[[X]-X]-F[-FX]+X</span>.',
      'On the right is a 3D branching seedling. Watch it sprout! <strong>Your challenge:</strong> Sprout the Classic Fern by ensuring the rule holds bracketed branches!',
    ],
    challenge: {
      prompt: 'Program or calibrate a branching L-System structure that includes branching brackets [ ] and sprouts like a real fern!',
      hint: 'Enable the "Classic Fern" preset or input [ ] rules and hit "Sprout Seed".',
    },
  },
  {
    title: 'Recursive Mathematical Crystals',
    subtitle: 'Geometric fractals and the Koch snowflake',
    paragraphs: [
      'L-Systems can also construct perfect crystalline geometries like snowflakes and fractals. In nature, this occurs when developmental branches grow symmetrically without a dominant vertical trunk (e.g. ice crystals, shell spirals).',
      'By calibration of bifurcation angles to precise angles (like <span className="font-sans font-bold">60°</span>), we can break the organic randomness of a tree and form pristine geometric tiles!',
      '<strong>Sprout the Snowflake:</strong> Update the bifurcation angle slider to exactly 60 degrees. Or tap the snowflake preset on the right.',
    ],
    challenge: {
      prompt: 'Calibrate the L-System to grow with perfect geometric symmetry by settings the bifurcation angle to exactly 60° (or 45°)!',
      hint: 'Move the bifurcation slider to 60° or trigger the Koch Snowflake preset.',
    },
  },
  {
    title: 'Grand Morphogenetic Sandbox',
    subtitle: 'Play, edit DNA code, and design your 3D life-form!',
    paragraphs: [
      'Congratulations! You have completed the playable chapters of <strong>MorphoGenesis & Self-Organization</strong>!',
      'You studied how Alan Turing’s reaction diffusion allows homogeneous chemical blocks to break symmetry forming spotted skin coats, and how Lindenmayer’s DNA strings organize beautiful 3D branches recursively.',
      'Now, the timeline is fully in your hands. Feel free to navigate between Turing patterns and L-Systems using the panels. Paint on the 3D meshes, edit the DNA algebraic rules, tweak the timeline, and create your custom self-organized form!',
    ],
  },
];
