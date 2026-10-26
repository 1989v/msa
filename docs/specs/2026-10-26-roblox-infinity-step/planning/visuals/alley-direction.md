# Urban course direction — proposal, awaiting approval

User feedback: “발판만 보이고 캐릭터가 없는 편집 화면 / 게임같지않아보임”.

The current nine-platform technical sample does not meet the experiential promise of an urban climbing game. Edit mode explains the absent player avatar, not the lack of a coherent stage. Do not describe CLI assertion counts as proof of a playable or visually accepted game.

## Proposed bounded replacement

- One small authored urban level: alley floor → exterior structures → rooftop goal.
- Climbable objects belong to buildings: crates, awnings, HVAC units, balcony ledges and fire-escape landings. No disconnected identical slabs in a straight line.
- From the spawn camera, the first jump and rooftop destination should be legible. Add a clear start cue, height/charge feedback and an explicit finish state.
- Retain the existing five-level charge rules and user-selected last-platform revival. Prioritize actual movement/route experience over additional monetization work.
- This revises the first-course presentation, not the full original tower scope. Exact route geometry, collision envelopes and scene budget must be designed after direction approval.

## Visual reference

`alley-direction.png` was made with the built-in image generation tool and is labeled DESIGN CONCEPT / NOT GAMEPLAY. It is a spatial/art direction reference only. Its detailed surface textures, foliage, character cosmetics and lighting are not implemented assets or acceptance evidence and are not a promise of exact runtime parity. The Roblox implementation should use a feasible simple-part vocabulary and be evaluated in the engine.

Prompt is preserved in `alley-direction-prompt.txt`. No product code was changed for this proposal. No computer use approval is active; do not silently resume UI tools.

## Completion evidence for a revised course

1. Actual Studio Play: player spawns, ground movement and all five jump strengths work, falling/landing/revival work.
2. Player can traverse the complete short route and trigger finish; free play remains possible.
3. Actual starting-camera and mid-course screenshots demonstrate the integrated urban route. AI-generated concept art cannot satisfy this check.
4. User reviews the first course before expanding the map or adding more systems.
