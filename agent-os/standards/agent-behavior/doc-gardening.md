# Doc Gardening (문서 동기화)

## 원칙

- **코드가 SOT, 문서는 결과물**. 문서는 코드의 상태를 반영하기 위한 파생물.
- 구현이 성공한 후에만 문서 동기화 (실패한 구현을 문서화하지 않는다).
- `docs/doc-index.lock.json` 은 **검증 아티팩트**이지 SOT 가 아니다 — drift 신호 용도.

## Doc Impact Scan (구현 성공 후)

```bash
python3 ai/plugins/hns/scripts/doc_scan.py --base HEAD
```

출력:
- **Impacted docs**: 변경된 소스와 매핑된 문서 → 내용 갱신 검토
- **New sources**: 문서 미연결 신규 소스 → `docs/doc-index.json` 에 링크 등록 또는 문서 초안 작성
- **Deleted sources**: 삭제된 소스 → 연결 문서 아카이브/갱신 검토

JSON 출력이 필요한 경우 (agent 연동): `--json` 플래그.

## Lock Drift 검사

```bash
python3 ai/plugins/hns/scripts/doc_map.py --check
```

- 정책/소스/문서 변경 후 lock 이 오래되었으면 exit 1 + 안내 메시지.
- 갱신: `python3 ai/plugins/hns/scripts/doc_map.py` (인자 없이) → `docs/doc-index.lock.json` 재생성 → 커밋.

## 동기화 대상

- `spec.md` ↔ 실제 구현
- `tasks.md` ↔ 완료 상태
- `key-decisions.md` ↔ 코드 내 결정
- `docs/adr/**` ↔ 아키텍처 변경
- 서비스 `{service}/CLAUDE.md` ↔ 서비스 특성 변경

## Citation (선택)

문서 상단 또는 섹션 첫 줄에 HTML 주석으로 explicit link 선언 (컬럼 0 에서 시작):

```markdown
<!-- source: product/app/src/main/kotlin/com/kgd/product/service/ProductService.kt -->

# Product Service
```

렌더링에 영향 없음. `doc_map.py` 가 파싱하여 `link_type: explicit` 로 등록.

## 참고

- ADR-0023 Doc Index Tracking (`docs/adr/ADR-0023-doc-index-tracking.md`)
- 정책: `docs/doc-index.json`
- 검증 아티팩트: `docs/doc-index.lock.json`
