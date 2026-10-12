# Last Tower Standing

A cute 2D auto-defense roguelite for desktop and mobile browsers. A magical crystal tower attacks automatically while you mark priority targets and use Crystal Pulse to repel slimes or interrupt attacks. Between waves you pick one of three upgrades. Wave 12 is the Slime King boss.

Built with **Phaser 3** + **Vite**, plain JavaScript. All art and sound are procedural (Canvas 2D + Web Audio) — no external assets.

## Running

```bash
npm install
npm run dev       # dev server (also reachable from phones on your LAN)
npm run build     # production build in dist/ (relative paths, host anywhere)
npm run preview   # serve the production build
npm test          # animation, active combat, and spawn-queue checks
```

**Play online:** https://shafiq1rwan.github.io/slime-tower/

Every push to `main` runs the tests, builds, and deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Controls

- Tap/click a slime to focus tower fire on it. A cyan ring marks the target; targets outside attack range remain marked as they approach. Tap the same slime, empty ground, or the × button to clear it.
- Tap Crystal Pulse or press `Space` to repel nearby slimes and interrupt attacks. It recharges in nine combat seconds; pause and upgrade selection freeze recharge. Bosses resist knockback, but a nearby windup can be interrupted. An airborne boss leap cannot be interrupted.
- Red rings and exclamation marks warn before contact attacks; the Slime King's landing zone stays visible throughout its windup and leap.
- Tap an upgrade card between waves. Desktop shortcuts: `1`/`2`/`3` select a card, `Esc`/`P` pause, `Enter` start.

## Interface and motion

The menu, HUD, upgrade cards, pause/settings, and results share a navy, cream, and crystal-cyan visual system. Combat shows a centered wave indicator and a compact summary of owned upgrades. Portrait phones use horizontal upgrade cards; short landscape screens use columns and scrollable dialogs. Dialogs trap keyboard focus and block background controls, and pending upgrade selections are cancelled on restart.

Slime hops use continuous anticipation, takeoff, landing, and recovery poses, with volume-preserving deformation and grounded shadows. Attack lunges move the body independently of the shadow. The Slime King waits for a grounded pose before winding up and releases continuously into its leap. Reduced effects soften hopping and remove UI motion; the default settings respect the system's reduced-motion preference.

The art-direction mockup is in `design/mockups/`. Screenshots from browser layout verification are in `design/verification/`.

Slimes enter through color-coded ground rifts at six arena-edge fronts. Each arrival has a 0.65-second warning, then grows into view and hops inward over 0.5 seconds. Groups use nearby entrances rather than appearing at random angles. The boss uses a larger rift and a slower entrance; split children and summoned minions retain their short ballistic arcs. Queue accounting includes warned arrivals so a wave cannot end before they spawn.

## Project structure

```
src/
  main.js                 Phaser boot, high-DPI canvas sizing, resize/orientation, audio unlock
  config/
    gameConfig.js         World geometry, render depths, palette
    balance.js            ALL tuning: tower stats, enemy stats, waves, boss, upgrades, scaling
  art/textures.js         Procedural art -> Phaser textures (fixed keys, replaceable)
  entities/
    Slime.js              Slime gameplay logic (+ Slime King abilities)
    SlimeView.js          Slime visuals: hop squash & stretch, blink, jiggle, death pop
    Tower.js / TowerView.js   Tower stats/targeting/firing vs. visuals/evolution/effects
    Projectile.js         Pooled homing projectiles
    Arena.js              Grassland arena + decorations
  systems/
    WaveManager.js        Timed spawn queues from wave data
    UpgradeManager.js     Weighted upgrade rolls, applying picks
    ParticleManager.js    Pooled particles, damage numbers, lightning
    AudioManager.js       Web Audio sound recipes with throttling/voice cap
    Settings.js           Persistent settings + best score (localStorage, guarded)
    EventBus.js           UI <-> scene events
  scenes/
    BootScene.js          Generates textures
    MenuScene.js          Title backdrop (tower + slime parade)
    GameScene.js          Simulation loop, wave flow, combat resolution
    framing.js            Fits the arena to the screen area not covered by UI
  ui/                     DOM overlay: HUD, upgrade cards, menus, icons
  styles/main.css         Responsive UI (portrait / landscape / short-landscape)
```

### Key design notes

- **Visuals are separate from gameplay.** A slime's `(x, y)` + radius `r` is its collision circle. Hop height, squash/stretch, lean and wobble live only in `SlimeView`. The hop phase also gives slimes a surge-while-airborne speed profile that averages to their configured speed.
- **One logical world, any screen.** The world is a fixed circle (arena radius 440). The camera zooms so the full arena plus spawn ring is always visible, and moves it clear of the HUD. Portrait and landscape players see the same battlefield; nothing spawns off-screen. Reserved UI areas are any element marked `data-reserve`.
- **Crisp on high-DPI screens.** The canvas renders at device resolution (capped at 2×) and resizes in place on rotation without restarting.
- **Game-time timers.** Wave flow uses `GameScene.after()`, which runs on simulation time, so pausing freezes everything.

## Tuning

Everything a designer may want to tweak is in `src/config/balance.js`:

- `TOWER` starting stats; `ENEMIES` per-type stats and bounce profiles (`hop`).
- `WAVES` spawn groups: `{ type, count, interval, delay }`.
- `SCALING` per-wave HP/damage/speed multipliers; `BOSS` ability timings.
- `UPGRADES` (name, colour, max level, weight, description) and `UPGRADE_EFFECTS` (numbers per level).

## Replacing the art

Every texture is registered under a fixed key (listed at the top of `src/art/textures.js`). To use real artwork, load images/spritesheets with the same keys in `BootScene` and skip the matching procedural draw. Slime textures are anchored at their feet (`slimeMetrics()`); the tower base is anchored at `TOWER_ART.footX/footY`.

## Debug / balance URL flags

| Flag | Effect |
|---|---|
| `?play` | Skip the menu |
| `?speed=4` | Run the simulation 4× faster (sub-stepped, stays stable) |
| `?wave=12` | Start at a wave (applies greedy pre-upgrades to simulate a build) |
| `?auto=1` / `?auto=random` | Auto-pick upgrades (greedy / random) — used for balance runs |
| `?debug` | Expose the game scene as `window.__LTS` |

Balance was checked with automated full runs at 8× speed. Greedy builds won 2 of 3 runs (95–119 HP left); random picks won 1 of 3, lost to the boss once, and died on wave 7 once.
