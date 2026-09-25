# 옛 `-dlt` 토픽 점검·재발행

DLT 이름이 `<원 토픽>-dlt`(Spring Kafka 기본값)에서 `<원 토픽>.DLT` 로 바뀌었다(`docs/architecture/kafka-convention.md` §DLQ).
새 `{domain}-dlt-ops` 리스너는 `.*\.DLT` 만 구독하므로 **바뀌기 전에 `-dlt` 로 들어간 레코드는 아무도 보지 않는다.**
배포 뒤 한 번 확인하고, 레코드가 있으면 아래 순서로 처리한 뒤 토픽을 지운다.

모든 명령은 운영 노드에서 `sudo k3s kubectl` 로 돈다(로컬은 `kubectl`). 브로커는 `commerce` 네임스페이스의 `kafka-0`,
클러스터 내부 리스너는 `29092` 다.

```bash
K="sudo k3s kubectl exec -n commerce kafka-0 --"
BS="--bootstrap-server localhost:29092"
```

## 1. 목록과 레코드 수

```bash
# -dlt 로 끝나는 토픽
$K kafka-topics.sh $BS --list | grep -- '-dlt$'

# 토픽별 파티션 끝 오프셋(= 지금까지 들어온 레코드 수, 보존 기간 안의 것)
for t in $($K kafka-topics.sh $BS --list | grep -- '-dlt$'); do
  echo "== $t"; $K kafka-get-offsets.sh $BS --topic "$t"
done
```

모든 파티션이 `:0` 이면 비어 있다 → 4 로 간다.

## 2. 레코드 살펴보기

```bash
T=order.saga.command-dlt   # 예시
$K kafka-console-consumer.sh $BS --topic "$T" --from-beginning --timeout-ms 10000 \
  --property print.key=true --property print.headers=true --property print.timestamp=true
```

헤더 `kafka_dlt-original-topic` · `kafka_dlt-original-consumer-group` · `kafka_dlt-exception-message` 로 어느 컨슈머가
왜 실패했는지 본다. 실패 원인이 이미 고쳐졌는지부터 확인한다 — 안 고쳐졌으면 재발행해도 같은 자리에서 다시 떨어진다.

## 3. 재발행 (원 토픽으로)

**원 토픽을 지금도 구독하는 컨슈머가 있을 때만** 재발행한다. 사가 전환으로 은퇴한 흐름(`order.order.cancelled` 등
코레오그래피 토픽)은 재발행하면 은퇴한 동작을 다시 깨우므로 하지 않는다 — 원장에 건수만 적고 4 로 간다.
컨슈머는 eventId 로 멱등이라 같은 레코드가 두 번 가도 한 번만 반영된다.

```bash
T=order.saga.command-dlt; ORIG=${T%-dlt}
# 키와 값만 옮긴다(콘솔 도구는 바이너리 헤더를 그대로 옮기지 못한다). 키 구분자는 값에 없는 문자로.
$K kafka-console-consumer.sh $BS --topic "$T" --from-beginning --timeout-ms 10000 \
  --property print.key=true --property key.separator=$'\x1f' > /tmp/"$T".txt
wc -l /tmp/"$T".txt                      # 1 의 레코드 수와 같은지 확인
$K kafka-console-producer.sh $BS --topic "$ORIG" \
  --property parse.key=true --property key.separator=$'\x1f' < /tmp/"$T".txt
```

키를 그대로 옮겨야 같은 파티션(같은 집계)으로 간다. 헤더(`traceparent` 등)는 옮겨지지 않는다 — 원 컨슈머가 헤더를
판정에 쓰는지 먼저 본다(commerce 컨슈머는 페이로드의 eventId 로 판정한다). 재발행 뒤 그 컨슈머 그룹 lag 이 0 으로
돌아오고, 다시 실패하면 이번에는 `<원 토픽>.DLT` 로 가서 운영 이슈(`/api/v1/admin/**/ops-issues`)에 잡힌다.

## 4. 정리

```bash
$K kafka-topics.sh $BS --delete --topic "$T"
```

토픽 자동 생성이 켜진 환경이면 옛 코드가 남아 있는 한 다시 생긴다 — 배포된 이미지가 `DltKafka.deadLetterRecoverer`
를 쓰는 판인지 먼저 확인한다.
