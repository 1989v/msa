FROM eclipse-temurin:25-jre-alpine AS runtime

ARG MODULE
RUN test -n "$MODULE" || (echo "ERROR: MODULE build arg is required" && exit 1)

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY ${MODULE}/build/libs/${MODULE}-*.jar app.jar

RUN chown appuser:appgroup app.jar

USER appuser

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
