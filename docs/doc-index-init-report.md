# Doc Index — Initial Scan Report

- sources: 593
- docs: 148
- resolved links: 1105
- missing (source without doc): 124
- dangling (doc without source): 132

## Coverage by service

| Service | Total | Linked | Coverage |
|---|---:|---:|---:|
| admin | 47 | 0 | 0.0% |
| analytics | 29 | 29 | 100.0% |
| auth | 34 | 7 | 20.6% |
| charting | 74 | 74 | 100.0% |
| chatbot | 34 | 30 | 88.2% |
| common | 17 | 17 | 100.0% |
| experiment | 21 | 21 | 100.0% |
| fulfillment | 25 | 24 | 96.0% |
| gateway | 10 | 10 | 100.0% |
| gifticon | 112 | 69 | 61.6% |
| inventory | 44 | 43 | 97.7% |
| member | 17 | 17 | 100.0% |
| order | 33 | 33 | 100.0% |
| product | 31 | 31 | 100.0% |
| search | 33 | 33 | 100.0% |
| warehouse | 14 | 13 | 92.9% |
| wishlist | 18 | 18 | 100.0% |

## Next steps

1. `docs/doc-index.json` 의 `manual_links` / `pattern_rules` 를 채워 coverage 향상
2. 문서 상단에 `<!-- source: path/to/file.kt -->` 주석으로 explicit citation 추가
3. 재실행: `python3 ai/plugins/hns/scripts/doc_map.py`
