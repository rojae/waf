package kr.rojae.waf.common.enums.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import kr.rojae.waf.common.enums.BaseCodeEnum;

import java.util.Arrays;

@Converter(autoApply = false)
public abstract class AbstractCodeEnumConverter<E extends Enum<E> & BaseCodeEnum<T>, T> implements AttributeConverter<E, T> {

    private final Class<E> enumClass;

    protected AbstractCodeEnumConverter(Class<E> enumClass) {
        this.enumClass = enumClass;
    }

    @Override
    public T convertToDatabaseColumn(E attribute) {
        return (attribute == null) ? null : attribute.getCode();
    }

    @Override
    public E convertToEntityAttribute(T dbData) {
        if (dbData == null) return null;

        return Arrays.stream(enumClass.getEnumConstants())
                .filter(e -> dbData.equals(e.getCode()))
                .findFirst()
                .orElseGet(() -> {
                    try {
                        return Enum.valueOf(enumClass, "UNKNOWN");
                    } catch (Exception ex) {
                        throw new IllegalArgumentException("Unknown code: " + dbData + " for " + enumClass.getSimpleName());
                    }
                });
    }
}
