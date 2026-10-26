# Task Breakdown: Roblox Infinity Step

## Overview
Total Task Groups: 1 bounded standalone prototype. User authorization: “일단 그거 먼저 진행해 줘” plus paid revival request, following the proposed first-slice description.

### Task Group 1: First course, controls and optional revival
**Dependencies:** reviewed specification
**Phase:** prototype
**Required Skills:** hns agent behavior; source-first verification
- [x] 1.0 Complete local prototype (runtime acceptance remains pending)
  - [x] 1.1 Focused actual-Luau tests for five-level jumps, route reach, last-platform/fall snapshots and free continuation.
  - [x] 1.2 Focused tests for receipt retries, single use, failure recovery, lifecycle changes and competing sessions.
  - [x] 1.3 Implement editable course, Roblox movement/server adapters and touch/keyboard HUD.
  - [x] 1.4 Implement atomic persistent ticket ledger, explicit use and disabled-by-default live purchase UI.
  - [x] 1.5 Reproducibly build self-contained `.rbxlx`, project mapping and README.
  - [x] 1.6 Verify: `LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/infinity-step/tools/verify.py`
  - [x] 1.7 Fresh-context implementation review and evidence report.
  - [x] 1.8 Deliver reusable porting prompt and sourced Roblox development guide; verify local links.

**Acceptance Criteria:** spec SR-1–4 executable checks pass; generated place embeds exact source; runtime-dependent checks are explicitly listed unverified; no unrelated paths modified; no live publication or product creation.

## Execution Order
Tests and pure modules → Roblox adapters and course → artifact → scoped verification → fresh review → report.
