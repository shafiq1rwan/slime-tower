// Viewport helpers shared by the scenes.

/** Device pixel ratio used for the canvas backing store (capped for mobile GPUs). */
export function getRenderDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.left, Math.min(cx, rect.right));
  const ny = Math.max(rect.top, Math.min(cy, rect.bottom));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/**
 * Work out camera zoom + screen centre so the circle of `viewRadius` world units
 * fits the screen without being covered by UI.
 *
 * Strategy: first try the whole screen (UI panels often sit in the corners,
 * outside the circle). If any reserved UI rect overlaps, shrink the play area to
 * the band between top-anchored and bottom-anchored UI.
 *
 * @param {number} W screen width (device px)
 * @param {number} H screen height (device px)
 * @param {Array<{left,top,right,bottom}>} rects reserved UI rects (device px)
 */
export function computeFraming(W, H, rects, viewRadius, pad = 0) {
  const fit = (top, bottom) => {
    const h = Math.max(50, bottom - top);
    const z = Math.min(W - pad * 2, h - pad * 2) / (2 * viewRadius);
    return { zoom: Math.max(0.05, z), cx: W / 2, cy: top + h / 2 };
  };

  let f = fit(0, H);
  const hits = rects.some((r) => circleHitsRect(f.cx, f.cy, viewRadius * f.zoom, r));
  if (!hits) return f;

  let top = 0;
  let bottom = H;
  for (const r of rects) {
    const midY = (r.top + r.bottom) / 2;
    if (midY < H / 2) top = Math.max(top, r.bottom);
    else bottom = Math.min(bottom, r.top);
  }
  f = fit(top, bottom);
  return f;
}

/** Apply framing to a camera so world point (wx, wy) sits at framing centre. */
export function applyFraming(camera, f, wx, wy) {
  camera.setZoom(f.zoom);
  const W = camera.width;
  const H = camera.height;
  camera.centerOn(wx + (W / 2 - f.cx) / f.zoom, wy + (H / 2 - f.cy) / f.zoom);
}
