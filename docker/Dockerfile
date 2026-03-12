# ============================================================
# Stage 1: Build
# ============================================================
FROM eclipse-temurin:25-jdk-alpine AS builder

ARG MODULE_GRADLE
ARG MODULE_PATH
RUN test -n "$MODULE_GRADLE" || (echo "ERROR: MODULE_GRADLE build arg is required" && exit 1)
RUN test -n "$MODULE_PATH"   || (echo "ERROR: MODULE_PATH build arg is required"   && exit 1)

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
COPY product/domain/build.gradle.kts product/domain/
COPY product/app/build.gradle.kts product/app/
COPY order/build.gradle.kts order/
COPY order/domain/build.gradle.kts order/domain/
COPY order/app/build.gradle.kts order/app/
COPY search/build.gradle.kts search/
COPY search/domain/build.gradle.kts search/domain/
COPY search/app/build.gradle.kts search/app/
COPY search/consumer/build.gradle.kts search/consumer/
COPY search/batch/build.gradle.kts search/batch/

# 의존성 다운로드 (소스 변경과 분리하여 캐시 레이어 활용)
RUN ./gradlew :${MODULE_GRADLE}:dependencies --no-daemon 2>/dev/null || true

# 전체 소스 복사 후 빌드
COPY . .

RUN ./gradlew :${MODULE_GRADLE}:bootJar -x test --no-daemon

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM eclipse-temurin:25-jre-alpine AS runtime

ARG MODULE_PATH

WORKDIR /app

# Non-root user 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# JAR 복사
COPY --from=builder /workspace/${MODULE_PATH}/build/libs/*.jar app.jar

RUN chown appuser:appgroup app.jar

USER appuser

ARG SERVER_PORT=8080
ENV SERVER_PORT=${SERVER_PORT}
EXPOSE ${SERVER_PORT}

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
