import React, { useState } from 'react';
import ChapterGuide from './components/ChapterGuide';
import { TuringParameters, LSystemParameters } from './types';
import { Dna, TreePine, HelpCircle, Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  // Initial parameters for 3D Turing Reaction-Diffusion sim
  const [turingParams, setTuringParams] = useState<TuringParameters>({
    feed: 0.035,
    kill: 0.062,
    diffuseA: 1.0,
    diffuseB: 0.5,
    timeStep: 1.0,
    brushSize: 4,
    brushType: 'addB',
    resolution: 128,
    meshType: 'sphere',
  });

  // Initial parameters for 3D L-Systems organic growth sim
  const [lsystemParams, setLsystemParams] = useState<LSystemParameters>({
    axiom: 'X',
    rules: [
      { from: 'X', to: 'F+[[X]-X]-F[-FX]+X' },
      { from: 'F', to: 'FF' }
    ],
    angle: 25,
    depth: 4,
    length: 0.15,
    lengthDecay: 0.82,
    width: 0.075,
    widthDecay: 0.72,
    colorTheme: 'forest',
  });

  const [showExplanationModal, setShowExplanationModal] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-800 font-sans flex flex-col relative selection:bg-amber-100 selection:text-stone-900" id="app-root-layout">
      {/* Dynamic graphic pattern banner */}
      <header className="border-b border-stone-200 bg-white/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4" id="main-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center text-white shadow-md animate-pulse-slow">
            <Dna className="w-5 h-5 text-emerald-400 rotate-12" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-stone-900 font-sans">Playable Morphogenesis</span>
              <span className="bg-emerald-500/10 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider font-sans">
                Active 3D Sandbox
              </span>
            </div>
            <h1 className="text-xs text-stone-400 font-mono">Self-Organized Biological Patterns</h1>
          </div>
        </div>

        {/* Dynamic header menus */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExplanationModal(true)}
            className="px-3.5 py-2 hover:bg-stone-50 border border-stone-200 text-stone-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all font-sans"
            id="how-it-works-btn"
          >
            <HelpCircle className="w-4 h-4 text-stone-400" />
            <span>How It Works</span>
          </button>

          <a
            href="https://ncase.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all font-sans"
            id="ncase-credit-btn"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Nicky Case Philosophy 🎨</span>
          </a>
        </div>
      </header>

      {/* Main Narrative & 3D Stage Section */}
      <main className="flex-1 w-full flex flex-col" id="app-main-stage">
        {/* Playable Chapter layout */}
        <ChapterGuide
          turingParams={turingParams}
          onChangeTuringParams={setTuringParams}
          lsystemParams={lsystemParams}
          onChangeLsystemParams={setLsystemParams}
        />
      </main>

      {/* Footer detailing project scope */}
      <footer className="border-t border-stone-200/60 bg-white/40 py-6 text-center text-xs text-stone-400 font-sans flex flex-col sm:flex-row justify-between items-center px-12 gap-3" id="main-footer">
        <div>
          Created in compliance with <strong>"Playable Explanations"</strong> paradigms. No trackers, no cookies.
        </div>
        <div className="font-mono text-[10px] text-stone-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Biological Physics Simulation Online</span>
        </div>
      </footer>

      {/* Interactive Didactic Modal Dialog */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm transition-all" id="info-modal-backdrop">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200" id="info-modal-card">
            <h3 className="text-xl font-bold text-stone-900 mb-3 flex items-center gap-2 font-sans">
              <Dna className="w-5 h-5 text-emerald-500" />
              <span>Morphogenetic Emergence Explained</span>
            </h3>

            <div className="text-xs sm:text-sm text-stone-600 flex flex-col gap-3.5 leading-relaxed overflow-y-auto max-h-[380px] pr-2">
              <p>
                This app is an interactive, playful medium showing how complex life shapes organize themselves.
                We explore two main avenues:
              </p>

              <div className="border-l-2 border-amber-500 pl-3">
                <h4 className="font-bold text-stone-800">1. Chemical Self-Organization (Turing patterns):</h4>
                <p className="text-xs mt-0.5">
                  Proposed by Alan Turing in 1952. Two reacting compounds with differing diffusion rates
                  spontaneously break flat uniform symmetry and form highly defined leopard spots and zebra stripes.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3">
                <h4 className="font-bold text-stone-800">2. Structural Morphogenesis (L-Systems):</h4>
                <p className="text-xs mt-0.5">
                  Developed by Aristid Lindenmayer in 1968. Shows how branching skeletons and plants form, by
                  interpreting simple, repeating alphanumeric strings as organic geometry.
                </p>
              </div>

              <p className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs italic">
                Following Nicky Case's philosophy of education, we empower active learning through tactile actions! 
                Instead of dry equations, we put parameters, paintbrushes, and grow-timeline sliders directly in your hands.
              </p>
            </div>

            <button
              onClick={() => setShowExplanationModal(false)}
              className="mt-6 w-full py-2.5 bg-stone-900 hover:bg-stone-800 border-stone-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              id="close-modal-btn"
            >
              Start Exploring!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
