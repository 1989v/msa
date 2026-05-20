# Search Bandit Redis 운영 — TTL / Eviction / 마이그레이션

ADR-0050 Phase 3 의 다중 scope MAB 도입으로 `bandit:state:*` 키 수가 `scope * productId` 로 증가한다.
brand 추가 시 약 ~10x 증가 추정 (카탈로그 brand cardinality 가정).

## Key 패턴

- 상태: `bandit:state:{scope}:{productId}` — Redis Hash (`clicks`, `impressions`, `lastTs`)
- 중복 방어: `bandit:seen:{kind}:{searchId}:{productId}` — String + TTL 300s

## TTL 정책

`bandit:state:*` 는 영구 보존이 아니며 **90일 비활성 키는 TTL 만료** 시킨다.
정책 적용 (Redis EXPIRE):

1. analytics 의 `BanditStateRedisWriter.incrementImpression/Click` 가 매 write 마다 TTL 갱신 (sliding):
   - `redis.expire(key, Duration.ofDays(90))`
2. 또는 Redis 인스턴스 단위 `maxmemory-policy allkeys-lru` 적용 후 hot key 만 메모리 유지

권장: (1) sliding TTL — 명시적, 운영 가시성 좋음. (2) 는 fallback / 보수적 안전망.

## maxmemory 정책 (Redis-side)

운영 instance:
```
CONFIG SET maxmemory "2gb"
CONFIG SET maxmemory-policy "allkeys-lru"
```
TTL 적용된 `bandit:state:*` 와 함께 안전망. `allkeys-lru` 는 모든 key 대상이라 다른 캐시에 영향 — 별도
Redis DB index 또는 namespace 분리 권장.

## 메모리 사용 추정

- key 1개 평균 64 byte (string) + hash 3 field × ~16 byte = ~110 byte
- 1M product × 1 scope = 110MB
- 1M product × 3 scope (category + brand + price-tier) = 330MB
- 1M product × 3 scope × 2 (decay window 분리 시) = 660MB

기준선: 1GB Redis 로 10M arm 정도 안전. 초과 시 scope 축소 또는 maxmemory 증설.

## 마이그레이션 (ADR-0050 Phase 3 적용)

기존 키 포맷: `bandit:state:{categoryId}:{productId}` (Phase 2)
변경 후 포맷: `bandit:state:{scope}:{productId}` — scope = `category:{id}` (Phase 3)

→ 기존 키는 **invalidate (자연 cold-start)**. ADR-0043 의 prior + impressionThreshold 가 보호.
가속화하려면 운영자가 수동으로 키 prefix 변경 스크립트 실행:

```bash
# 예: 기존 bandit:state:elec:p1 → bandit:state:category:elec:p1 으로 RENAME
redis-cli --scan --pattern 'bandit:state:*' | while read k; do
  new=$(echo "$k" | sed 's/^bandit:state:/bandit:state:category:/')
  redis-cli RENAME "$k" "$new"
done
```

> ⚠️ 위 스크립트는 **첫 RENAME 만 안전**. 두 번 실행하면 `category:category:elec:p1` 가 됨.
> 적용 전 dry-run 권장.

## 모니터링

- `INFO memory` → `used_memory_human`
- `KEYS bandit:state:*` 카운트 (운영 시 `SCAN` 으로 대체)
- Prometheus + redis_exporter 의 `redis_db_keys{db="0"}` gauge

## 알람

- Redis used_memory > 80% maxmemory → Slack 알람 (Grafana)
- 이전 24h 대비 keys ↑ 200% → 스코프 추가 / 누수 가능성 점검
