# QR Correction Review

Verdict: **SHIP** — 2026-10-13, narrow source/regression review. No tests or UI/browser calls rerun by this reviewer. No unresolved findings in the authorized correction.

## Source Mapping
- `portal-fe/src/pages/party/qr.ts:198`: both format-information copies now map QR `(x, y)` references to matrix `[y][x]`. Bits 0–5 occupy column 8, bits 9–14 occupy row 8; the second copy follows the corresponding opposite edges. The fixed dark module remains at `[size - 8][8]` from `placePatterns`.
- Independently cross-checked against Project Nayuki's primary implementation: `drawFormatBits` uses `(x, y)` and `setFunctionModule` writes `[y][x]`. The corrected assignments match that mapping. [Reference source](https://github.com/nayuki/QR-Code-generator/blob/master/typescript-javascript/qrcodegen.ts#L269).
- BCH calculation, mask 0, error-correction L, payload encoding, Reed–Solomon, and version selection are unchanged. This is a coordinate correction rather than an encoder redesign.

## Display / Privacy
- `portal-fe/src/pages/party/qr.ts:262` and `PartyPage.tsx:326`: a four-module white quiet zone surrounds the existing black SVG path. Width and height derive from the same span at six CSS pixels per module; `crispEdges` is explicit.
- `portal-fe/src/pages/party/party.css:93`: nonshrinking square presentation preserves the white border and removes rounded clipping. Normal short invitation links remain within the existing mobile section width.
- Existing client-only QR generation remains intact; no external QR service, room-code protocol, user-name payload, new dependency, or server API was introduced. Black/white QR colors remain within the documented scanner contrast exception.

## Regression Quality / Evidence
- `portal-fe/src/pages/party/__tests__/qr.test.ts:90`: fixed L/mask0 golden word `0x77c4` checks both coordinate copies and the fixed dark module. Geometry checks cover supported symbol sizes and exact quiet-zone dimensions.
- `portal-fe/src/pages/party/__tests__/qrDecode.test.ts:8`: an independent `zbarimg` process decodes generated raster symbols and compares the exact payload. Cases span short/legacy invitation URLs, UTF-8, and a multi-block payload, each at 132/200/231 pixels. This checks scanner-readable content rather than only mirroring encoder internals.
- Parent-provided diagnosis: old encoder decoded 0/6 short/legacy cases; transposing only format coordinates decoded 6/6 exact URLs under otherwise identical conditions. The reviewer did not rerun those experiments.
- Limitation: decoder regression explicitly skips when `zbarimg` is unavailable. Worker must report the installed-decoder run as executed evidence; a skipped test cannot establish recognition. Current final worker test/build/display evidence is pending at this source-review point.

## Summary
- Unresolved issues: Critical 0 / Major 0 / Minor 0.
- Architecture/AGENTS compliance: pass for scoped correction.
- Completion action: attach worker decoder results and final build/display verification. No additional source revision requested.

## Final Lifecycle Follow-up

Verdict: **SHIP** — scoped PartyPage lifecycle correction, no unresolved findings. No tests/UI rerun.

- `portal-fe/src/pages/party/PartyPage.tsx:91`: the keyed connection effect now returns cleanup that clears `opened.current` and calls the existing stable `leave` callback. StrictMode's cleanup → setup cycle can therefore reopen the socket. Changing from a valid target to an invalid invitation executes the prior target's cleanup before the invalid setup returns without joining or hosting. Correcting the code subsequently opens a fresh target; existing explicit same-code retry remains intact.
- `PartyPage.tsx:215`: the guest handoff effect guards `invalid`, with that value in its dependency array, so an invalid-route render cannot consume an old room's start configuration before room cleanup is reflected in state.
- `portal-fe/src/pages/party/__tests__/PartyPage.invite.test.tsx:62`: the StrictMode regression asserts two join setups separated by one leave and no host. The stale-config regression verifies an invalid invitation never writes handoff; earlier invalid correction and same-code retry checks remain. These tests were read, not executed by this reviewer.
- Architecture remains unchanged: lifecycle ownership stays in PartyPage and uses the existing relay cleanup API. Worker affected-test, type/lint, and final UI evidence remain the completion gate.
