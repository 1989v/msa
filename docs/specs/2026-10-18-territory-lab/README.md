# Territory lab

Playable entry: `/games/territory-lab/`. Source: `portal-fe/public/games/territory-lab/`.

From the repository root:

```sh
python3 -m http.server 4178 --bind 127.0.0.1 --directory portal-fe/public
node --test portal-fe/public/games/territory-lab/tests/*.test.mjs
node --check portal-fe/public/games/territory-lab/engine.mjs
node --check portal-fe/public/games/territory-lab/app.mjs
```

Open `http://127.0.0.1:4178/games/territory-lab/`, or use the same path through the portal Vite dev server. ES modules require HTTP; opening the HTML with `file:` is unsupported.

Click **플레이 시작**, hold WASD/arrows or directional buttons to move; release to stop in place, draw outside your patch and return before the trail is cut. Space pauses when the field has focus. Help and editing cosmetics pause; choose **계속하기** to resume. Fresh respawn discards prior territory; world reset discards the entire match. Cosmetic storage failure does not prevent play.

This is a local 1-human/29-AI sample with a finite 720×720 world, ephemeral territory and expansion bots that prioritize cutting reachable exposed trails within 12 steps. It does not test network latency, large concurrency or online cheating resistance. The final product intent and unresolved rules remain in [spec.md](spec.md).

Browser visual/performance/input verification requires explicit computer-use permission. Non-UI tests alone do not establish visual quality or touch behavior on actual devices.

Select a boundary style and sign symbol/text under **내 영역 꾸미기**. Apply saves preferences. **간판 배치** then an owned cell (or **현재 위치에 배치**) anchors a sign; a maximum of three can be edited/deleted below. Lost anchor cells, death and reset remove signs. Finish or cancel placement, then explicitly resume. Positions are never saved.
