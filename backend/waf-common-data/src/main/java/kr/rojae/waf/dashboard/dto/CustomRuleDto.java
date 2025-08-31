package kr.rojae.waf.dashboard.dto;

import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record CustomRuleDto(
        String id,
        String name,
        String pattern,
        String action,
        Boolean enabled,
        String description,
        Integer priority,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}