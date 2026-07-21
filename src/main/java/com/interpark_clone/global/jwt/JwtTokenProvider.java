package com.interpark_clone.global.jwt;

import com.interpark_clone.domain.member.entity.Role;
import com.interpark_clone.global.code.GeneralErrorCode;
import com.interpark_clone.global.exception.JwtAuthenticationException;
import com.interpark_clone.global.security.CustomUserDetails;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret-key}")
    private String secretKeyValue;

    @Value("${jwt.access-token-expiration}")
    private Long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private Long refreshTokenExpiration;

    private SecretKey secretKey;

    @PostConstruct
    void init() {
        this.secretKey = Keys.hmacShaKeyFor(
                secretKeyValue.getBytes(StandardCharsets.UTF_8)
        );
    }

    public String generateAccessToken(String memberKey, Role role) {
        return generateToken(memberKey, role, accessTokenExpiration);
    }

    public String generateRefreshToken(String memberKey, Role role) {
        return generateToken(memberKey, role, refreshTokenExpiration);
    }

    private String generateToken(String memberKey, Role role, long expirationMillis) {

        Instant now = Instant.now();
        Instant expiration = now.plusMillis(expirationMillis);

        return Jwts.builder()
                .subject(memberKey)
                .claim("role", role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey)
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public void validateToken(String token) {
        try {
            parseClaims(token);
        } catch (ExpiredJwtException e) {
            log.warn("[JWT] 토큰이 만료되었습니다. message={}", e.getMessage());
            throw new JwtAuthenticationException(GeneralErrorCode.TOKEN_EXPIRED);
        } catch (MalformedJwtException e) {
            log.warn("[JWT] 토큰 형식이 올바르지 않습니다. message={}", e.getMessage());
            throw new JwtAuthenticationException(GeneralErrorCode.TOKEN_INVALID);
        } catch (UnsupportedJwtException e) {
            log.warn("[JWT] 지원하지 않는 토큰입니다. message={}", e.getMessage());
            throw new JwtAuthenticationException(GeneralErrorCode.TOKEN_INVALID);
        } catch (SecurityException e) {
            log.warn("[JWT] 토큰 서명이 올바르지 않습니다. message={}", e.getMessage());
            throw new JwtAuthenticationException(GeneralErrorCode.TOKEN_INVALID);
        } catch (IllegalArgumentException e) {
            log.warn("[JWT] 토큰이 비어있거나 올바르지 않습니다. message={}", e.getMessage());
            throw new JwtAuthenticationException(GeneralErrorCode.TOKEN_EMPTY);
        }
    }

    public String getMemberKey(String token) {
        return parseClaims(token).getSubject();
    }

    public Role getRole(String token) {
        String role = parseClaims(token).get("role", String.class);
        return Role.valueOf(role);
    }

    public long getAccessTokenExpiration() {
        return accessTokenExpiration;
    }

    public long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }

    public Authentication getAuthentication(String token) {

        Claims claims = parseClaims(token);
        String memberKey = claims.getSubject();
        Role role = Role.valueOf(claims.get("role", String.class));

        CustomUserDetails userDetails = CustomUserDetails.builder()
                .memberKey(memberKey)
                .role(role)
                .build();

        return new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                userDetails.getAuthorities()
        );
    }
}
