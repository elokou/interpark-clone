package com.interpark_clone.global.jwt;

import com.interpark_clone.global.config.SecurityConfig;
import com.interpark_clone.global.exception.JwtAuthenticationException;
import com.interpark_clone.global.util.CookieUtil;
import com.interpark_clone.global.security.CustomAuthenticationEntryPoint;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.util.AntPathMatcher;

import java.io.IOException;
import java.util.Arrays;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    private final CookieUtil cookieUtil;
    private final JwtTokenProvider jwtTokenProvider;
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        try{
            String accessToken = cookieUtil.getCookieValue(request, "accessToken");

            if (accessToken != null) {
                jwtTokenProvider.validateToken(accessToken);
                Authentication authentication = jwtTokenProvider.getAuthentication(accessToken);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
            filterChain.doFilter(request, response);

        } catch (JwtAuthenticationException e) {
            // 토큰 관련 예외 처리
            SecurityContextHolder.clearContext();
            // JWT 에러의 경우 곧바로 에러 응답 반환
            authenticationEntryPoint.commence(request, response, e);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        boolean result = Arrays.stream(SecurityConfig.PERMIT_ALL_PATHS)
                .anyMatch(pattern -> PATH_MATCHER.match(pattern, path));
        return result;
    }
}
