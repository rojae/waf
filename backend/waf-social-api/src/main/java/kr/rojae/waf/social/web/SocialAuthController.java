package kr.rojae.waf.social.web;

import kr.rojae.waf.social.application.AuthUseCase;
import kr.rojae.waf.social.dto.AuthCallbackResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.CookieValue;

import java.util.Map;

@Controller
@RequiredArgsConstructor
@RequestMapping("/auth")
@Slf4j
public class SocialAuthController {

    private final AuthUseCase authUseCase;

    @Value("${app.jwt.cookie-secure:false}")
    boolean cookieSecure;

    @GetMapping("/{provider}/login")
    public ResponseEntity<Void> login(@PathVariable String provider) {
        var start = authUseCase.startLogin(provider);
        ResponseCookie stateCookie = ResponseCookie.from(kr.rojae.waf.social.domain.oauth.OAuthStateService.COOKIE_NAME, start.state())
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(authUseCase.stateTtlSeconds())
                .build();
        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, start.authorizationUri().toString())
                .header(HttpHeaders.SET_COOKIE, stateCookie.toString())
                .build();
    }

    @PostMapping("/{provider}/exchange")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> exchangeCode(
            @PathVariable String provider,
            @RequestBody Map<String, String> requestBody) {

        return ResponseEntity.status(400).body(Map.of(
                "success", false,
                "error", "state_validation_required",
                "redirect_url", authUseCase.safeRedirect(requestBody.get("redirect_uri"))
        ));
    }

    @GetMapping("/{provider}/callback")
    @ResponseBody
    public ResponseEntity<AuthCallbackResponse> callback(@PathVariable String provider,
                                                        @RequestParam String code,
                                                        @RequestParam String state,
                                                        @CookieValue(name = kr.rojae.waf.social.domain.oauth.OAuthStateService.COOKIE_NAME, required = false) String stateCookie,
                                                        @RequestParam(required = false) String redirect_uri) {
        ResponseCookie clearState = ResponseCookie.from(kr.rojae.waf.social.domain.oauth.OAuthStateService.COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        if (!authUseCase.consumeState(state, stateCookie)) {
            return ResponseEntity.status(400)
                    .header(HttpHeaders.SET_COOKIE, clearState.toString())
                    .body(AuthCallbackResponse.error(authUseCase.safeRedirect(redirect_uri)));
        }
        var response = authUseCase.handleCallback(provider, code, redirect_uri);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearState.toString())
                .body(response);
    }
}
