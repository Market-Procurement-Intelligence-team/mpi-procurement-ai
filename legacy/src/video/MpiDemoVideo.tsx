import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const MpiDemoVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // TIMING MARKS (at 30 fps, total 510 frames = 17.0s)
  // Scene 1: 0 - 90 frames (0.0s - 3.0s)
  // Scene 2: 90 - 180 frames (3.0s - 6.0s)
  // Scene 3: 180 - 300 frames (6.0s - 10.0s)
  // Scene 4: 300 - 390 frames (10.0s - 13.0s)
  // Scene 5: 390 - 510 frames (13.0s - 17.0s)

  // TYPEWRITER ANIMATION (Scene 1)
  const promptText =
    'Need 500 custom rigid printed boxes for our D2C organic skincare launch by next month, budget under ₹80k with EVA foam insert.';
  const charsTyped = Math.floor(
    interpolate(frame, [10, 65], [0, promptText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const displayedPrompt = promptText.slice(0, charsTyped);

  // SCENE TRANSITION OPACITIES
  const s1Opacity = interpolate(frame, [0, 10, 80, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s2Opacity = interpolate(frame, [88, 98, 170, 180], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s3Opacity = interpolate(frame, [178, 188, 290, 300], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s4Opacity = interpolate(frame, [298, 308, 380, 390], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s5Opacity = interpolate(frame, [388, 400, 500, 510], [0, 1, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // COUNTER PROGRESS (Scene 3)
  const factoryCount = Math.floor(
    interpolate(frame, [190, 240], [1240, 3], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <AbsoluteFill className="bg-[#051F16] font-sans text-[#0F172A] overflow-hidden select-none">
      {/* BACKGROUND ATMOSPHERIC RADIAL GLOWS */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(163,246,92,0.18) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(163,246,92,0.12) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* TOP HEADER STATUS BAR */}
      <div className="absolute top-0 left-0 right-0 h-16 border-b border-white/10 px-10 flex items-center justify-between z-50 bg-[#051F16]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#A3F65C] flex items-center justify-center font-black text-[#051F16] text-sm">
            M
          </div>
          <span className="font-bold text-white text-lg tracking-tight">MPI</span>
          <span className="text-white/40 text-xs">/</span>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            INTELLIGENCE OS v4.2
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#A3F65C] animate-pulse" />
            1,240 FACTORIES CONNECTED
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENE 1: STARTUP NATURAL LANGUAGE INTAKE (0.0s - 3.0s) */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 pt-24 px-20 flex flex-col items-center justify-center"
        style={{ opacity: s1Opacity }}
      >
        <div className="w-full max-w-4xl bg-white rounded-3xl p-10 shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-800 uppercase bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Step 1 of 7 • Plain-Language Intake
              </span>
              <h1 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
                Tell MPI what you need.
              </h1>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">
                Packaging Sample ✓
              </span>
              <span className="text-xs bg-slate-50 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-100">
                Drone CNC Sample
              </span>
            </div>
          </div>

          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border-2 border-emerald-500/40 min-h-[140px] relative shadow-inner">
            <p className="text-xl font-medium text-slate-800 leading-relaxed font-mono">
              {displayedPrompt}
              <span className="inline-block w-2.5 h-6 bg-[#A3F65C] ml-1.5 animate-pulse align-middle" />
            </p>
            <div className="absolute bottom-4 right-6 text-xs font-mono text-slate-400">
              {charsTyped} characters entered • Auto-BOM Active
            </div>
          </div>

          <div className="mt-8 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Plain descriptions parsed into production engineering tolerances automatically.
            </span>
            <button className="bg-[#083A28] text-white font-semibold text-sm px-7 py-3.5 rounded-full flex items-center gap-2 shadow-lg">
              Analyze Requirement
              <ArrowRight className="w-4 h-4 text-[#A3F65C]" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENE 2: AI SPECIFICATION & BOM DECONSTRUCTION (3.0s - 6.0s) */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 pt-24 px-20 flex flex-col items-center justify-center"
        style={{ opacity: s2Opacity }}
      >
        <div className="w-full max-w-4xl bg-white rounded-3xl p-10 shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-800 uppercase bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Step 2 of 7 • AI Specification Engine
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
                Deconstructing BOM & Tolerances
              </h2>
            </div>
            <span className="bg-[#A3F65C] text-[#051F16] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> 98% Confidence Match
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: 'MATERIAL GRADE', val: 'Rigid 1200 GSM Kappa Board' },
              { label: 'PRINT FINISH', val: '157 GSM Art Paper + Matte Scuff-Free Lamination' },
              { label: 'INTERNAL INSERT', val: 'Laser-Cut High Density EVA Foam (3 Contours)' },
              { label: 'COMMERCIAL BUDGET', val: '≤ ₹80,000 Target • 500 Units Total' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between"
              >
                <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                  {item.label}
                </span>
                <span className="text-base font-bold text-slate-800 mt-2">
                  {item.val}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center justify-between">
            <span className="text-xs font-mono text-emerald-900">
              SYNTHESIS PIPELINE: BOM EXTRACTION → MACHINE CONSTRAINT LOCK → RFQ READY
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700">
              LATENCY &lt; 240ms
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENE 3: CLUSTER FILTERING & ANONYMOUS MATCHING (6.0s - 10.0s) */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 pt-24 px-20 flex flex-col items-center justify-center"
        style={{ opacity: s3Opacity }}
      >
        <div className="w-full max-w-5xl bg-white rounded-3xl p-10 shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-800 uppercase bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Step 5 of 7 • Anonymous Capability Matching
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
                Vetted Supplier Discovery
              </h2>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-emerald-700 tabular-nums">
                {factoryCount}+
              </span>
              <span className="text-xs text-slate-400 block font-mono">
                Factories Screened
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-6">
            {[
              {
                id: 'MPI VERIFIED PARTNER #001',
                match: '98% Match',
                cluster: 'Cluster: West (Pune/Mumbai)',
                lead: '12 business days',
                best: true,
              },
              {
                id: 'MPI VERIFIED PARTNER #002',
                match: '92% Match',
                cluster: 'Cluster: West (Ahmedabad)',
                lead: '15 business days',
                best: false,
              },
              {
                id: 'MPI VERIFIED PARTNER #003',
                match: '88% Match',
                cluster: 'Cluster: South (Bengaluru)',
                lead: '8 business days',
                best: false,
              },
            ].map((sup, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl border flex flex-col justify-between ${
                  sup.best
                    ? 'border-2 border-[#A3F65C] bg-emerald-50/20 shadow-lg'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {sup.id}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#A3F65C] text-[#051F16]">
                      {sup.match}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {sup.cluster}
                  </span>
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ZED Gold Certified
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Idle Machine Slot Verified
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Lead: {sup.lead}
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Identity Shielded</span>
                  <button className="bg-[#083A28] text-white text-xs px-3.5 py-1.5 rounded-full font-semibold">
                    ✓ Shortlisted
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENE 4: COMMERCIAL BENCHMARK & REVERSE MARGIN (10.0s - 13.0s) */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 pt-24 px-20 flex flex-col items-center justify-center"
        style={{ opacity: s4Opacity }}
      >
        <div className="w-full max-w-4xl bg-white rounded-3xl p-10 shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-800 uppercase bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Step 6 of 7 • Commercial Intelligence
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
                Reverse-Margin Audit vs. Market
              </h2>
            </div>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold px-4 py-2 rounded-xl">
              Potential Savings: ₹26,250 (26%)
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 items-center">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs font-mono text-slate-400 block uppercase">
                Offline Distributor Benchmark
              </span>
              <span className="text-3xl font-bold text-slate-400 line-through mt-2 block">
                ₹1,01,250
              </span>
              <span className="text-xs text-slate-400 mt-2 block">
                Includes opaque markups & agent fees
              </span>
            </div>

            <div className="p-6 bg-emerald-50/60 rounded-2xl border-2 border-[#A3F65C] shadow-md">
              <span className="text-xs font-mono text-emerald-800 block uppercase font-bold">
                MPI Direct Factory Landed Cost
              </span>
              <span className="text-4xl font-extrabold text-[#083A28] mt-2 block tracking-tight">
                ₹75,000
              </span>
              <span className="text-xs font-semibold text-emerald-700 mt-2 block">
                Factory-floor unit pricing + GST Input Credit
              </span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between text-xs font-mono text-slate-500">
            <span>TOOLING: ₹6,000</span>
            <span>PRODUCTION: ₹55,000</span>
            <span>QA DROP TEST: ₹2,500</span>
            <span>LOGISTICS & GST: ₹11,500</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENE 5: PROTECTED PROCUREMENT & BRAND RESOLUTION (13.0s - 17.0s) */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-12 z-40"
        style={{ opacity: s5Opacity }}
      >
        <div className="flex gap-4 mb-8">
          {[
            '1. AI MATCHED',
            '2. CAPABILITY VERIFIED',
            '3. SAVINGS AUDITED',
            '4. ESCROW PROTECTED',
          ].map((tag, idx) => (
            <span
              key={idx}
              className="text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-emerald-950/80 border border-[#A3F65C]/40 text-[#A3F65C]"
            >
              ✓ {tag}
            </span>
          ))}
        </div>

        <h1 className="text-6xl font-black text-white tracking-tight">
          Procurement, <span className="italic font-serif font-normal text-[#A3F65C]">made intelligent.</span>
        </h1>
        <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto">
          From natural-language requirement to verified factory procurement in minutes.
        </p>

        <div className="mt-10">
          <button className="bg-[#A3F65C] text-[#051F16] font-bold text-base px-9 py-4 rounded-full flex items-center gap-3 shadow-[0_4px_30px_rgba(163,246,92,0.4)] hover:scale-105 transition-transform">
            Start with MPI
            <ArrowRight className="w-5 h-5 text-[#051F16]" />
          </button>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MpiDemoVideo;

