package kr.rojae.waf.dashboard.dto;

import java.time.Instant;

public record WhitelistDraftDto(
        String id,
        String ip,
        String description,
        Boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
}
