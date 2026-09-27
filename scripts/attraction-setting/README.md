# 관광지 실내·실외 (`attractions.setting`)

검색이 「실내」·「비 오는 날」·`indoor`·`rainy day` 질의를 `setting=indoor` 필터로 바꾼다(질의 이해 `SETTING_INTENTS`).
값은 TourAPI 원천에 없는 **파생 값**이라 여기서 채운다. 목록 동기화는 이 컬럼을 지우지 않는다(`Attraction.syncFrom`).

| 파일 | 무엇 |
|---|---|
| `rules.py` | 분류 코드(`lcls_systm3`) 접두로 정해지는 것 — 박물관·전시관·공연장 = 실내, 자연·유적·캠핑·공원·레저 = 실외 |
| `extract.py` | 규칙이 못 정하는 관광 분류(기타체험·테마파크·전망대 등)만 개요를 읽혀 판정. 맥 로컬 모델, 비용 0 |
| `apply.py` | 위 둘을 `UPDATE` 문으로 만든다 |
| `llm-ko-2026-09-27.csv` | 2026-09-27 판정 결과(국문) — 모델을 다시 돌리지 않고 재적용할 수 있게 남긴다 |

## 돌리는 법

```bash
# 1. 규칙 — 규칙을 고쳤을 때도 이것만 다시 돌린다
~/.local/bin/oci-mysql --write place_db "$(python3 apply.py rules)"

# 2. 애매한 분류만 LLM 판정 (문서 덤프는 attractions 색인에서 lang=ko 로 뽑는다)
llama-server -hf Qwen/Qwen3-8B-GGUF:Q4_K_M --jinja -np 8 -c 32768 -ngl 99 --port 18080
python3 extract.py ko.jsonl out.jsonl --workers 8
~/.local/bin/oci-mysql --write place_db "$(python3 apply.py llm llm-ko-<날짜>.csv)"

# 3. 다음 재색인(KST 04:30)부터 검색에 실린다. 바로 보려면
ssh msa-oci 'sudo kubectl -n commerce create job --from=cronjob/attraction-reindex attraction-reindex-manual'
```

## 품질 (2026-09-27, 무작위 관광지 100건 수동 채점)

| 방식 | 결과 | 판단 |
|---|---|---|
| 여러 속성을 한 번에(테마 최대 4개 배열) | 테마가 45건 중 약 28건에 틀린 값 — 빈칸을 채우려 같은 값 반복·근거 없는 「야경」 | 버림 |
| 테마마다 예/아니오 | 실내·실외 약 43/46, 테마·계절은 여전히 잦은 오답, 건당 4.6초 | 실내·실외만 쓸 만함 |
| 실내·실외만 | 건당 1.2초. 틀린 것은 스키장·서핑장·문화재 건물 — 전부 분류 규칙이 먼저 정하는 코드 | **채택 (규칙 + 애매한 분류만 LLM)** |

영문 문서는 TourAPI 영문판의 contentId 가 따로라 규칙으로만 채워진다.
새로 들어온 관광지의 애매한 분류는 다시 돌리기 전까지 비어 있다 — 필터에서 빠질 뿐 검색은 된다.
