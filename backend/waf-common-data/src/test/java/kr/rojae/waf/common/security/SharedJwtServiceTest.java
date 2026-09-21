package kr.rojae.waf.common.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import kr.rojae.waf.social.dto.OAuthUser;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SharedJwtServiceTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-22T00:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejectsShortSecret() {
        assertThatThrownBy(() -> new SharedJwtService("short", 900, CLOCK))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void issuesAndVerifiesHs256Token() {
        SharedJwtService service = new SharedJwtService(SECRET, 900, CLOCK);

        String token = service.issue(OAuthUser.builder().sub("sub-1").email("a@example.com").name("A").build());

        assertThat(service.verifyAndClaims(token).getSubject()).isEqualTo("sub-1");
    }

    @Test
    void rejectsMissingExpiryAndWrongAlgorithm() throws Exception {
        SignedJWT noExpiry = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256),
                new JWTClaimsSet.Builder().subject("sub-1").build());
        noExpiry.sign(new MACSigner(SECRET));

        SignedJWT wrongAlgorithm = new SignedJWT(new JWSHeader(JWSAlgorithm.HS384),
                new JWTClaimsSet.Builder()
                        .subject("sub-1")
                        .expirationTime(Date.from(CLOCK.instant().plusSeconds(60)))
                        .build());
        wrongAlgorithm.sign(new MACSigner("0123456789abcdef0123456789abcdef0123456789abcdef"));

        SharedJwtService service = new SharedJwtService(SECRET, 900, CLOCK);
        assertThatThrownBy(() -> service.verifyAndClaims(noExpiry.serialize()))
                .isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.verifyAndClaims(wrongAlgorithm.serialize()))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    void rejectsExpiredToken() {
        SharedJwtService issuer = new SharedJwtService(SECRET, 1, CLOCK);
        String token = issuer.issue(OAuthUser.builder().sub("sub-1").build());
        SharedJwtService verifier = new SharedJwtService(SECRET, 1,
                Clock.fixed(CLOCK.instant().plusSeconds(2), ZoneOffset.UTC));

        assertThatThrownBy(() -> verifier.verifyAndClaims(token))
                .isInstanceOf(SecurityException.class);
    }
}
