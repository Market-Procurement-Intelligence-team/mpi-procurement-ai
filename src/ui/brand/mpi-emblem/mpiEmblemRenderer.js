import { MPI_EMBLEM_BARS, MPI_EMBLEM_CENTRE } from "./mpiEmblemBars.js";

/*
 * Canvas renderer for the MPI emblem colour cycle.
 *
 * The 114 radial bars are the original artwork's pixels (cut from the emblem mask into
 * mpi-emblem-bars.png). Each frame:
 *   1. every bar gets an elevation (0 = flat in the logo plane, 1 = fully raised) from a
 *      profile that rotates exactly with the colour wheel, so a 3D wave rides on the
 *      colour transitions: bars rise as a transition reaches them and settle behind it;
 *   2. a raised bar is drawn as seen from slightly above: lifted toward the viewer
 *      (a small perspective enlargement about the emblem centre, so it stays on its own
 *      radius), with a faint soft shadow left on the logo plane beneath it;
 *   3. the brand colour wheel is painted into the bars (source-in);
 *   4. raised bars fade in their lighting (mpi-emblem-bars-light.png, baked by
 *      tools/build_bars.py): a highlight toward the edge facing the upper-left light, a touch
 *      on the face, gentle Navy 950 shading toward the far edge. Laid over the bar's current
 *      colour it becomes a lighter / deeper shade of that same colour;
 *   5. one half-resolution, softly blurred layer underneath holds the colour glow (the bars
 *      tinted with their own colours at low opacity) and the plane shadows.
 *
 * Dark-background presentation (added on top; the colour wheel, elevations and timing above are
 * untouched — every extra pass reuses the same bars, the same `start` rotation and the same STOPS):
 *   - an outer halo: a quarter-resolution, widely blurred layer beneath everything, filled with
 *     the wheel's own colours weighted by warmth (orange/red glow, navy contributes nothing);
 *   - a navy lift: a light wash painted only onto bars currently in the navy part of the wheel
 *     (source-atop), so navy strokes stay visible on the darker background;
 *   - a bloom: a half-resolution, medium-blur warm layer between the outer halo and the existing
 *     soft glow, so the orange/red lines read as luminous;
 *   - sparks: small warm glints that sit on the tips of lit orange/red bars and twinkle briefly.
 *     Each spark is a pure function of the same progress value (integer twinkle rates per cycle),
 *     so they loop seamlessly and never run on a clock of their own;
 *   - breathing: all bars glide outward along their own radii and back on one shared rhythm, each with
 *     a small fixed random variation in reach and timing (seeded, so every loop is identical) for an
 *     organic feel. A pure translation — length, width and angular spacing unchanged. An integer number
 *     of breaths per colour cycle keeps it locked to the colours and seamless. Bars that point toward
 *     the wordmark are capped so they never touch it;
 *   - compact centre: each bar is extended inward along its own axis (outer tip fixed, width kept),
 *     so the empty inner circle is smaller and the emblem denser.
 *     The per-bar positional lift of the 3D wave is switched off (liftMotion: 0) so no bar moves
 *     out of step; elevation still drives the highlights/shading, so the colour flow and lighting
 *     are unchanged;
 *   - sheen: a soft specular band laid onto the bars at the three colour transitions (riding with
 *     them), so the lit sections look polished rather than flat;
 *   - the plane shadow is drawn in a near-black navy instead of brand navy (which would read as a
 *     light ghost on a background darker than navy).
 *
 * Every frame is a pure function of one progress value p (0 → 1 = one colour cycle):
 * renderProgress(p). In React, Motion for React owns that value (see MpiEmblemAnimation.jsx);
 * the built-in play()/pause() clock is only for the plain-HTML embed. p and p + 1 draw the
 * same frame, so the loop is seamless. At elevation 0 a bar is exactly its original pixels.
 */

export const ART_W = 851; // artwork box (px) — same as the static logo
export const ART_H = 1094;
export const STAGE_H = 760; // emblem region drawn by the canvases (bars end at ~745 incl. lift)
const PAD = 40; // extra drawing room around the artwork so lifted bars are never clipped
const OPENING_R = 150; // radius of the emblem's white centre (kept untouched)

// Colour wheel (degrees clockwise from 12 o'clock, aligned to the original artwork),
// identical to the CSS version. `glow` is the halo opacity at that angle:
// strongest in transitions, softer on settled colours, almost none on navy.
const WHEEL = [
  { deg: 0, hex: "#f09a47", glow: 0.2 },
  { deg: 45, hex: "#f09a47", glow: 0.22 },
  { deg: 75, hex: "#f09a47", glow: 0.42 },
  { deg: 105, hex: "#db4230", glow: 0.32 },
  { deg: 182, hex: "#db4230", glow: 0.22 },
  { deg: 200, hex: "#7a2f38", glow: 0.2 },
  { deg: 216, hex: "#15233d", glow: 0.04 },
  { deg: 298, hex: "#15233d", glow: 0.04 },
  { deg: 312, hex: "#5f6b7c", glow: 0.22 },
  { deg: 328, hex: "#f09a47", glow: 0.38 },
  { deg: 360, hex: "#f09a47", glow: 0.2 },
];

// Same wheel, but navy → orange runs through brand red-navy and transition orange instead of the
// blue-grey highlight, so there is no white/grey fade at the end of the navy segment.
// (Used by default; pass { legacyWheel: true } for the original stops.)
// Brand navy #15233D as it must read on the #0D1729 background: brand navy lifted 30% toward a
// light brand blue (84,124,210). This used to be painted as a separate wash over the bars; it is now
// the navy stop itself, so the blends into red and orange interpolate from the colour actually shown.
const NAVY_ON_DARK = "#283e6a";
// Segment boundaries (wheel degrees, centre of each colour blend) — used by the segment waves.
const SEGMENTS = [
  { name: "orange", from: 318, to: 435 }, // wraps through 0°
  { name: "red", from: 75, to: 200 },
  { name: "navy", from: 200, to: 318 },
];

// Navy holds its blue across 210°–300°; the blue ↔ red hue change happens over a short span on each
// side (≈12°), with the warm side eased through red-navy and transition orange.
const WHEEL_DIRECT = [
  ...WHEEL.slice(0, 3), // orange base: 0 … 75° unchanged
  { deg: 87, hex: "#e8703a", glow: 0.42 }, // ultra-narrow orange → red-orange blend
  { deg: 90, hex: "#db4230", glow: 0.32 }, // narrow red-orange → red blend
  { deg: 182, hex: "#db4230", glow: 0.22 },
  { deg: 198, hex: "#db4230", glow: 0.2 },
  { deg: 204, hex: NAVY_ON_DARK, glow: 0.04 }, // navy is fully blue from the segment boundary …
  { deg: 306, hex: NAVY_ON_DARK, glow: 0.04 }, // … to the final short transition
  { deg: 312, hex: "#5f6b7c", glow: 0.2 },
  { deg: 318, hex: "#f09a47", glow: 0.38 },
  { deg: 336, hex: "#f09a47", glow: 0.3 },
  { deg: 360, hex: "#f09a47", glow: 0.2 },
];

// 3D wave: elevation bumps centred on the wheel's three colour transitions
// (same angle system as WHEEL, so they travel with the colours).
const LIFT_BUMPS = [
  { deg: 75, halfWidth: 52, height: 1.0 }, // orange → reddish orange → red
  { deg: 199, halfWidth: 40, height: 0.8 }, // red → red-navy → navy
  { deg: 314, halfWidth: 40, height: 0.9 }, // navy → highlight → orange
];
const LIFT_BASE = 0.04; // settled bars rest almost flat

// Index-phased ripple: bar i (bars are ordered clockwise) is offset by i × RIPPLE_STEP of a wave.
// RIPPLE_WAVES crests per cycle with RIPPLE_WAVES / 114 per bar means each crest travels once
// around the emblem per cycle — anticlockwise, with the colours — so neighbouring bars rise and
// fall progressively and the ripple stays locked to the colour transitions.
const RIPPLE_WAVES = 3;
const RIPPLE_HEIGHT = 0.6; // elevation the travelling wave gives every bar (transitions lift up to 1)

// Sparks: deterministic glints on chosen bars. `t` = position along the bar (1 = outer tip),
// `k` = twinkles per colour cycle (integer → seamless loop), `ph` = phase, `r` = halo radius (art px).
const SPARKS = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const out = [];
  for (let i = 0; i < 26; i++) {
    out.push({
      bar: Math.floor(rnd() * 114),
      t: i % 4 === 3 ? 0.04 + rnd() * 0.1 : 0.82 + rnd() * 0.2, // mostly outer tips, a few inner ends
      k: 1 + Math.floor(rnd() * 3),
      ph: rnd(),
      r: i % 3 === 0 ? 15 + rnd() * 7 : 6 + rnd() * 4, // a few larger glints, the rest fine specks
    });
  }
  return out;
})();

export const DEFAULTS = {
  duration: 7.2, // s per colour cycle (was 8.5 s → ~18% faster)
  lift: 0.06, // perspective lift at full elevation: 6% (≈ 24 px at the 407 px outer radius)
  lighting: 1, // strength of the baked highlight/shading on raised bars (0 = off)
  shadow: 0.24, // max opacity of the soft shadow on the logo plane
  shadowOffset: 10, // px of artwork the shadow falls away from the light at full elevation
  glow: 0.7, // glow strength multiplier (0 = off)
  glowBlur: 0.009, // blur radius as a fraction of the rendered width
  // Dark-background presentation (see header). Set outerGlow / navyLift to 0 to switch them off.
  outerGlow: 0.8, // max opacity of the outer halo (on fully warm colours)
  outerGlowBlur: 0.042, // outer halo blur radius as a fraction of the rendered width
  bloom: 0.34, // max opacity of the bloom layer (on fully warm colours)
  bloomBlur: 0.02, // bloom blur radius as a fraction of the rendered width
  sparks: 1, // spark strength (0 = off)
  breathe: 22, // breathing: max outward glide of the bar tips along their radii (artwork px; 0 = off)
  breathsPerCycle: 2, // breaths per colour cycle (integer → seamless loop; 2 = one breath every 3.6 s)
  breatheVariation: 0, // per-bar random spread of reach (0 = all identical, e.g. 0.2 = ±20%)
  breatheInnerFollow: 1, // how much of the tips' outward glide the inner ends follow (1 = whole bar slides;
  // lower keeps the centre compact while the tips protrude — the bar extends along its axis, width unchanged)
  breatheJitter: 0, // per-bar timing offset as a fraction of one breath (0 = all in step, 0.5 = fully independent bars)
  innerInset: 60, // how far the bars' inner ends move toward the centre (artwork px; 0 = original circle)
  liftMotion: 0, // positional part of the 3D wave's lift (1 = original staggered outward lift, 0 = none)
  sheen: 0, // strength of the specular band at the colour transitions (0 = off)
  edgeSharpen: 2.2, // steepness of the bars' anti-aliased edge (1 = as cut from the artwork, 0 = off).
  // The ramp pivots on 50% coverage, so bar widths are unchanged — only the soft fringe tightens.
  saturation: 1.35, // colour punch on the bars (1 = as the wheel paints them)
  contrast: 1.15, // contrast on the bars (1 = unchanged) …
  contrastPivot: 0.32, // … pivoting on a dark-mid value, so navy deepens in hue without sinking into the background
  navyLift: 0.16, // extra light wash on navy bars (0: the navy stop NAVY_ON_DARK already carries the lift)
  navyLiftColour: "150, 166, 198", // rgb of that wash (a light tint of brand navy)
  navyGloss: 0, // glossy specular band across the navy bars (0 = off)
  navyGlossColour: "196, 214, 248", // rgb of that band (a bright tint of brand navy)
  navyGlow: 0.3, // luminous halo around navy bars in the bloom / outer glow layers (0 = off)
  navyLighting: 1, // highlight strength on navy bars relative to the others (1 = same; lower keeps navy deep, not shiny)
  navyShade: 0, // blue-toned version of the bars' 3D shading, used on navy instead of the white one (0 = off)
  navyShadeColour: "#7aa2ec", // tint of that shading's highlights (a light brand-navy blue)
  navySheen: 1, // specular sheen on navy bars relative to the others (0 = none, 1 = same)
  navyGlowColour: "64, 96, 168", // rgb of that halo (brand navy, lifted)
  legacyWheel: false, // true = original wheel with the blue-grey highlight between navy and orange
  keyline: 0, // dark keyline around every bar (artwork px) so glow never softens edges or fills the gaps (0 = off)
  keylineColour: "#0d1729", // = page background
  zoneWave: 0, // segment waves: max outward glide (artwork px; 0 = off)
  zoneWaveWidth: 0.34, // crest width as a fraction of its segment
  zoneWavesPerCycle: 2, // crests per segment per colour cycle (integer → seamless loop)
  ripple: "travelling", // 3D elevation wave: "segment" (confined to each colour segment) or "travelling" (original)
  shadowColour: "#04080f", // plane shadow tint (was brand navy #15233d on the white background)
};

// ---- colour helpers: interpolate in OKLab, like the CSS `in oklab` gradient ----
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToOklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToRgb([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.round(255 * Math.min(1, Math.max(0, toSrgb(Math.max(0, c))))));
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Sheen profile in wheel angles (every 2°): a soft band centred on each colour transition.
const SHEEN_HALF = 16;
const SHEEN = (() => {
  const out = [];
  for (let d = 0; d <= 360; d += 2) {
    let a = 0;
    for (const b of [{ deg: 75, h: 1 }, { deg: 199, h: 0.55 }, { deg: 314, h: 0.85 }]) {
      const dist = Math.abs((((d - b.deg) % 360) + 540) % 360 - 180);
      if (dist < SHEEN_HALF) a = Math.max(a, b.h * Math.cos((Math.PI / 2) * (dist / SHEEN_HALF)) ** 2);
    }
    out.push({ offset: d / 360, a });
  }
  return out;
})();

// Dense stop list (every 4°) so canvas sRGB interpolation matches OKLab blending.
const smooth01 = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const navySegment = (deg) => smooth01((deg - 184) / 30) * (1 - smooth01((deg - 300) / 34));

const buildStops = (WHEEL, legacyNavyWeight = false) => {
  const labs = WHEEL.map((w) => hexToOklab(w.hex));
  const out = [];
  for (let d = 0; d <= 360; d += 4) {
    let i = 0;
    while (WHEEL[i + 1].deg < d) i++;
    const a = WHEEL[i], b = WHEEL[i + 1];
    const t = (d - a.deg) / (b.deg - a.deg || 1);
    const lab = labs[i].map((v, k) => v + (labs[i + 1][k] - v) * t);
    const chroma = Math.hypot(lab[1], lab[2]);
    out.push({
      offset: d / 360,
      rgb: oklabToRgb(lab).join(","),
      glow: a.glow + (b.glow - a.glow) * t,
      // Derived weights for the dark-background passes (read-only use of the same colour):
      // warmth 1 on orange/red, ~0 on navy and the blue-grey highlight; navy 1 on navy only.
      warm: clamp01((chroma - 0.06) / 0.08) * clamp01((lab[0] - 0.35) / 0.25),
      // navy weight = how *blue* the colour is (OKLab b < 0), not how dark: the dark red-navy blend
      // colours get ~0, so the navy lift, blue shading and blue glow never tint them purple/pink.
      navy: legacyNavyWeight ? clamp01((0.42 - lab[0]) / 0.12) : clamp01((-lab[2] - 0.012) / 0.03) * clamp01((0.45 - lab[0]) / 0.1),
      // Navy *segment* membership by wheel angle — covers the whole segment including its final
      // bars at the navy → orange transition (where the colour is no longer dark, so `navy` above
      // is ~0). 1 from 214° to 300°, easing in over the red → navy blend and out over the navy → orange one.
      seg: navySegment(d),
    });
  }
  return out;
};
const STOPS_LEGACY = buildStops(WHEEL, true);
const STOPS_DIRECT = buildStops(WHEEL_DIRECT);

// Elevation at wheel angle `deg` (smooth raised-cosine bumps, wraps at 360°).
function elevationAt(deg) {
  let e = LIFT_BASE;
  for (const b of LIFT_BUMPS) {
    let d = Math.abs((((deg - b.deg) % 360) + 540) % 360 - 180);
    if (d < b.halfWidth) e = Math.max(e, b.height * 0.5 * (1 + Math.cos((Math.PI * d) / b.halfWidth)));
  }
  return e;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// A recoloured copy of an image, returned as a decoded image (much cheaper to draw from
// every frame than a canvas).
async function tinted(img, colour) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r));
  if (!blob) return c;
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A copy of an image with its colours multiplied by `colour` (white → colour, dark stays dark),
// alpha unchanged — turns the white highlights of the lighting atlas into blue ones.
async function multiplyTint(img, colour) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r));
  if (!blob) return c;
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function supportsCanvasEmblem() {
  try {
    return typeof document.createElement("canvas").getContext("2d").createConicGradient === "function";
  } catch {
    return false;
  }
}

/**
 * Attach the animated emblem to `container` (a .mpi-emblem element).
 * `atlasUrl` = mpi-emblem-bars.png, `lightingUrl` = mpi-emblem-bars-light.png.
 * Returns { ready, renderProgress(p), play(), pause(), seek(seconds), time(), destroy() }.
 * The instance is also exposed as `container.mpiEmblem` (handy for syncing or testing).
 */
export function createMpiEmblem(container, atlasUrl, lightingUrl, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const STOPS = o.legacyWheel ? STOPS_LEGACY : STOPS_DIRECT;
  const [CX, CY] = MPI_EMBLEM_CENTRE;
  const LX = -0.55, LY = -0.835; // toward the light (upper left)
  const bars = MPI_EMBLEM_BARS.map(([x, y, w, h, ax, ay, angle, light]) => ({
    x, y, w, h, ax, ay, light,
    wheelDeg: (angle + 90) % 360, // clockwise from 12 o'clock, like WHEEL
    e: 0,
    br: 0, // breathing offset (artwork px)
    // radial extent along the bar's direction (for spark placement only)
    ...(() => {
      const dx = Math.cos((angle * Math.PI) / 180), dy = Math.sin((angle * Math.PI) / 180);
      const d = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => (px - CX) * dx + (py - CY) * dy);
      return { dx, dy, r0: Math.max(OPENING_R, Math.min(...d)), r1: Math.max(...d) };
    })(),
  }));

  const make = (cls) => {
    const c = document.createElement("canvas");
    if (cls) {
      c.className = cls;
      c.setAttribute("aria-hidden", "true");
    }
    return c;
  };
  const outerCanvas = make("mpi-emblem__canvas mpi-emblem__canvas--soft"); // outer halo (dark background)
  const bloomCanvas = make("mpi-emblem__canvas mpi-emblem__canvas--soft"); // bloom (dark background)
  const sparkCanvas = make("mpi-emblem__canvas mpi-emblem__canvas--spark"); // glints, on top
  const softCanvas = make("mpi-emblem__canvas mpi-emblem__canvas--soft"); // glow + plane shadow
  const keyCanvas = make("mpi-emblem__canvas"); // dark keyline around each bar, between glow and bars
  const mainCanvas = make("mpi-emblem__canvas");
  const lightCanvas = make("mpi-emblem__canvas"); // lighting of raised bars, stacked on top
  const octx = outerCanvas.getContext("2d");
  const glossCanvas = document.createElement("canvas"); // offscreen: navy gloss, laid onto the bars
  const gctx = glossCanvas.getContext("2d");
  const bctx = bloomCanvas.getContext("2d");
  const kctx = sparkCanvas.getContext("2d");
  const sctx = softCanvas.getContext("2d");
  const kyctx = keyCanvas.getContext("2d");

  // Bar-layer filter (bars + their lighting only; glow layers and the wheel maths are untouched):
  //   - crisp edges: steepens the anti-aliased fringe around 50% coverage (widths unchanged);
  //   - colour punch: saturation, then contrast pivoted low so navy stays clear of the background.
  let crispSvg = null;
  const punch = o.saturation !== 1 || o.contrast !== 1;
  if (o.edgeSharpen > 1 || punch) {
    const id = `mpi-emblem-crisp-${Math.random().toString(36).slice(2, 9)}`;
    const k = Math.max(1, o.edgeSharpen);
    const c = o.contrast, pivot = o.contrastPivot;
    const rgb = `type="linear" slope="${c}" intercept="${(pivot - pivot * c).toFixed(4)}"`;
    crispSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    crispSvg.setAttribute("aria-hidden", "true");
    crispSvg.setAttribute("width", "0");
    crispSvg.setAttribute("height", "0");
    crispSvg.style.position = "absolute";
    crispSvg.innerHTML = `<filter id="${id}" color-interpolation-filters="sRGB">` +
      `<feComponentTransfer><feFuncA type="linear" slope="${k}" intercept="${(0.5 - 0.5 * k).toFixed(3)}"/></feComponentTransfer>` +
      (punch
        ? `<feColorMatrix type="saturate" values="${o.saturation}"/>` +
          `<feComponentTransfer><feFuncR ${rgb}/><feFuncG ${rgb}/><feFuncB ${rgb}/></feComponentTransfer>`
        : "") +
      `</filter>`;
    mainCanvas.style.filter = `url(#${id})`;
  }

  const mctx = mainCanvas.getContext("2d");
  const lctx = lightCanvas.getContext("2d");

  let atlas = null;
  let lighting = null; // per-bar lighting at full elevation (same layout as the bar atlas)
  let blueLighting = null; // the same lighting in blue tones (highlights blue, shading dark) for navy
  let shadowAtlas = null;
  let keyAtlas = null; // the bar atlas in the keyline colour // the bar atlas in navy, made once at load
  let raf = 0;
  let playing = false;
  let elapsed = 0; // seconds of animation shown so far (survives pause/resume)
  let last = 0;
  let destroyed = false;
  let loaded = false; // every image ready — only then may a frame be drawn

  // Canvases cover the artwork plus PAD on the left, top and right (bars lift outward).
  const SPAN_W = ART_W + 2 * PAD, SPAN_H = STAGE_H + PAD;
  for (const c of [outerCanvas, bloomCanvas, softCanvas, keyCanvas, mainCanvas, lightCanvas, sparkCanvas]) {
    Object.assign(c.style, {
      left: `${(-PAD / ART_W) * 100}%`,
      width: `${(SPAN_W / ART_W) * 100}%`,
      marginTop: `${(-PAD / ART_W) * 100}%`, // % margins are relative to width
      aspectRatio: `${SPAN_W} / ${SPAN_H}`,
    });
  }

  function resize() {
    const cssW = container.clientWidth || ART_W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round((cssW * dpr * SPAN_W) / ART_W);
    const h = Math.round((w * SPAN_H) / SPAN_W);
    if (mainCanvas.width !== w) {
      for (const c of [mainCanvas, lightCanvas, sparkCanvas, glossCanvas, keyCanvas]) {
        c.width = w;
        c.height = h;
      }
      softCanvas.width = Math.round(w / 2);
      softCanvas.height = Math.round(h / 2);
      outerCanvas.width = Math.round(w / 4);
      outerCanvas.height = Math.round(h / 4);
      bloomCanvas.width = Math.round(w / 2);
      bloomCanvas.height = Math.round(h / 2);
    }
    bloomCanvas.style.filter = `blur(${Math.max(1, cssW * o.bloomBlur).toFixed(2)}px)`;
    softCanvas.style.filter = `blur(${Math.max(1, cssW * o.glowBlur).toFixed(2)}px)`;
    outerCanvas.style.filter = `blur(${Math.max(2, cssW * o.outerGlowBlur).toFixed(2)}px)`;
  }

  // Prepare a context in artwork coordinates.
  function begin(ctx, canvas) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width / SPAN_W;
    ctx.setTransform(s, 0, 0, s, PAD * s, PAD * s); // artwork coordinates, shifted by PAD
  }

  // Draw one bar lifted by elevation e: enlarged about the emblem centre (perspective).
  function drawBar(ctx, img, b, e, sy = 0) {
    const k = 1 + o.lift * o.liftMotion * e;
    const ox = b.dx * b.br, oy = b.dy * b.br; // breathing glide along the bar's own radius
    const draw = () =>
      ctx.drawImage(img, b.ax, b.ay + sy, b.w, b.h, CX + (b.x - CX) * k + ox, CY + (b.y - CY) * k + oy, b.w * k, b.h * k);
    if (b.stretch === 1) return draw();
    withStretch(ctx, b, k * b.r1 + b.br, draw);
  }

  // Extend a bar inward along its own axis: scale by b.stretch about its outer tip (at radius tipR).
  function withStretch(ctx, b, tipR, draw) {
    const tx = CX + b.dx * tipR, ty = CY + b.dy * tipR;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(b.ang);
    ctx.scale(b.stretch, 1);
    ctx.rotate(-b.ang);
    ctx.translate(-tx, -ty);
    draw();
    ctx.restore();
  }

  // Glow fill: warm sections take their own wheel colour (as before); navy sections take a lifted
  // navy halo. With navyGlow 0 this is exactly fillWheel(…, st.warm * warmA).
  function fillGlow(ctx, start, warmA, navyA) {
    if (!(navyA > 0)) return fillWheel(ctx, start, "rgb", (st) => st.warm * warmA);
    ctx.globalCompositeOperation = "source-in";
    ctx.globalAlpha = 1;
    const grad = ctx.createConicGradient(start, CX, CY);
    const nc = o.navyGlowColour.split(",").map(Number);
    for (const st of STOPS) {
      const w = st.warm * warmA, n = st.navy * navyA, a = w + n;
      const wc = st.rgb.split(",").map(Number);
      const rgb = a > 0 ? wc.map((v, i) => Math.round((v * w + nc[i] * n) / a)).join(",") : st.rgb;
      grad.addColorStop(st.offset, `rgba(${rgb},${Math.min(1, a).toFixed(3)})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
  }

  function fillWheel(ctx, start, key, alphaFn) {
    ctx.globalCompositeOperation = "source-in";
    ctx.globalAlpha = 1;
    const grad = ctx.createConicGradient(start, CX, CY);
    for (const st of STOPS) {
      grad.addColorStop(st.offset, alphaFn ? `rgba(${st[key]},${alphaFn(st).toFixed(3)})` : `rgb(${st[key]})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
  }

  const RIPPLE_STEP = RIPPLE_WAVES / bars.length;

  // Per-bar breathing variation (seeded → identical every loop) and the clearance that keeps
  // downward-pointing bars off the wordmark (text starts at y ≈ 748 in artwork px).
  {
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const TEXT_TOP = 736; // keep bar tips (and their glow core) above this line
    for (const b of bars) {
      b.amp = 1 + o.breatheVariation * (2 * rnd() - 1);
      b.jit = o.breatheJitter * (2 * rnd() - 1);
      if (b.dy > 0.05 && o.breathe > 0) {
        const clearance = (TEXT_TOP - (b.y + b.h)) / b.dy; // px of outward glide available
        b.amp = Math.min(b.amp, Math.max(0, clearance / o.breathe));
      }
      b.cap = b.dy > 0.05 ? Math.max(0, (TEXT_TOP - (b.y + b.h)) / b.dy) : Infinity; // keep off the wordmark
      b.len = b.r1 - b.r0;
      b.stretch = 1; // per frame: inward extension + breathing extension, along the bar's axis
      b.ang = Math.atan2(b.dy, b.dx);
    }
  }
  const INNER_R = OPENING_R - o.innerInset;
  let progress = 0;

  function render() {
    const phase = ((progress % 1) + 1) % 1; // 0 → 1 over one colour cycle
    const start = -Math.PI / 2 - 2 * Math.PI * phase; // wheel rotation (canvas 0 rad = 3 o'clock)
    // Segment waves: the wheel is split at its three colour blends into the orange, red and navy
    // segments (they ride with the colours). In each segment a crest starts at the segment's own
    // start, travels through it, leaves at its far boundary and restarts there — it never reaches a
    // neighbouring segment. Integer crests per cycle keep the loop seamless. The same crest drives
    // both the bars' outward glide and their 3D elevation (highlights), so nothing else travels
    // around the whole emblem.
    const W = o.zoneWaveWidth;
    const crest = -W + (1 + 2 * W) * ((o.zoneWavesPerCycle * phase) % 1);
    const edge = (v) => smooth01(v / 0.12);
    bars.forEach((b, i) => {
      const d = (((b.wheelDeg + 360 * phase) % 360) + 360) % 360;
      b.zone = 0; // 0 … 1 crest profile within this bar's segment
      for (const z of SEGMENTS) {
        const dd = d < z.from && z.to > 360 ? d + 360 : d;
        if (dd >= z.from && dd < z.to) {
          const u = (dd - z.from) / (z.to - z.from); // 0 at the segment's start, 1 at its end
          const x = (u - crest) / W;
          if (Math.abs(x) < 1) b.zone = 0.5 * (1 + Math.cos(Math.PI * x)) * edge(u) * edge(1 - u);
          b.segment = z.name;
          b.u = u;
          break;
        }
      }
      const lift = elevationAt(b.wheelDeg + 360 * phase); // rides with the colour transitions
      const wave = o.ripple === "travelling"
        ? RIPPLE_HEIGHT * (0.5 - 0.5 * Math.cos(2 * Math.PI * (RIPPLE_WAVES * phase + i * RIPPLE_STEP)))
        : RIPPLE_HEIGHT * b.zone;
      b.e = wave + (1 - wave) * lift;
    });
    // Breathing: one shared rhythm; each bar's reach and timing vary slightly (fixed per bar).
    const breath = o.breathe * (0.5 - 0.5 * Math.cos(2 * Math.PI * o.breathsPerCycle * phase));
    for (const b of bars) {
      const zw = o.zoneWave * b.zone; // segment wave glide
      b.br = o.breathe * b.amp * (0.5 - 0.5 * Math.cos(2 * Math.PI * (o.breathsPerCycle * phase + b.jit)));
      b.br = Math.min(b.br + zw, b.cap);
      // tip moves out by br; inner end sits innerInset closer to the centre and follows only part of br
      const extra = o.innerInset + (1 - o.breatheInnerFollow) * b.br;
      b.stretch = extra !== 0 ? (b.len + extra) / b.len : 1;
    }

    // Outer halo (beneath everything): same bars, same wheel rotation, warm colours only.
    begin(octx, outerCanvas);
    if (o.outerGlow > 0) {
      for (const b of bars) drawBar(octx, atlas, b, b.e);
      fillGlow(octx, start, o.outerGlow, o.navyGlow * 0.6);
    }

    // Bloom: tighter warm glow, same bars and wheel.
    begin(bctx, bloomCanvas);
    if (o.bloom > 0) {
      for (const b of bars) drawBar(bctx, atlas, b, b.e);
      fillGlow(bctx, start, o.bloom, o.navyGlow);
    }

    // Soft layer: colour glow from the lifted bars, then the plane shadow beneath it
    // (never inside the white centre).
    begin(sctx, softCanvas);
    if (o.glow > 0) {
      for (const b of bars) drawBar(sctx, atlas, b, b.e);
      fillWheel(sctx, start, "rgb", (st) => st.glow * o.glow);
    }
    if (o.shadow > 0) {
      sctx.globalCompositeOperation = "destination-over";
      for (const b of bars) {
        if (b.e < 0.12) continue; // too low to cast a visible shadow
        sctx.globalAlpha = o.shadow * b.e;
        const off = -o.shadowOffset * b.e;
        const sx = LX * off + b.dx * b.br, sy = LY * off + b.dy * b.br;
        const drawShadow = () => sctx.drawImage(shadowAtlas, b.ax, b.ay, b.w, b.h, b.x + sx, b.y + sy, b.w, b.h);
        if (b.stretch === 1) drawShadow();
        else withStretch(sctx, b, b.r1 + b.br, () => drawShadow());
      }
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "destination-out";
      sctx.beginPath();
      sctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
      sctx.fill();
    }

    // Keyline: each bar's silhouette in the background colour, nudged ±keyline px sideways (across
    // the bar, not along it) under the bars — a crisp dark border on the long edges, so the glow
    // beneath never softens an edge or fills the gap between bars, and the ends stay untouched.
    begin(kyctx, keyCanvas);
    if (o.keyline > 0 && keyAtlas) {
      for (const b of bars) {
        for (const sgn of [1, -1, 0.5, -0.5]) {
          const kl = o.keyline * sgn;
          kyctx.save();
          kyctx.translate(-b.dy * kl, b.dx * kl);
          drawBar(kyctx, keyAtlas, b, b.e);
          kyctx.restore();
        }
      }
      // Near the centre the bars almost touch and the keylines would merge into a dark ring — fade
      // them out there (the bars stay sharp regardless: the edge filter is on the bar layer).
      kyctx.globalCompositeOperation = "destination-out";
      const fade = kyctx.createRadialGradient(CX, CY, INNER_R, CX, CY, INNER_R + 70);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(0.35, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      kyctx.fillStyle = fade;
      kyctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
      kyctx.globalCompositeOperation = "source-over";
    }

    // Bars in their brand colours …
    begin(mctx, mainCanvas);
    for (const b of bars) drawBar(mctx, atlas, b, b.e);
    fillWheel(mctx, start, "rgb");
    // Navy lift for the dark background: a light wash over navy bars only (the colours above
    // are already final; this is laid on top of them and never changes the wheel itself).
    if (o.navyLift > 0) {
      mctx.globalCompositeOperation = "source-atop";
      const lift = mctx.createConicGradient(start, CX, CY);
      for (const st of STOPS) {
        lift.addColorStop(st.offset, `rgba(${o.navyLiftColour},${(st.navy * o.navyLift).toFixed(3)})`);
      }
      mctx.fillStyle = lift;
      mctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
      mctx.globalCompositeOperation = "source-over";
    }
    // Navy gloss: a bright specular band across the navy bars (radial band × navy share of the
    // wheel, rotating with the colours and following the breath), laid on with source-atop so it
    // stays inside the bars and is tightened by the same crisp-edge filter.
    if (o.navyGloss > 0) {
      begin(gctx, glossCanvas);
      const R0 = INNER_R + o.breatheInnerFollow * breath, R1 = 414 + breath; // bars' radial span (moves with the breath)
      const rad = gctx.createRadialGradient(CX, CY, R0, CX, CY, R1);
      const gc = o.navyGlossColour;
      rad.addColorStop(0, `rgba(${gc},0)`);
      rad.addColorStop(0.24, `rgba(${gc},0.2)`);
      rad.addColorStop(0.33, `rgba(${gc},1)`); // specular peak
      rad.addColorStop(0.42, `rgba(${gc},0.2)`);
      rad.addColorStop(0.7, `rgba(${gc},0.06)`); // deep body
      rad.addColorStop(0.92, `rgba(${gc},0.3)`); // catch-light toward the outer tips
      rad.addColorStop(1, `rgba(${gc},0.12)`);
      gctx.fillStyle = rad;
      gctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
      gctx.globalCompositeOperation = "destination-in";
      const mask = gctx.createConicGradient(start, CX, CY);
      for (const st of STOPS) mask.addColorStop(st.offset, `rgba(0,0,0,${(st.navy * o.navyGloss).toFixed(3)})`);
      gctx.fillStyle = mask;
      gctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalCompositeOperation = "source-atop";
      mctx.drawImage(glossCanvas, 0, 0);
      mctx.globalCompositeOperation = "source-over";
      const sc = mainCanvas.width / SPAN_W;
      mctx.setTransform(sc, 0, 0, sc, PAD * sc, PAD * sc);
    }
    // Sheen: a soft warm-white specular band on the bars at the colour transitions (source-atop,
    // so it never leaves the bars; it rotates with the same `start` as the colour wheel).
    if (o.sheen > 0) {
      mctx.globalCompositeOperation = "source-atop";
      const sheen = mctx.createConicGradient(start, CX, CY);
      for (const st of SHEEN) {
        const navy = navySegment(st.offset * 360); // no white sheen anywhere in the navy segment (o.navySheen)
        const a = st.a * o.sheen * (1 - (1 - o.navySheen) * navy);
        sheen.addColorStop(st.offset, `rgba(255,238,220,${a.toFixed(3)})`);
      }
      mctx.fillStyle = sheen;
      mctx.fillRect(-PAD, -PAD, SPAN_W, SPAN_H);
      mctx.globalCompositeOperation = "source-over";
    }

    // … and, on a layer above, raised bars only: their lighting (highlight on the lit edge, a touch on the
    // face, shading on the far edge), faded in with the bar's elevation. The lighting never
    // extends past a bar's own pixels.
    if (o.lighting > 0) {
      begin(lctx, lightCanvas);
      // With crisp edges on, the lighting is laid onto the bar layer itself (source-atop: identical
      // inside the bars) so the edge filter tightens bar + lighting together; otherwise it stays on
      // its own layer exactly as before.
      const lc = crispSvg ? mctx : lctx;
      if (crispSvg) lc.globalCompositeOperation = "source-atop";
      for (const b of bars) {
        if (b.e < 0.08) continue; // lighting this faint is invisible
        const stc = STOPS[Math.round((((b.wheelDeg + 360 * phase) % 360) + 360) % 360 / 4)];
        const la = Math.min(1, b.e * o.lighting);
        lc.globalAlpha = la * (1 - (1 - o.navyLighting) * stc.seg); // white lighting, faded out across navy
        drawBar(lc, lighting, b, b.e);
        if (blueLighting && stc.seg * stc.navy > 0.01) {
          lc.globalAlpha = la * stc.seg * stc.navy * o.navyShade; // blue-toned lighting, blue bars only
          drawBar(lc, blueLighting, b, b.e);
        }
      }
      lc.globalCompositeOperation = "source-over";
    }
    mctx.globalAlpha = 1;

    // Sparks: glints on lit, warm bars. Brightness follows the bar's own colour (warmth at its
    // current wheel position) and elevation, times a short twinkle locked to the cycle.
    begin(kctx, sparkCanvas);
    if (o.sparks > 0) {
      kctx.globalCompositeOperation = "lighter";
      for (const sp of SPARKS) {
        const b = bars[sp.bar];
        const st = STOPS[Math.round((((b.wheelDeg + 360 * phase) % 360) + 360) % 360 / 4)];
        const tw = Math.max(0, Math.sin(2 * Math.PI * (sp.k * phase + sp.ph))) ** 6;
        const a = o.sparks * st.warm * Math.min(1, b.e * 1.4) * tw;
        if (a < 0.01) continue;
        const k = 1 + o.lift * o.liftMotion * b.e;
        const r0 = b.r0 - o.innerInset + o.breatheInnerFollow * b.br - b.br; // inner end (before the tip glide)
        const r = (r0 + (b.r1 - r0) * sp.t) * k + b.br;
        const x = CX + b.dx * r, y = CY + b.dy * r;
        const g = kctx.createRadialGradient(x, y, 0, x, y, sp.r);
        g.addColorStop(0, `rgba(255,240,222,${a.toFixed(3)})`); // hot core
        g.addColorStop(0.1, `rgba(255,214,170,${(a * 0.9).toFixed(3)})`);
        g.addColorStop(0.3, `rgba(${st.rgb},${(a * 0.45).toFixed(3)})`); // the bar's own colour
        g.addColorStop(1, `rgba(${st.rgb},0)`);
        kctx.fillStyle = g;
        kctx.fillRect(x - sp.r, y - sp.r, sp.r * 2, sp.r * 2);
      }
      kctx.globalCompositeOperation = "source-over";
    }
  }

  function frame(now) {
    if (!playing || destroyed) return;
    elapsed += Math.min((now - last) / 1000, 0.1); // clamp long gaps (tab switches)
    last = now;
    progress = elapsed / o.duration;
    render();
    raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (loaded && !destroyed) render();
  });

  const ready = Promise.all([loadImage(atlasUrl), loadImage(lightingUrl)]).then(async ([a, l]) => {
    if (destroyed) return;
    atlas = a;
    lighting = l;
    if (o.navyShade > 0) blueLighting = await multiplyTint(l, o.navyShadeColour);
    shadowAtlas = await tinted(a, o.shadowColour);
    if (o.keyline > 0) keyAtlas = await tinted(a, o.keylineColour);
    if (destroyed) return;
    loaded = true;
    resize();
    if (crispSvg) container.append(crispSvg);
    container.append(outerCanvas, bloomCanvas, softCanvas, keyCanvas, mainCanvas, lightCanvas, sparkCanvas);
    render();
    container.classList.add("is-canvas");
    ro.observe(container);
  });

  const api = {
    ready,
    play() {
      if (playing || destroyed) return;
      playing = true;
      last = performance.now();
      ready.then(() => {
        if (playing && !destroyed) raf = requestAnimationFrame(frame);
      });
    },
    pause() {
      playing = false;
      cancelAnimationFrame(raf);
    },
    /** Draw the frame for progress p (0 → 1 = one colour cycle; wraps). */
    renderProgress(p) {
      progress = p;
      elapsed = p * o.duration;
      if (loaded && !destroyed) render();
    },
    seek(seconds) {
      elapsed = seconds;
      progress = seconds / o.duration;
      if (loaded && !destroyed) render();
    },
    time() {
      return elapsed;
    },
    /** Per-bar state of the last frame (for tests): segment, position in it, waves and glide. */
    debugBars() {
      return bars.map((b) => ({ segment: b.segment, u: b.u, zone: b.zone, br: b.br, e: b.e }));
    },
    destroy() {
      destroyed = true;
      playing = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      outerCanvas.remove();
      keyCanvas.remove();
      bloomCanvas.remove();
      sparkCanvas.remove();
      crispSvg?.remove();
      softCanvas.remove();
      mainCanvas.remove();
      lightCanvas.remove();
      container.classList.remove("is-canvas");
      if (container.mpiEmblem === api) delete container.mpiEmblem;
    },
  };
  container.mpiEmblem = api;
  return api;
}
