# Verification strategy
Critical path: static load → start → move/jump/fall → fight and collect → solve any shrine → glide → remaining shrines → updraft → boss → ending → saved free roam.

- Node built-in test runner: pure deterministic simulation, actual physics thresholds, attack geometry/timing, combo/cooldown/invulnerability, AI, environment, idempotent rewards and validated saves.
- Chrome: trusted keyboard/mouse interactions for control paths, manual fixed-step API for repeatable adversarial cases, screenshots and console checks, live RAF frame measurements. Full-route automation uses player input/navigation, not grant/solve cheats.
- Screens: 1280x800 desktop, constrained touch viewport. Inspect key screens and measure DOM clipping/contrast relevant to HUD.
- Iteration log records observed problem, change and specific rerun evidence. Fresh-context review supplements rather than replaces playing.
- Fresh new-game player-input routes reach and solve quarry/forest/ruins each as the first sigil; no teleport or grant commands on these runs. Check duplicate rewards, invalid saves, lost-stone reset, rune mistakes, lethal falls, mid-puzzle death and boss death/retry/completed save.
- Trusted touch/CDP input tests movement, orbit, jump, attack and cancellation. Pause and tab visibility suspend time while holding movement and resume without sticky inputs. Zero-tick render frames preserve presses; multi-tick RAF consumes once; snapshots preserve edge history.
