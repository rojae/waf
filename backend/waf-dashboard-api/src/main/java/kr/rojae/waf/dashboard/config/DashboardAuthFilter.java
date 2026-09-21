package kr.rojae.waf.dashboard.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import kr.rojae.waf.common.security.SharedJwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class DashboardAuthFilter extends OncePerRequestFilter {
    private static final Set<String> UNSAFE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final String cookieName;
    private final SharedJwtService jwtService;
    private final Set<String> allowedOrigins;
    private final ObjectMapper objectMapper;

    public DashboardAuthFilter(@Value("${app.jwt.secret}") String jwtSecret,
                               @Value("${app.jwt.access-ttl-seconds:900}") long ttlSeconds,
                               @Value("${app.jwt.cookie-name:WAF_AT}") String cookieName,
                               @Value("${app.cors.allowed-origins:http://localhost:3001}") String[] allowedOrigins,
                               ObjectMapper objectMapper) {
        this.cookieName = cookieName;
        this.jwtService = new SharedJwtService(jwtSecret, ttlSeconds);
        this.allowedOrigins = Arrays.stream(allowedOrigins).collect(Collectors.toUnmodifiableSet());
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod()) || !isApiPath(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String bearer = bearerToken(request);
        String cookieToken = cookieToken(request);
        String token = cookieToken != null ? cookieToken : bearer;
        boolean cookieAuth = cookieToken != null;

        if (token == null) {
            writeError(response, 401, "no_token");
            return;
        }
        if (cookieAuth && UNSAFE_METHODS.contains(request.getMethod()) && !allowedOrigin(request.getHeader(HttpHeaders.ORIGIN))) {
            writeError(response, 403, "invalid_origin");
            return;
        }
        try {
            JWTClaimsSet claims = jwtService.verifyAndClaims(token);
            request.setAttribute("waf.jwt.subject", claims.getSubject());
            filterChain.doFilter(request, response);
        } catch (SecurityException e) {
            writeError(response, 401, "invalid_token");
        }
    }

    private String bearerToken(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        return authorization.substring("Bearer ".length()).trim();
    }

    private String cookieToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        return Arrays.stream(cookies)
                .filter(cookie -> cookieName.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private boolean allowedOrigin(String origin) {
        return origin != null && allowedOrigins.contains(origin);
    }

    private boolean isApiPath(String requestUri) {
        return requestUri != null && (requestUri.equals("/api") || requestUri.startsWith("/api/") || requestUri.startsWith("/api;"));
    }

    private void writeError(HttpServletResponse response, int status, String error) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(), Map.of("error", error));
    }
}
