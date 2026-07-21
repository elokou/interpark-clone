package com.interpark_clone.global.security;

import com.interpark_clone.global.code.GeneralErrorCode;
import com.interpark_clone.global.exception.JwtAuthenticationException;
import com.interpark_clone.global.response.Response;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws IOException {

        GeneralErrorCode errorCode = GeneralErrorCode.UNAUTHORIZED;

        if (authException instanceof JwtAuthenticationException jwtException) {
            errorCode = jwtException.getErrorCode();
        }

        log.warn("[Security] 인증 실패 - uri={}, errorCode={}, message={}",
                request.getRequestURI(),
                errorCode.name(),
                authException.getMessage()
        );

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), Response.fail(errorCode));
    }
}
