import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import emblemMask from "./mpi-emblem-mask.png";
import emblemBars from "./mpi-emblem-bars.png";
import emblemLighting from "./mpi-emblem-bars-light.png";
import textLayer from "./mpi-logo-text.png";
// Reduced motion: the dark static logo (MPI app change, 2 Nov 2026; was the white-background original).
import staticLogo from "../../../assets/brand/mpi-logo-dark.webp";
import staticSwirl from "../../../assets/brand/mpi-swirl-dark.webp";
import { DEFAULTS, createMpiEmblem, supportsCanvasEmblem } from "./mpiEmblemRenderer.js";
import "./MpiEmblemAnimation.css";

/*
 * MPI logo with a seamless brand-colour cycle across the radial bars.
 *
 * Built only from the original artwork (no redrawing):
 *   mpi-logo-text.png          original pixels, emblem area left white → wordmark untouched
 *   mpi-emblem-bars.png        the emblem's 114 bars, cut individually from the original
 *   mpi-emblem-bars-light.png  per-bar highlight/shading, faded in as a bar rises
 *   mpi-emblem-mask.png        the emblem's exact bar coverage (CSS fallback)
 *   mpi-logo-static.png        the untouched original (reduced-motion fallback)
 *
 * Orchestration — Motion for React:
 *   one motion value, `progress`, loops 0 → 1 (linear, repeat ∞) once per colour cycle.
 *   Every change is handed to the canvas renderer, which draws the whole frame from it:
 *   the colour wheel (orange → reddish orange → red → red-navy → navy → highlight → orange),
 *   each bar's elevation (transition lift + a ripple phased by the bar's index), the
 *   highlights/shading and the glow. Motion values don't re-render React, so the component
 *   renders only when the mode or visibility changes.
 *   useInView pauses the loop off screen; useReducedMotion shows the static original.
 *
 * Depth is simulated on a flat canvas (perspective-style lift, directional highlight/shading,
 * a soft plane shadow) — there is no 3D geometry.
 */

export default function MpiEmblemAnimation({
  className = "",
  duration = DEFAULTS.duration, // seconds per full colour cycle
  label = "MPI — Market Procurement Intelligence, since 2026",
  wordmark = true, // false: the animated swirl only, without the words underneath (MPI app, 2 Nov 2026)
}) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const emblemRef = useRef(null);
  const inView = useInView(ref);
  const [mode, setMode] = useState("pending"); // pending → canvas | css
  const progress = useMotionValue(0); // the single shared clock: 0 → 1 = one colour cycle

  // Create the canvas renderer once (per reduced-motion state).
  useEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    if (!supportsCanvasEmblem()) {
      setMode("css");
      return;
    }
    const emblem = createMpiEmblem(el, emblemBars, emblemLighting, { duration });
    emblemRef.current = emblem;
    emblem.ready.then(
      () => {
        if (emblemRef.current !== emblem) return; // replaced meanwhile (e.g. StrictMode re-run)
        emblem.renderProgress(progress.get());
        setMode("canvas");
      },
      () => emblemRef.current === emblem && setMode("css")
    );
    return () => {
      emblemRef.current = null;
      emblem.destroy();
    };
  }, [reduced, duration, progress]);

  // Every progress change → one frame. (No React state involved.)
  useMotionValueEvent(progress, "change", (p) => emblemRef.current?.renderProgress(p));

  // Run the loop only while the canvas is active and the logo is on screen.
  useEffect(() => {
    if (reduced || mode !== "canvas" || !inView) return;
    const from = progress.get() % 1; // resume where it paused — no jump
    const controls = animate(progress, [from, from + 1], {
      duration,
      ease: "linear",
      repeat: Infinity,
      repeatType: "loop",
    });
    return () => controls.stop();
  }, [reduced, mode, inView, duration, progress]);

  if (reduced) {
    return (
      <div className={`mpi-emblem ${wordmark ? "" : "mpi-emblem--no-wordmark"} ${className}`}>
        <img className="mpi-emblem__layer" style={{ objectFit: "contain" }} src={wordmark ? staticLogo : staticSwirl} alt={label} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`mpi-emblem ${wordmark ? "" : "mpi-emblem--no-wordmark"} ${mode === "pending" ? "is-pending" : mode === "canvas" ? "is-canvas" : ""} ${
        mode === "css" && !inView ? "is-paused" : ""
      } ${className}`}
      role="img"
      aria-label={label}
      style={{ "--mpi-cycle-duration": `${duration}s`, "--mpi-emblem-mask": `url(${emblemMask})` }}
    >
      {wordmark && <img className="mpi-emblem__layer mpi-emblem__layer--text" src={textLayer} alt="" aria-hidden="true" />}
      {/* CSS colour layer: shown until the canvas is ready, and as the fallback */}
      <div className="mpi-emblem__colour" aria-hidden="true">
        <div className="mpi-emblem__gradient" />
      </div>
    </div>
  );
}
