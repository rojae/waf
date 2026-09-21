package kr.rojae.waf.social.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AuthCallbackResponse(
    @JsonProperty("success") boolean success,
    @JsonProperty("access_token") String accessToken,
    @JsonProperty("accessToken") String accessTokenCamel,
    @JsonProperty("expires_in") long expiresInSnake,
    @JsonProperty("expiresIn") long expiresIn,
    @JsonProperty("user") Object user,
    @JsonProperty("redirect_url") String redirectUrl,
    @JsonProperty("cookie_name") String cookieName,
    @JsonProperty("cookie_domain") String cookieDomain,
    @JsonProperty("cookie_path") String cookiePath,
    @JsonProperty("cookie_max_age") long cookieMaxAge,
    @JsonProperty("cookie_secure") boolean cookieSecure,
    @JsonProperty("cookie_http_only") boolean cookieHttpOnly,
    @JsonProperty("cookie_same_site") String cookieSameSite
) {
    public static AuthCallbackResponse success(String accessToken, Object user, String redirectUrl, String cookieName,
                                             String cookieDomain, String cookiePath, long cookieMaxAge,
                                             boolean cookieSecure, boolean cookieHttpOnly, String cookieSameSite) {
        return new AuthCallbackResponse(true, accessToken, accessToken, cookieMaxAge, cookieMaxAge, user, redirectUrl, cookieName, cookieDomain,
                                      cookiePath, cookieMaxAge, cookieSecure, cookieHttpOnly, cookieSameSite);
    }

    public static AuthCallbackResponse error(String redirectUrl) {
        return new AuthCallbackResponse(false, null, null, 0, 0, null, redirectUrl, null, null, null, 0, false, false, null);
    }
}
