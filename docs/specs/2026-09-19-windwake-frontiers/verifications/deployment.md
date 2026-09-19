<!-- source: windwake/publish.mjs -->
<!-- source: windwake/tests/deployed.mjs -->
# Frontiers public deployment — 2026-09-19

**DEPLOYED / PUBLIC CHROME PASS**

Play: https://game.1989v.com/games/windwake/index.html

User's prior explicit deployment authorization continues for this expansion. Isolatedcheckout receivedonlyWINDWAKE commits; latestothergamechanges were fast-forwarded and retained. No forcepush and no shared-workspace unrelatedchanges deployed.

- Runtime source: `eaeed67d024ebd51700b9aaa098c8ad580f4c332` (equivalent localruntime+reviewedpolish commits199a0e54/45df0caf).
- Distribution `1989v/games`: `89422adaa0017d47ac29c2e1dff767a25d1683fc`.
- Parent release: `a14ef9bf660a2fc06d61f432cc39700462922c17`.
- [Image workflow](https://github.com/1989v/msa/actions/runs/35446566436): success,portal-feonly.
- Manifest: `e35c98e68f3a9ce83e7acd3542548e7087bd56ef` updatesonlyportal-fetag.
- Runningimage: `ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:a14ef9b`.
- Kubernetes: `deployment "portal-fe" successfully rolled out`,ready1/1.
- Argoapplication:Synced,operationSucceeded. Aggregateapplicationhealth reportsDegraded; this is not claimed aswhole-platformhealth. Game deployment isreadyandpublicplaypassed.
- [MainCI](https://github.com/1989v/msa/actions/runs/35446566418): success(Kustomize,portaltypecheck/tests,structure/compile,testcompile,YAML).
- [DocsHealth](https://github.com/1989v/msa/actions/runs/35446566423): failure. Newsourcecitationformatcorrected in evidencefollowup; olderblogdraftlink/unciteddocs outsidegame remain. NoWINDWAKEfindings in final localdoctorJSON.

Command:

```sh
node windwake/tests/deployed.mjs https://game.1989v.com/games/windwake/index.html docs/specs/2026-09-19-windwake-frontiers/verifications/deployment
```

Result:`DEPLOYED CHROME PASS`.

1.12/12HTTPassetbytes match releaseSHA256 and checkedlocalsource; .mjsJavaScriptMIME,missingmodule404.
2. ActualChrome trustedWASD+Space movementandjump onpublicURL.
3. Originaljourney3sigils/updraft/skyboss:7730ticks,8kills,2parries,HP99,won.
4. Expandedcontinuousjourney: naturalfarm→actualday1dusk→2raidwaves→paidvillage3→4regionalbosses→finalcapstone.53,502ticks,891.7simulationseconds,3,747.26m,0falls,12kills,10parries,beacon180,finalDefeatedtrue. No position/time/resourcegrant shortcuts.
5. Endings returntofreeplay. Browserreload restores finalcompletion,village3andpaidraidreward.
6. Browserexceptions,consoleerrors,errorlogs:**0**.

[Rawreport](deployment/report.json), [publictitle](deployment/title.png), [jump](deployment/jump.png), [frontierending](deployment/frontier-ending.png). Verificationhelpers are injected by thetestclient, neverpublished withthegame. Existingbrowser saves migrate automatically fromv1tov2. Publicruntime needsnobuildorremoteassets.
