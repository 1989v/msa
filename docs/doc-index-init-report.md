# Doc Index — Initial Scan Report

- sources: 977
- docs: 204
- resolved links: 2023
- missing (source without doc): 225
- dangling (doc without source): 189

## Coverage by service

| Service | Total | Linked | Coverage |
|---|---:|---:|---:|
| admin | 48 | 0 | 0.0% |
| analytics | 30 | 30 | 100.0% |
| auth | 34 | 7 | 20.6% |
| chatbot | 34 | 30 | 88.2% |
| common | 31 | 31 | 100.0% |
| experiment | 21 | 21 | 100.0% |
| fulfillment | 21 | 20 | 95.2% |
| gateway | 10 | 10 | 100.0% |
| gifticon | 112 | 69 | 61.6% |
| inventory | 46 | 45 | 97.8% |
| member | 17 | 17 | 100.0% |
| order | 34 | 34 | 100.0% |
| product | 34 | 34 | 100.0% |
| root | 440 | 340 | 77.3% |
| search | 33 | 33 | 100.0% |
| warehouse | 14 | 13 | 92.9% |
| wishlist | 18 | 18 | 100.0% |

## Next steps

1. `docs/doc-index.json` 의 `manual_links` / `pattern_rules` 를 채워 coverage 향상
2. 문서 상단에 `<!-- source: path/to/file.kt -->` 주석으로 explicit citation 추가
3. 재실행: `python3 ai/plugins/hns/scripts/doc_map.py`
