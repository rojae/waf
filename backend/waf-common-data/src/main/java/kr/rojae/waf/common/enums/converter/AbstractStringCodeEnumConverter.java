package kr.rojae.waf.common.enums.converter;

import kr.rojae.waf.common.enums.BaseCodeEnum;

public abstract class AbstractStringCodeEnumConverter<E extends Enum<E> & BaseCodeEnum<String>> extends AbstractCodeEnumConverter<E, String> {
    protected AbstractStringCodeEnumConverter(Class<E> enumClass) {
        super(enumClass);
    }
}