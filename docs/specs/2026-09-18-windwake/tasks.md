# WINDWAKE tasks

## Group 1 — Pure world and simulation
Dependencies: none. Phase: core. Required skills: hns:implement-tasks.
- [x] Build deterministic original terrain, landmarks, physical platforms and collisions.
- [x] Implement traversal, three-hit directional combat, dodge/parry/pulse, enemy AI and boss.
- [x] Implement three physical sanctuary challenges, rewards, camp/death/save progression.
- [x] Verify: `node --test windwake/tests/sim.test.mjs`.

## Group 2 — Rendering and sound
Dependencies: world/state contract (context/key-decisions.md). Phase: view. Required skills: hns:implement-tasks.
- [x] Custom WebGL terrain, original procedural models, third-person camera, particles and telegraphs.
- [x] Procedural Web Audio voices and ambient sound; mute/reduced motion.
- [x] Verify module syntax and Chrome actual WebGL initialization/screenshots.

## Group 3 — Playable shell
Dependencies: groups 1, 2. Phase: integration. Required skills: hns:implement-tasks.
- [x] Start/pause/map/journal/ending, readable HUD, keyboard/mouse/touch input.
- [x] Fixed-step RAF bridge, deterministic automation API, validated versioned local save.
- [x] Verify Chrome actual input, focus/resize/restart and local-only runtime assets.

## Group 4 — Play, measure, improve
Dependencies: groups 1–3. Phase: verification. Required skills: hns:verify.
- [x] Two or more Chrome play/observe/fix/retest cycles, including complete progression without reward cheats.
- [x] Record screenshot/console/performance evidence and fresh-context code review.
- [x] Fix upheld findings, rerun checks, document run controls and limitations.
- [x] Verify: Node full game tests + browser verification script, scoped git diff checks; commit only owned files.

## Group 5 — Authorized public deployment
- [x] Isolate from unrelated unpublished work; copy only original runtime files into the existing games distribution.
- [x] Configure native module MIME/404, verify real nginx and Chrome, push game distribution before parent pointer.
- [x] Verify image workflow, OCI rollout, public source hashes and actual Chrome input/full ending; record evidence.

## Standards
Root AGENTS.md, DESIGN.md, docs/standards/agent-behavior.md, docs/conventions/frontend-design.md. The game creates no platform/backend schema or service dependency changes.
