# Active combat and rift entrances

Players can mark a priority target during combat and use Crystal Pulse to repel nearby slimes and cancel attacks. The cooldown, targeting state, and warnings use simulation state so pause and restart behave consistently. A marked enemy outside tower range remains visible as "Approaching"; targeting does not extend the tower's attack range.

Contact attacks show a red warning ring and exclamation mark before their lunge. The boss's landing zone remains visible through windup and leap. Pulse can cancel a nearby windup, but cannot move the boss or cancel an airborne leap. An interrupted boss retries its jump sooner than the Pulse recharges, so timing matters.

Ordinary enemies emerge from ground rifts at six edge fronts. A color-coded 0.65-second warning precedes each arrival, followed by a smooth grow/fade and short inward hop. Three arrivals share a front before the group changes direction. Bosses use a larger rift near the south edge; split children and summoned minions keep their local arcs. Warning markers are cancelled with the wave queue.

Validation:

- 11 automated tests pass: animation continuity plus Pulse range/cooldown/interruption, priority-target lifecycle, bounded entrances, and warning/queue accounting.
- Browser checks pass on desktop and touch devices: actual canvas target selection, tower prioritization, attack warnings, button/Space Pulse, cooldown, pause, clear target, restart, and controls at 320 × 568 and 844 × 390.
- Boss entrance and windup interruption work.
- An accelerated automated run without manual Pulse use reached victory at wave 12 with 11 upgrade selections. This verifies run flow, not overall difficulty balance.
- No browser runtime errors in the tested flows.
- Production build passes.

Screenshots named `*-rift-*`, `*-priority-target.png`, `*-attack-warning.png`, and `boss-pulse-warning.png` show the new flows. Some combat screenshots use controlled enemy positions to make the state clear.
