package kr.rojae.waf.social.domain.oauth;

import kr.rojae.waf.common.enums.SocialType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class SocialServiceFactory {
    private final Map<SocialType, SocialOAuthService> delegates;

    public SocialServiceFactory(List<SocialOAuthService> list) {
        EnumMap<SocialType, SocialOAuthService> map = new EnumMap<>(SocialType.class);
        for (SocialOAuthService svc : list) {
            map.put(svc.supports(), svc);
        }
        this.delegates = map;
    }

    public SocialOAuthService get(SocialType type) {
        var svc = delegates.get(type);
        if (svc == null) throw new IllegalArgumentException("Unsupported social type: " + type);
        return svc;
    }
}
