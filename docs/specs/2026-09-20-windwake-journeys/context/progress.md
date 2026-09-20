<!-- source: windwake/sim.mjs -->

# Progress

2026-09-20: implementation and local review complete.8towns/24residents/48buildings/16quests/4dungeons(27rooms)/8relics.169/169tests; original5routes and53502framefrontieradventure pass.8freshsettlementroutes and continuous91845frames/11480.52m/0falls/16claims/8relics+allies pass in Node AND real Chrome with actual reload. Trusted UI and390×844/844×390menus pass.10physicalsceneenter/exitcycles maintain boundedbuffers and generate0newworldchunksindoors; indoor59.75/outdoor60.00FPSat1280×800SwiftShader,p95≈16.8ms. All consoleerrors0.

Independent reviews both SHIP after flasksave, movingstonecombatcover andcamera nearwall fixes. Root also correctedindoor map ceilings andportalvisibility. Latest minorbossHUDname/patternhintfix is beingrechecked in continuousChrome beforecommit/publish. Do not equatearea64×withcontent/playtime; houses have noindividualinteriors/NPCschedules.

Sharedrootcommits:1e1143d3design,c49cbf94runtime. Unrelated userdirty/stagedEventType.kt deletion preserved. Isolatedrelease /private/tmp/windwake-release-20260919 merged latestoriginbfa2704d andcherrypickedoursas66687527+8e648bb9. Privategamespreparedlocalcommit60e73225(NOTPUSHED); needsrepublishafterfinalHUDcommit. GHactivekwongd mustremainunchanged; use scoped1989vGH_TOKEN from gh auth token --user1989v withoutprinting/persistingtoken. Existingpublic https://game.1989v.com/games/windwake/index.html stilloldFrontiers.

Remaining: finishHUDChrome recheck, source/test/doccommits, cherrypickowncommitsintorelease, publish16files, pushprivategamesbeforeparentpointer/main, watchportal-onlyimages/OCIArgo, public16hashes+original/frontier/newcontinuousplayverify, finaldocdeploymentrecordcommit. Neverpushsharedrootmain. Runtimepublisher/testallowlistsalready16. BrowserfallbackownedChrome via scripts/cdp-chrome.sh; noHiggsfield.
