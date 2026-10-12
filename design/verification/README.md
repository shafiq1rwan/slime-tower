# UI and animation verification

Implemented the mockup's UI direction using responsive DOM overlays and the existing procedural Phaser art. The generated concept image is a visual reference, not a playable background.

Verified in headless Microsoft Edge using Playwright:

- Desktop: 1440 × 900.
- Portrait phone: 390 × 844 and 320 × 568.
- Landscape phone: 844 × 390.
- Menu/settings, combat HUD, upgrade selection, pause/resume, results, and returning to the menu.
- Keyboard focus stays in dialogs; Enter on Settings does not start the game; paused upgrade shortcuts do not select cards.
- Upgrade input guard works for clicks and keyboard; restart cancels pending selection callbacks.
- Reduced-motion banners remain visible until their normal dismissal time.
- Live slime movement and attack shadow positioning; Slime King windup, leap, and recovery.
- Boss bar clears the upgrade footer at phone sizes with all upgrades populated.
- An accelerated automated run reached victory at wave 12, made 11 upgrade selections, and finished with 33 HP. This is a smoke check, not a statistical balance assessment.
- No browser runtime errors in these checks.
- Touch emulation at 390 × 844 and 2× device scale: pause, settings, resume, and upgrade taps work; desktop keyboard hints are hidden.

`npm test` verifies pose continuity, stable body volume, finite bounds, and unchanged average movement speed for all six enemy types. `npm run build` passes.

The saved screenshots use a few controlled game states to make each interface screen reviewable.
