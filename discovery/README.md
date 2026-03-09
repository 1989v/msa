# discovery

Spring Cloud Netflix Eureka 서비스 디스커버리 서버.
모든 마이크로서비스가 이 서버에 등록하고, Gateway가 `lb://` 로드밸런서 주소로 조회한다.

## 포트: 8761

## Eureka 대시보드

서비스 기동 후 브라우저에서 확인:

```
http://localhost:8761
```

등록된 서비스 목록, 인스턴스 상태, 하트비트 정보를 확인할 수 있다.

## 로컬 실행

다른 모든 서비스보다 먼저 기동해야 한다.

```bash
./gradlew :discovery:bootRun
```

## 의존 인프라

없음. 독립 실행 가능.

## 빌드

```bash
./gradlew :discovery:build
```

## 주의사항

- `discovery`가 기동되지 않은 상태에서 다른 서비스를 실행하면 Eureka 연결 오류가 로그에 출력되지만, 서비스 자체는 기동된다 (연결 재시도).
- 프로덕션 환경에서는 고가용성을 위해 Eureka 서버를 2개 이상 운영할 것을 권장한다.
