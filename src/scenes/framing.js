import { computeFraming, applyFraming, getRenderDpr } from '../utils/layout.js';
import { WORLD } from '../config/gameConfig.js';
import { ui } from '../ui/UIManager.js';

/**
 * Fit the arena into the visible screen area not covered by UI.
 * With `smooth`, the camera eases to the new framing (e.g. when the boss bar
 * appears); otherwise it snaps (resize / orientation change).
 */
export function frameCamera(scene, smooth = false, viewRadius = WORLD.VIEW_RADIUS) {
  const cam = scene.cameras.main;
  const W = scene.scale.width;
  const H = scene.scale.height;
  cam.setSize(W, H);
  const dpr = getRenderDpr();
  const rects = ui.getReservedRects(dpr);
  const f = computeFraming(W, H, rects, viewRadius, 6 * dpr);

  if (!smooth) {
    if (scene._frameTween) scene._frameTween.stop();
    applyFraming(cam, f, 0, WORLD.VIEW_CENTER_Y);
    scene._framing = f;
    return;
  }
  const from = scene._framing || f;
  const state = { zoom: from.zoom, cx: from.cx, cy: from.cy };
  if (scene._frameTween) scene._frameTween.stop();
  scene._frameTween = scene.tweens.add({
    targets: state,
    zoom: f.zoom,
    cx: f.cx,
    cy: f.cy,
    duration: 450,
    ease: 'Sine.easeInOut',
    onUpdate: () => applyFraming(cam, state, 0, WORLD.VIEW_CENTER_Y),
  });
  scene._framing = f;
}
