import { useState } from 'react';
import ChapterGuide from './components/ChapterGuide';
import { TuringParameters, LSystemParameters } from './types';
import { Dna, HelpCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [turingParams, setTuringParams] = useState<TuringParameters>({
    feed: 0.030,
    kill: 0.062,
    diffuseA: 1.0, // substrate A diffuses fast
    diffuseB: 0.5, // activator B diffuses slowly - this asymmetry is the whole mechanism
    timeStep: 1.0,
    brushSize: 4,
    brushType: 'addB',
    resolution: 128,
    meshType: 'sphere',
  });

  const [lsystemParams, setLsystemParams] = useState<LSystemParameters>({
    axiom: 'X',
    rules: [
      { from: 'X', to: 'F+[[X]-X]-F[-FX]+X' },
      { from: 'F', to: 'FF' },
    ],
    angle: 25,
    depth: 4,
    length: 0.15,
    lengthDecay: 0.9,
    width: 0.075,
    widthDecay: 0.75,
    colorTheme: 'forest',
  });

  const [showExplanationModal, setShowExplanationModal] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-800 font-sans flex flex-col relative selection:bg-amber-100 selection:text-stone-900" id="app-root-layout">
      <header className="border-b border-stone-200 bg-white/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4" id="main-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center text-white shadow-md">
            <Dna className="w-5 h-5 text-emerald-400 rotate-12" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-stone-900 font-sans">
                Playable Morphogenesis
              </span>
              <span className="bg-emerald-500/10 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider font-sans">
                Interactive 3D
              </span>
            </div>
            <p className="text-xs text-stone-400 font-mono">Self-organised biological patterns</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExplanationModal(true)}
            className="px-3.5 py-2 hover:bg-stone-50 border border-stone-200 text-stone-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all font-sans"
            id="how-it-works-btn"
          >
            <HelpCircle className="w-4 h-4 text-stone-400" />
            <span>How it works</span>
          </button>

          <a
            href="https://explorabl.es/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all font-sans"
            id="explorables-credit-btn"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>More explorables</span>
          </a>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col" id="app-main-stage">
        <ChapterGuide
          turingParams={turingParams}
          onChangeTuringParams={setTuringParams}
          lsystemParams={lsystemParams}
          onChangeLsystemParams={setLsystemParams}
        />
      </main>

      <footer className="border-t border-stone-200/60 bg-white/40 py-6 text-center text-xs text-stone-400 font-sans flex flex-col sm:flex-row justify-between items-center px-6 sm:px-12 gap-3" id="main-footer">
        <div>
          {/* FIXED: the genre is "Explorable Explanations" (Bret Victor, 2011), a
              term popularised by Nicky Case. The original said "Playable
              Explanations", which is not the established name. */}
          An <strong>Explorable Explanation</strong> in the tradition of Bret Victor and Nicky Case.
          Independent project, not affiliated with either. No trackers, no cookies.
        </div>
        <div className="font-mono text-[10px] text-stone-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Gray&ndash;Scott &amp; L-system engines</span>
        </div>
      </footer>

      {showExplanationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          id="info-modal-backdrop"
          onClick={() => setShowExplanationModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl relative"
            id="info-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="info-modal-title"
              className="text-xl font-bold text-stone-900 mb-3 flex items-center gap-2 font-sans"
            >
              <Dna className="w-5 h-5 text-emerald-500" />
              <span>What this simulates</span>
            </h3>

            <div className="text-xs sm:text-sm text-stone-600 flex flex-col gap-3.5 leading-relaxed overflow-y-auto max-h-[380px] pr-2">
              <p>
                Two different routes from simple local rules to complex global form, both running
                live in your browser.
              </p>

              <div className="border-l-2 border-amber-500 pl-3">
                <h4 className="font-bold text-stone-800">1. Reaction&ndash;diffusion</h4>
                <p className="text-xs mt-0.5">
                  Alan Turing argued in 1952 that a uniform mixture of two reacting, diffusing
                  chemicals can be <em>unstable</em> &mdash; so patterns appear without any
                  pre-existing map. This app runs the <strong>Gray&ndash;Scott</strong> variant:
                  activator <strong>B</strong> is autocatalytic, substrate <strong>A</strong> is
                  consumed and replenished, and because A spreads twice as fast as B, each blob
                  starves its own neighbourhood.
                </p>
                <p className="text-xs mt-1.5 text-stone-500 italic">
                  Note: Gray&ndash;Scott is <em>excitable</em>, not spontaneously unstable. It needs a
                  finite seed to start, unlike the linear instability Turing originally analysed.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3">
                <h4 className="font-bold text-stone-800">2. L-systems</h4>
                <p className="text-xs mt-0.5">
                  Aristid Lindenmayer introduced these in 1968 to describe filamentous algae. A
                  string is rewritten <em>in parallel</em> each generation, then read as drawing
                  instructions. The branching, plant-like interpretation came later, largely through
                  Prusinkiewicz &amp; Lindenmayer, <em>The Algorithmic Beauty of Plants</em> (1990).
                </p>
              </div>

              <p className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
                Everything here is a <strong>model</strong>. Reaction&ndash;diffusion is strong
                evidence-backed for zebrafish stripes and cat markings; for leopards and zebras it
                remains a well-motivated hypothesis. L-systems describe plant geometry beautifully
                but are not a claim about how DNA works.
              </p>
            </div>

            <button
              onClick={() => setShowExplanationModal(false)}
              className="mt-6 w-full py-2.5 bg-stone-900 hover:bg-stone-800 border-stone-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              id="close-modal-btn"
            >
              Start exploring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
