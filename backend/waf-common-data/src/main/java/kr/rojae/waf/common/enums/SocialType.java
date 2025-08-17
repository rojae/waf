package kr.rojae.waf.common.enums;

import kr.rojae.waf.common.enums.converter.AbstractStringCodeEnumConverter;
import lombok.Getter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

import java.util.Arrays;

@Getter
@ToString
@Slf4j
public enum SocialType implements BaseCodeEnum<String> {
    GOOGLE("GOOGLE", "구글 로그인");

    private final String code;
    private final String desc;

    SocialType(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static SocialType ofCode(String code) {
        return Arrays.stream(SocialType.values())
                .filter(e -> e.getCode().equalsIgnoreCase(code))
                .findAny()
                .orElseThrow(() -> new UnsupportedOperationException("unsupported socialType: " + code));
    }

    /**
     * For Persist JPA converter
     */
    //@Converter(autoApply = false)
    public static class CodeConverter extends AbstractStringCodeEnumConverter<SocialType> {
        public CodeConverter() {
            super(SocialType.class);
        }
    }
}
