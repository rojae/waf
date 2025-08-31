package kr.rojae.waf.social.web;

import kr.rojae.waf.social.application.SessionUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/session")
public class SessionController {

    private final SessionUseCase sessionUseCase;

    @GetMapping("/is-alive")
    public ResponseEntity<?> isAlive(
            @CookieValue(name = "${app.jwt.cookie-name:ACCESS_TOKEN}", required = false) String jwt) {
        var r = sessionUseCase.me(jwt);
        return ResponseEntity.status(r.status()).body(r.body());
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(
            @CookieValue(name = "${app.jwt.cookie-name:ACCESS_TOKEN}", required = false) String jwt) {
        var r = sessionUseCase.me(jwt);
        return ResponseEntity.status(r.status()).body(r.body());
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(name = "${app.jwt.cookie-name:ACCESS_TOKEN}", required = false) String jwt) {
        var r = sessionUseCase.logout(jwt);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, r.deleteCookie().toString())
                .build();
    }
}