<!-- source: windwake/presentation.mjs -->
<!-- source: windwake/render.mjs -->
<!-- source: windwake/terrain.mjs -->

# Research and adopted references

2026-09-27. Technical facts below are distinguished from this game's design choices.

- [Unity Cinemachine Deoccluder](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineDeoccluder.html) documents preserving target visibility by moving the camera, collision radius, forward pull, and separate smoothing/damping controls. WINDWAKE retains its own swept near-plane geometry test, corrects inward immediately and damps outward motion. It uses a depth-limited, 1.5 m vegetation corridor in its fragment shader. This particular cutout implementation is our design, not a claim about Nintendo's proprietary implementation or Cinemachine's shader.
- [The Book of Shaders: fBm](https://thebookofshaders.com/13/) explains combining octaves with changing frequency/amplitude. [GPU Gems 3: complex procedural terrains](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu) provides a density-field terrain reference. WINDWAKE uses a smaller coherent heightfield plus authored instance geometry; it does not implement the GPU Gems density-field pipeline.
- User video [3W1tKXhbiEk](https://www.youtube.com/shorts/3W1tKXhbiEk): public oEmbed/player metadata confirmed title “마인크래프트에서 자연 환경을 자동 생성하는 방법? #게임 #게임개발”, author 저세상개발자, duration 73 seconds. Description lists Minecraft world/noise resources and [Alan Zucconi's world-generation article](https://www.alanzucconi.com/2022/06/05/minecraft-world-generation/). The article was read as the author's explanation, not as Minecraft source. The video's caption endpoint returned an empty successful response; no verified viewing/transcript was obtained. We do not attribute unverified steps or formulas to the video.
- Skybound handoff (user-provided local document, not included in this repository) and the ZIP inventory were reviewed as user-provided context. Adopted: shared surface sampling, actual connected traversal, meaningful environmental route choices, distinct character actions, and a near-landing jump-buffer regression. No Skybound source, engine, dependency or unverified completion claim was copied into this runtime.

Reusable output: [game terrain generation standard](../../standards/game-terrain-generation.md), with seed/coordinate, multiscale generation, protected routes, surface interpolation, placement, compatibility and quantitative verification contracts.
