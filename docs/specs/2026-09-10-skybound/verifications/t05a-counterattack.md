# T05A-2 · 반격과 플레이어 피해

직접 실행:
```text
node --test implementation/t05a/tests/guardian.test.mjs implementation/t02a/tests/movement.test.mjs
# tests 16
# pass 16
# fail 0
node release/build-beta.mjs
Built docs/specs/2026-09-10-skybound/release/dist/index.html (5 payload files; metadata added)
```

예고·회복·한번타격, 고정점 이탈/높이/벽으로 회피, 피해무적1초, pause/적처치 시 취소, 사망 후 안전복귀와 진행/표적피해 보존, 운반물 복구를 확인했다. 공유된 물 복귀 경로의 기존 이동 검사도 함께 통과했다. 브라우저/실기기 검사는 추가로 하지 않았다.

운반 취소의 기존 배치가 새 출발점과 겹치는 경우에만 미완료 프리즘을 원래 위치로 되돌린다. 완료 퍼즐/경로/표적체력은 유지한다. 경고 원 반경0.8m와 타격 반경을 일치시켰으나 경사지면 전체를 따르는 링/최종 동작 품질은 후속 보완이다.
