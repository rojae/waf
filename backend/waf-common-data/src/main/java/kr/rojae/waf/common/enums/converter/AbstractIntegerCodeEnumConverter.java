package kr.rojae.waf.common.enums.converter;

import kr.rojae.waf.common.enums.BaseCodeEnum;

public abstract class AbstractIntegerCodeEnumConverter<E extends Enum<E> & BaseCodeEnum<Integer>> extends AbstractCodeEnumConverter<E, Integer> {
    protected AbstractIntegerCodeEnumConverter(Class<E> enumClass) {
        super(enumClass);
    }
}
