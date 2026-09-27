# Route revision — 2026-09-28

User: stages change entry positions, mixing center, both flanks and concentrated one-side attacks. Deployment explicitly authorized after completion.

## Contract
- Twenty waves form four stages of five waves. 1–5 CENTER,6–10 BOTH,11–15 LEFT,16–20 RIGHT. Next stage shown before its first wave; current entry remains visible.
- Center x790 is the symmetry axis of existing boards. Central invasion starts(790,835), runs north through shared fire corridor to(790,210), takes left/right court perimeter, returns to(790,715), then north togate(790,155). Passing near gate earlier does NOT damage gate; only full route completion does.
- Left loop: (790,210),(290,210),(190,275),(165,490),(195,650),(400,715),(790,715). Right loop mirrors aboutx790. Route road points kept outside both placement courts.
- Flank invasion enters from marked muster points(290,210)/(1290,210), circles the corresponding court via the same outer loop, returns centrally to gate. LEFT/RIGHT stages intentionally concentrate enemies there; shared central finish allows both players to protect gate.
- BOTH and CENTER alternate route sides by spawn index+wave, boss uses same deterministic rule. Flank stages use selected side. No extra randomized choice or duplicated spawn count.
- Enemy routeId is part of persisted authoritative snapshot. Route point/length perid; target priority uses remaining distance togate. Equal mirrored route lengths. Mirror starting troops seat1 to give comparable central fire exposure.
- Save schema version2; unsupported v1 savedgame is explained and cleared (existing corrupt/version flow). Network handshake version must also differ so stale clients cannot silently play mismatched paths.
- Painted background opens bottom center and keeps two side muster clearings on outer road. Render restrained entry markers and ground arrows, current stage + next-wave direction labels. Real path follows these points; never cross placement courts.
- Verify route symmetry/board nonintersection/both-side range; each stage routing; strict route validation/save resume; earliest near-gate passage safe; leakage only at finalend;20waves and actual two-browser agreement. Deploy only own verified game slice and verify public assets+actual relay.

## Tasks
- [x] data/core/routes unit tests and protocol version.
- [x] approved art map adjustment and entry/direction rendering/help.
- [x] real browser regression+fresh review.
- [x] safe scoped release and public URL/online smoke.
