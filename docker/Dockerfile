# ============================================================
# Stage 1: Build
# ============================================================
FROM eclipse-temurin:25-jdk-alpine AS builder

ARG MODULE
RUN test -n "$MODULE" || (echo "ERROR: MODULE build arg is required" && exit 1)

WORKDIR /workspace

# Gradle wrapper 및 설정 파일 복사 (캐시 최적화)
COPY gradlew gradlew.bat ./
COPY gradle/ gradle/
COPY settings.gradle.kts build.gradle.kts ./

# 각 모듈의 build.gradle.kts 복사 (소스 제외 — 의존성 캐싱용)
COPY common/build.gradle.kts common/
COPY discovery/build.gradle.kts discovery/
COPY gateway/build.gradle.kts gateway/
COPY product/build.gradle.kts product/
COPY order/build.gradle.kts order/
COPY search/build.gradle.kts search/

# 의존성 다운로드 (소스 변경과 분리하여 캐시 레이어 활용)
RUN ./gradlew :${MODULE}:dependencies --no-daemon 2>/dev/null || true

# 전체 소스 복사 후 빌드
COPY . .

RUN ./gradlew :${MODULE}:bootJar -x test --no-daemon

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM eclipse-temurin:25-jre-alpine AS runtime

ARG MODULE

WORKDIR /app

# Non-root user 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# JAR 복사
COPY --from=builder /workspace/${MODULE}/build/libs/${MODULE}-*.jar app.jar

RUN chown appuser:appgroup app.jar

USER appuser

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
