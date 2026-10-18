<!-- source: game/domain/src/main/kotlin/com/kgd/game/domain/territory/, game/feature/src/main/kotlin/com/kgd/game/, docs/specs/2026-10-18-territory-lab/online-spec.md -->
# ADR-0104: Territory — CPU authoritative shared world

Status: Accepted for implementation,2026-10-18. User explicitly approved actualonline/curve/CPU-only implementation. Deployment is not authorized by this ADR.

## Context

ADR0088's last-one host-authority relay caps seats20 and locks joins afterstart. Territory requires anytimejoin, AI fillunder30, a100participant verification target and largeworld. Reusing or expanding that lobby's semantics would regress existinggames. Curvepreview benchmarks establish smallmotioncost but fullworldfloodfill scaleswitharea; they do notprove multiplayercapacity.

## Decision

Add an isolated exact territoryWS route in existing game:feature hosted bycontent:app. Keep existingrelayprotocol and its game rules unchanged. Pure game:domain simulation owns positions/collision/land. Existingprofile API supplies identity through a shortlivedone-use HTTPticket redeemed in firstWSframe, because existingguestcookie is scoped to/api/v1/games. No newDB/service/GPU/broker.

Default4096² world uses sparse64²chunks and1unitoccupancy; smoothcontinuousmovement is independent ofoccupancyresolution.40Hzsimulation,10Hznearbyversionedsnapshots withclientprediction. Capturework andAIplanning have pertickbudgets; no synchronousfullworldscan. Incrementalcapturemust guard againststaleownership andboundcommitwork.100participant benchmarks include serializationandactualsocketfanout.

## Tradeoffs and boundaries

A single authoritative in-memory coordinator means a single active world-owner process. Existing deployments must route this endpoint to one designatedinstance; runningmultipleowners silently producesdifferentworlds and is unsupported. Deploymentconfiguration and horizontalownershiphandoff require separate rolloutreview; no deployment changes now. Processrestart losesworld; no durableterritory/offlineretention promise. Serverauthoritative world costsCPU whereasrelayonly doesnot, so measuredcapacity ratherthanunlimitedclaims. GPU server is neitherrequirednorused.

Alternatives: hostrelay rejected duehostdeparture/latejoin/largeauthoritativestate; newNode service rejected becauseexistingJVMhost canownsimulation withoutnewinfrastructure; densewholeworldper-capturefill rejected duequadraticmapgrowth. Othergames remaingoverned byADR0059/0088; this is a scoped newgame exception to relay-only gameplay, not replacement.

## Lobby standard exception

The user's explicit anytime-join persistentworld requirement overrides docs/standards/online-versus-lobby.md's five-entry matchlobby/no-midmatchjoin for thisgame only. Territory has one worldentry/leave/respawn flow, nohost/startcountdown/roomcode. Othergames' lobby remainsunchanged. Serverprofile naming follows laterADR0102, notolderlocalStorage-authority wording inlobbystandard.
