package kr.rojae.waf.social.domain.oauth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class OAuthStateServiceTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    @Test
    void consumesOnlyMatchingStateOnce() {
        OAuthStateService service = new OAuthStateService(SECRET, 300,
                Clock.fixed(Instant.parse("2026-09-22T00:00:00Z"), ZoneOffset.UTC));
        String state = service.issue();

        assertThat(service.consume("wrong", state)).isFalse();
        assertThat(service.consume(state, null)).isFalse();
        assertThat(service.consume(state, state)).isTrue();
        assertThat(service.consume(state, state)).isFalse();
    }

    @Test
    void rejectsExpiredState() {
        Clock issuedAt = Clock.fixed(Instant.parse("2026-09-22T00:00:00Z"), ZoneOffset.UTC);
        String state = new OAuthStateService(SECRET, 1, issuedAt).issue();
        OAuthStateService expiredVerifier = new OAuthStateService(SECRET, 1,
                Clock.fixed(issuedAt.instant().plusSeconds(2), ZoneOffset.UTC));

        assertThat(expiredVerifier.consume(state, state)).isFalse();
    }
}
