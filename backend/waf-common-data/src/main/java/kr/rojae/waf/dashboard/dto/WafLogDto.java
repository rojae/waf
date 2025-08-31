package kr.rojae.waf.dashboard.dto;

import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record WafLogDto(
        String id,
        LocalDateTime timestamp,
        String clientIp,
        String method,
        String uri,
        Integer statusCode,
        String attackType,
        String severity,
        String country,
        String message,
        Boolean blocked,
        String userAgent,
        Long responseTime
) {}