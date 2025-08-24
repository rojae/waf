package kr.rojae.waf.dashboard.dto;

import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record WhitelistDto(
        String id,
        String ip,
        String description,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}