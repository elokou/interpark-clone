package com.interpark_clone.global.exception;


import com.interpark_clone.global.code.GeneralErrorCode;
import lombok.Getter;
import org.springframework.security.core.AuthenticationException;

@Getter
public class JwtAuthenticationException extends AuthenticationException {

    private final GeneralErrorCode errorCode;

    public JwtAuthenticationException(GeneralErrorCode generalErrorCode) {
        super(generalErrorCode.getMessage());
        this.errorCode = generalErrorCode;
    }
}
