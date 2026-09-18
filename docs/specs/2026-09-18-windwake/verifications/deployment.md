<!-- source: windwake/publish.mjs, windwake/tests/deployed.mjs, portal-fe/nginx.conf -->
# Public deployment — 2026-09-19

Result: **DEPLOYED / CHROME PASS**.

Play: https://game.1989v.com/games/windwake/index.html

The user explicitly authorized deployment after the initial implementation. A separate checkout of current origin/main received only WINDWAKE and its native-module nginx configuration; unrelated local changes and unpublished commits were preserved.

## Release

- Runtime source commit: `ebc5a52dad830ad773372f78b7aae4a44e1a9fb5` (equivalent source cherry-picked from local `5255bdd2`).
- Games distribution: `931fef20` in `1989v/games`; eight unchanged runtime files plus hash metadata.
- Parent deployment commit: `742eafc7f0911062cd3220b71c7e520ca0c59865`.
- [Image workflow](https://github.com/1989v/msa/actions/runs/35381685400): **success**; only portal-fe rebuilt.
- Manifest commit: `bd3f1c9fca0a437a0ee19a747eb25266067089d7`.
- Running image: `ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:742eafc`.
- Kubernetes: `deployment "portal-fe" successfully rolled out`; updated/total **1/1**, ready **1**.
- Argo CD observed the manifest and reported sync `Succeeded`.

## Verification

1. Nginx 1.27 container: configuration syntax passes; `.mjs` responds `text/javascript`, missing module returns404.
2. Same nginx container in real Chrome: trusted movement/jump and full input-driven boss journey pass.
3. Public HTTPS endpoint: all eight file SHA-256 values match both release metadata and checked source.
4. Public Chrome: trusted keyboard movement and physical jump, then three sanctuaries and boss using state reads/action steps; **7730 ticks, 3 sigils, 8 kills, 2 parries, HP99, mode won**. No teleportation or reward injection in the journey.
5. Captured browser exceptions, console errors and error-level logs: **0**. Screenshots inspected.

Command: `node windwake/tests/deployed.mjs https://game.1989v.com/games/windwake/index.html /private/tmp/windwake-public-qa`

Output: `DEPLOYED CHROME PASS`. [Raw report](deployment/report.json), [title](deployment/title.png), [jump](deployment/jump.png), [ending](deployment/ending.png).

The main CI run's frontend type/tests, structure/compilation and YAML/Kustomize jobs passed. The run was marked cancelled when a later unrelated main push arrived. Repository-wide Docs Health failed on an existing blog-draft link and uncited documents outside WINDWAKE; its [failure log](https://github.com/1989v/msa/actions/runs/35381685502) is separate from the successful image workflow and observed deployment.

This release provides the standalone play URL. It does not create a game-catalog database record. Runtime behavior and game assets are unchanged by packaging; tests and implementation documents are not in the public game directory.
