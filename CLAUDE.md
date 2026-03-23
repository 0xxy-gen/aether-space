# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Pure static HTML — no build system, no package manager. Dependencies loaded from CDN:
- **Three.js r128** — 3D WebGL rendering
- **Tailwind CSS** — utility styling (CDN)
- **Google Fonts** — Inter, JetBrains Mono

## Development

Open `index.html` directly in a browser, or run a local server:
```
python3 -m http.server
```

## Deployment

GitHub Pages — push to `main` on `aether-space.github.io`. No CI/CD pipeline.

## Architecture

Single-file app (`index.html`). All CSS lives in an inline `<style>` block; all JS lives in an inline `<script>` block at the bottom of `<body>`.

**Three.js scene globals:**
- `scene`, `camera`, `renderer` — standard Three.js setup
- `earth`, `moon`, `mars` — `THREE.Mesh` objects with `MeshBasicMaterial` + texture maps from mrdoob/three.js GitHub raw URLs. **Must use `MeshBasicMaterial` — `MeshStandardMaterial` causes progressive darkening on Mars/Moon due to missing ambient light.**
- `satSystem[]` — satellite shell groups, each `{ mesh, speed }`; rotation applied each frame in `animate()`
- `rocketSystem[]` — circular orbit objects, each `{ mesh, curve, t, speed }` traversing a `CatmullRomCurve3` closed loop

**Camera waypoints:**
```js
const CAM_START  = { x: -12, y: 8,  z: 80  };   // Earth view
const CAM_END    = { x: 35,  y: 10, z: -12 };    // Moon view
const CAM_MARS   = { x: -125, y: 20, z: -92 };   // Mars view
const LOOK_START = { x: 0,   y: 0,  z: 0   };
const LOOK_END   = { x: 46,  y: 4,  z: -44 };
const LOOK_MARS  = { x: -122, y: 14, z: -124 };
```

**Scroll smoothing — critical for preventing Moon/Mars vibration:**
GSAP `scrub: 1.2` spring causes `scrollProgress` micro-oscillations when scroll stops. `lookAt()` uses raw values (instant) while camera position is lerped — this mismatch creates visible shaking. Fix: shadow variables lerped at 0.08/frame:
```js
let smoothProgress  = 0;
let smoothProgress2 = 0;
// In animate(), before camera block:
smoothProgress  += (scrollProgress  - smoothProgress)  * 0.08;
smoothProgress2 += (scrollProgress2 - smoothProgress2) * 0.08;
// Use smoothProgress / smoothProgress2 everywhere in camera if/else chain
```

**`animate()` loop** handles: planet rotation, satellite shell rotation, rocket traversal along curves, payload arc/orbit GSAP tweens, trail history updates, and mouse-driven camera parallax (`mouseX`/`mouseY` globals).

**Orbital mechanics (Kepler-correct):**
- Satellite shell speeds use Kepler's 3rd law: `speed ∝ r^(−3/2)`
- `launchPayload()` uses true Hohmann transfer arcs — orbital plane defined by `(e_r, e_t)` basis vectors from launch point. Arc points sampled via eccentric anomaly (uniform time, not uniform angle). Orbit ring built in the same plane.
- `solveKepler(M, ecc)` — Newton-Raphson solver for eccentric anomaly, 8 iterations
- Velocity at insertion uses apoapsis speed: `v_apo = v_circ × √(2r₀/(r₀+r₁))` to conserve energy across transfer→orbit
- Launch trails use `AdditiveBlending` + dual-pass (full opacity + 0.35 opacity glow layer)

**Assets:**
- `aether-logo.jpg` — AETHER wordmark logo used in nav, displayed with `filter: invert(1)` for white-on-dark

Planet textures are fetched from external CDN URLs at runtime — they require an internet connection.
