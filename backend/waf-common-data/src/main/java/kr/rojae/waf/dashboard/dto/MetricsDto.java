package kr.rojae.waf.dashboard.dto;

import lombok.Builder;

import java.util.Map;

@Builder
public record MetricsDto(
        Long totalRequests,
        Long blockedRequests,
        Double blockRate,
        Map<String, Integer> attackTypeStats,
        Map<String, Integer> geoStats,
        Map<String, Integer> severityStats,
        Map<String, Integer> hourlyStats,
        Double systemUptime
) {}