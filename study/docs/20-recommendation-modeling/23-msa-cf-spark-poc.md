---
parent: 20-recommendation-modeling
seq: 23
title: Phase 2 구현 — Item-Item CF Spark PoC, 공출현 행렬 + PMI, ClickHouse 저장, similar-items API
type: deep
created: 2026-05-12
---

# 23. Phase 2 — CF Spark PoC 구현

> **Phase 10 - Phase 2**. §02 의 Item-Item CF + §03 의 ALS 가능성. ClickHouse 에서 행동 데이터 → Spark CF 잡 → item similarity → Redis 캐시 → similar-items API.

---

## 1. 구현 범위

```
ClickHouse: recommendation_events
   ↓ (Spark 잡, 일일 실행)
Spark: 공출현 행렬 + PPMI 계산
   ↓
ClickHouse: item_similarity 테이블
   ↓ (Redis sync)
Redis: reco:similar:{item_id}
   ↓
GET /api/v1/recommendations/similar-items
```

---

## 2. Spark CF 잡 — Item-Item CF + PPMI

```scala
// recommendation/batch/.../cf/ItemItemCfJob.scala
package com.kgd.recommendation.batch.cf

import org.apache.spark.sql.{SparkSession, Dataset}
import org.apache.spark.sql.functions._

object ItemItemCfJob {
  
  case class UserItemAction(user_id: Long, item_id: Long, action_type: String)
  case class ItemPair(item_a: Long, item_b: Long)
  case class ItemSimilarity(item_a: Long, item_b: Long, similarity: Double, metric: String)
  
  def run(spark: SparkSession, ckHouseConfig: ClickHouseConfig): Unit = {
    import spark.implicits._
    
    // 1. ClickHouse 에서 행동 데이터 로드 (30일 분)
    val actions = spark.read
      .format("jdbc")
      .option("url", s"jdbc:clickhouse://${ckHouseConfig.host}:8123/recommendation")
      .option("query", """
        SELECT user_id, item_id, action_type
        FROM recommendation_events
        WHERE timestamp >= now() - INTERVAL 30 DAY
          AND action_type IN ('click', 'addwish', 'reservation')
      """)
      .load()
      .as[UserItemAction]
    
    // 2. 사용자별 행동 item 집합
    val userItems = actions
      .groupBy("user_id")
      .agg(collect_set("item_id").as("items"))
      .filter(size($"items") >= 2)  // 최소 2개 행동
    
    // 3. 공출현 행렬 (item × item)
    val itemPairs = userItems
      .flatMap { row =>
        val items = row.getAs[Seq[Long]]("items")
        for {
          a <- items
          b <- items
          if a != b
        } yield ItemPair(a, b)
      }
      .groupBy("item_a", "item_b")
      .count()
      .withColumnRenamed("count", "co_count")
    
    // 4. 아이템별 등장 수 (P(i) 계산용)
    val itemCounts = actions
      .groupBy("item_id")
      .agg(countDistinct("user_id").as("user_count"))
    
    val totalUsers = actions.select(countDistinct("user_id")).first().getLong(0)
    
    // 5. PPMI 계산 (§02 §5)
    val similarity = itemPairs
      .join(itemCounts.withColumnRenamed("item_id", "item_a")
                      .withColumnRenamed("user_count", "count_a"), Seq("item_a"))
      .join(itemCounts.withColumnRenamed("item_id", "item_b")
                      .withColumnRenamed("user_count", "count_b"), Seq("item_b"))
      .withColumn("p_ab", $"co_count" / lit(totalUsers))
      .withColumn("p_a", $"count_a" / lit(totalUsers))
      .withColumn("p_b", $"count_b" / lit(totalUsers))
      .withColumn("pmi", log($"p_ab" / ($"p_a" * $"p_b")))
      .withColumn("ppmi", greatest($"pmi", lit(0.0)))
      .filter($"co_count" >= 5)  // 최소 5번 공출현 (sparse 함정 회피)
      .filter($"ppmi" > 0)
      .select(
        $"item_a", 
        $"item_b", 
        $"ppmi".as("similarity"),
        lit("ppmi").as("metric")
      )
      .as[ItemSimilarity]
    
    // 6. ClickHouse 에 저장 (Top-50 per item)
    val top50 = similarity
      .withColumn("rank", 
        row_number().over(
          org.apache.spark.sql.expressions.Window
            .partitionBy("item_a")
            .orderBy(desc("similarity"))
        )
      )
      .filter($"rank" <= 50)
      .drop("rank")
    
    top50.write
      .format("jdbc")
      .option("url", s"jdbc:clickhouse://${ckHouseConfig.host}:8123/recommendation")
      .option("dbtable", "item_similarity")
      .mode("overwrite")
      .save()
  }
}
```

---

## 3. Spark Job 의 K8s 배포 — Spark Operator

```yaml
# k8s/overlays/prod-k8s/recommendation/cf-spark-job.yaml
apiVersion: sparkoperator.k8s.io/v1beta2
kind: SparkApplication
metadata:
  name: recommendation-cf-daily
spec:
  type: Scala
  mode: cluster
  image: gcr.io/kgd/recommendation-batch:1.0.0
  imagePullPolicy: IfNotPresent
  mainClass: com.kgd.recommendation.batch.cf.ItemItemCfJob
  mainApplicationFile: local:///opt/spark/jars/recommendation-batch.jar
  
  sparkVersion: 3.5.0
  driver:
    cores: 2
    memory: 4g
  executor:
    cores: 2
    instances: 10
    memory: 8g
  
  deps:
    jars:
      - https://repo1.maven.org/maven2/com/clickhouse/clickhouse-jdbc/0.4.6/clickhouse-jdbc-0.4.6.jar
```

Argo Workflow 가 매일 02:00 에 이 SparkApplication trigger.

---

## 4. ClickHouse → Redis Sync (Phase 2)

```kotlin
// recommendation/batch/.../sync/ItemSimilaritySync.kt
@Component
class ItemSimilaritySync(
    private val clickHouse: NamedParameterJdbcTemplate,
    private val redisTemplate: RedisTemplate<String, String>,
) {
    fun sync() {
        // 청크 단위로 처리 (수백만 row)
        val chunkSize = 10_000
        var offset = 0L
        
        while (true) {
            val rows = clickHouse.query(
                """
                SELECT item_a, item_b, similarity
                FROM item_similarity
                ORDER BY item_a, similarity DESC
                LIMIT $chunkSize OFFSET $offset
                """,
                mapOf<String, Any>()
            ) { rs, _ ->
                SimilarityRow(
                    itemA = rs.getLong("item_a"),
                    itemB = rs.getLong("item_b"),
                    similarity = rs.getDouble("similarity"),
                )
            }
            
            if (rows.isEmpty()) break
            
            // ZADD 로 Redis ZSET 에 추가
            rows.groupBy { it.itemA }.forEach { (itemA, group) ->
                val key = "reco:similar:$itemA"
                group.forEach { row ->
                    redisTemplate.opsForZSet().add(key, row.itemB.toString(), row.similarity)
                }
                redisTemplate.expire(key, Duration.ofHours(25))
            }
            
            offset += chunkSize
        }
    }
}
```

---

## 5. ItemSimilarityPort 구현

```kotlin
// recommendation/app/.../infrastructure/persistence/RedisItemSimilarityAdapter.kt
@Component
class RedisItemSimilarityAdapter(
    private val redisTemplate: RedisTemplate<String, String>,
) : ItemSimilarityPort {
    
    override fun findSimilar(itemId: Long, limit: Int): List<RecommendationItem> {
        val key = "reco:similar:$itemId"
        val tuples = redisTemplate.opsForZSet()
            .reverseRangeWithScores(key, 0, (limit - 1).toLong())
            ?: return emptyList()
        
        return tuples.map { tuple ->
            RecommendationItem(
                itemId = tuple.value?.toLong() ?: 0,
                score = tuple.score ?: 0.0,
                source = "item-item-cf-ppmi",
            )
        }
    }
}
```

---

## 6. Use Case + Controller

```kotlin
// application/usecase/GetSimilarItemsUseCase.kt
@UseCase
class GetSimilarItemsUseCase(
    private val itemSimilarityPort: ItemSimilarityPort,
    private val categoryBestUseCase: GetCategoryBestUseCase,
    private val itemMetadataPort: ItemMetadataPort,
) {
    fun execute(itemId: Long, limit: Int): Recommendation {
        val similar = itemSimilarityPort.findSimilar(itemId, limit)
        
        // Cold-start fallback: 비슷한 아이템 데이터 부족 → CB 로 폴백 (§17)
        if (similar.size < limit / 2) {
            val item = itemMetadataPort.getItem(itemId)
            val fallback = categoryBestUseCase.execute(
                cityId = item.cityId,
                categoryId = item.categoryId,
                limit = limit - similar.size,
            )
            return Recommendation(
                type = RecommendationType.SIMILAR_ITEMS,
                userId = null,
                context = RecommendationContext(
                    cityId = item.cityId,
                    categoryId = item.categoryId,
                    sourceItemId = itemId,
                ),
                items = similar + fallback.items,
                generatedAt = Instant.now(),
            )
        }
        
        return Recommendation(
            type = RecommendationType.SIMILAR_ITEMS,
            userId = null,
            context = RecommendationContext(
                cityId = null,
                categoryId = null,
                sourceItemId = itemId,
            ),
            items = similar,
            generatedAt = Instant.now(),
        )
    }
}

// presentation/RecommendationController.kt 확장
@GetMapping("/similar-items")
fun similarItems(
    @RequestParam itemId: Long,
    @RequestParam(defaultValue = "20") limit: Int,
): ApiResponse<RecommendationDto> {
    val result = getSimilarItems.execute(itemId, limit)
    return ApiResponse.ok(result.toDto())
}
```

**핵심**: cold-start fallback 명시 — 비슷한 아이템 데이터 부족 시 CB 로 보완 (§17).

---

## 7. Test — Kotest

```kotlin
class GetSimilarItemsUseCaseSpec : BehaviorSpec({
    val itemSimilarityPort = mockk<ItemSimilarityPort>()
    val categoryBestUseCase = mockk<GetCategoryBestUseCase>()
    val itemMetadataPort = mockk<ItemMetadataPort>()
    val useCase = GetSimilarItemsUseCase(itemSimilarityPort, categoryBestUseCase, itemMetadataPort)
    
    Given("item 1001 has 20 similar items") {
        every { itemSimilarityPort.findSimilar(1001, 20) } returns (1..20).map {
            RecommendationItem(itemId = 1000L + it, score = 1.0 - it * 0.01, source = "item-item-cf-ppmi")
        }
        
        When("execute") {
            val result = useCase.execute(1001, 20)
            
            Then("returns 20 similar items, no fallback") {
                result.items.size shouldBe 20
                result.items.all { it.source == "item-item-cf-ppmi" } shouldBe true
            }
        }
    }
    
    Given("item 1002 has only 5 similar (sparse)") {
        every { itemSimilarityPort.findSimilar(1002, 20) } returns (1..5).map {
            RecommendationItem(itemId = 2000L + it, score = 0.5, source = "item-item-cf-ppmi")
        }
        every { itemMetadataPort.getItem(1002) } returns Item(id = 1002, cityId = 1, categoryId = 10)
        every { categoryBestUseCase.execute(1, 10, 15) } returns Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(1, 10, null),
            items = (1..15).map {
                RecommendationItem(itemId = 3000L + it, score = 100.0, source = "category-best")
            },
            generatedAt = Instant.now(),
        )
        
        When("execute") {
            val result = useCase.execute(1002, 20)
            
            Then("returns 5 CF + 15 CB fallback") {
                result.items.size shouldBe 20
                result.items.take(5).all { it.source == "item-item-cf-ppmi" } shouldBe true
                result.items.drop(5).all { it.source == "category-best" } shouldBe true
            }
        }
    }
})
```

---

## 8. 성능 / SLA

```
Spark 잡 (일일):
   학습 시간: ~30 min (1억 events, 100만 items, 10 executor × 2 core × 8GB)
   결과: ~5천만 item_a × item_b 페어 (Top-50 per item)
   ClickHouse → Redis sync: ~15 min

API latency:
   P50: < 5 ms (Redis ZRANGEBYSCORE)
   P99: < 20 ms (with cold-start fallback to CB)
```

---

## 9. ALS 옵션 (§03 활용)

PPMI 대신 Spark MLlib ALS 사용 가능:

```scala
import org.apache.spark.ml.recommendation.ALS

val als = new ALS()
  .setRank(50)
  .setMaxIter(15)
  .setRegParam(0.1)
  .setAlpha(40)
  .setImplicitPrefs(true)
  .setUserCol("user_id")
  .setItemCol("item_id")
  .setRatingCol("click_count")  // confidence base

val model = als.fit(implicitDF)

// Item embeddings 추출
val itemFactors = model.itemFactors  // (id, features) DataFrame

// Item-Item similarity = cosine of item embeddings
val similarities = itemFactors
  .crossJoin(itemFactors.toDF("id_b", "features_b"))
  .withColumn("similarity", cosine_udf($"features", $"features_b"))
  .filter($"id" < $"id_b")
```

장점: side feature 활용 가능 (item metadata 추가). 단점: PPMI 보다 학습 시간 길음.

선택 기준 (Phase 2 의 미결정):
- PPMI: 단순, 빠른 prototype → 권장 default
- ALS: rich item features 활용 가능 → 향후 전환

---

## 10. 점진 도입 체크리스트 (Phase 2)

- [ ] `recommendation/batch` 모듈 생성 (Scala 또는 PySpark)
- [ ] Spark CF 잡 — 공출현 행렬 + PPMI
- [ ] ClickHouse `item_similarity` 테이블 생성
- [ ] Argo Workflow daily SparkApplication
- [ ] ClickHouse → Redis sync 잡
- [ ] `ItemSimilarityPort` + adapter
- [ ] `GetSimilarItemsUseCase` + cold-start fallback
- [ ] GET /api/v1/recommendations/similar-items
- [ ] Kotest 단위 + 통합 테스트
- [ ] Phase 1 (CB) 와의 A/B 비교

---

## 11. cross-ref

| 주제 | 연결된 study |
|---|---|
| PMI / PPMI 메트릭 | §02 §5 |
| ALS / Implicit ALS | §03 §6 |
| 공출현 행렬 패턴 | §02 §2 |
| Sparse data 함정 | §02 §10 |
| Cold-start fallback | §17 §3 |
| ADR 도입 단계 (Phase 2) | §20 |
| Spark + K8s | §18 |
| 다음: Two-Tower ANN | §24 |
