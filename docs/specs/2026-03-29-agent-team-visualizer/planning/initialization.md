# Agent Team Visualizer — Raw Idea

Date: 2026-03-29
Feature: agent-team-visualizer

## Description

Claude Code 에이전트 팀(harness-scaffold, doc-scaffolding, ai-debugger, content-analyzer, private-repo 등)에 포함된 각 에이전트를 사람 형태의 아바타로 시각화하는 프론트엔드 서비스. 유튜브 쇼츠에서 본 것처럼 각 에이전트가 실제 사람처럼 보이는 UI를 구현. 에이전트의 역할, 상태, 현재 작업 등을 실시간으로 표시.

## Key Concepts

- 에이전트 팀 구성원: harness-scaffold, doc-scaffolding, ai-debugger, content-analyzer, private-repo 등
- 각 에이전트를 사람 형태의 아바타로 시각화
- 유튜브 쇼츠 스타일의 UI (실제 사람처럼 보이는 형태)
- 에이전트 역할 표시
- 에이전트 상태 표시 (활성/대기/작업 중 등)
- 현재 수행 중인 작업 실시간 표시

## Open Questions

- 아바타 시각화 방식: 2D 일러스트, 3D 모델, AI 생성 이미지, 아니면 다른 방식?
- 실시간 데이터 소스: 에이전트 상태를 어떻게 수집하고 전달할 것인가? (WebSocket, SSE, polling?)
- 프론트엔드 기술 스택: React, Vue, 또는 다른 프레임워크?
- 이 서비스가 MSA 플랫폼의 일부로 통합되는가, 독립 서비스인가?
- 에이전트 수와 확장성 고려 사항
