# Multi-stage Dockerfile for Spring Boot services

# Build stage
FROM eclipse-temurin:21-jdk-alpine as builder

WORKDIR /app
COPY . .

# Build all modules
RUN ./gradlew build -x test

# Dashboard API Stage
FROM eclipse-temurin:21-jre-alpine as dashboard-api

WORKDIR /app

# Create writable runtime directories for custom rules and dashboard draft state.
RUN mkdir -p /app/custom-rules /app/modsecurity-rules /app/data

# Copy the built jar
COPY --from=builder /app/waf-dashboard-api/build/libs/waf-dashboard-api-*.jar app.jar

# Create non-root user
RUN addgroup -g 10001 -S spring && adduser -u 10001 -S spring -G spring spring
RUN chown -R spring:spring /app
USER spring

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

# Social API Stage  
FROM eclipse-temurin:21-jre-alpine as social-api

WORKDIR /app

# Copy the built jar
COPY --from=builder /app/waf-social-api/build/libs/waf-social-api-*.jar app.jar

# Create non-root user
RUN addgroup -g 10001 -S spring && adduser -u 10001 -S spring -G spring spring
RUN chown -R spring:spring /app
USER spring

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "/app/app.jar"]