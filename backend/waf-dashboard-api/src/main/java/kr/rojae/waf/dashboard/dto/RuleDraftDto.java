package kr.rojae.waf.dashboard.dto;

import java.time.Instant;

public record RuleDraftDto(
        Long id,
        String name,
        String description,
        Boolean enabled,
        Severity severity,
        String category,
        String variables,
        String operator,
        String operatorData,
        String actions,
        Integer priority,
        Instant createdAt,
        Instant updatedAt
) {
    public enum Severity {
        CRITICAL,
        HIGH,
        MEDIUM,
        LOW,
        INFO
    }
}
