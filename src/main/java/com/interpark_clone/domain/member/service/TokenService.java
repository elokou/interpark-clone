package com.interpark_clone.domain.member.service;

import com.interpark_clone.domain.member.entity.Role;
import com.interpark_clone.global.code.GeneralErrorCode;
import com.interpark_clone.global.exception.GeneralException;
import com.interpark_clone.global.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class TokenService {

    private static final String REFRESH_TOKEN_KEY_PREFIX = "refreshToken:";

    private final JwtTokenProvider jwtTokenProvider;
    private final RedissonClient redissonClient;

    public void saveRefreshToken(String memberKey, String refreshToken) {

        long expirationMillis = getRefreshTokenExpiration();

        redissonClient.<String>getBucket(REFRESH_TOKEN_KEY_PREFIX + memberKey)
                .set(refreshToken, Duration.ofMillis(expirationMillis));
    }

    public String getRefreshToken(String memberKey) {
        return redissonClient.<String>getBucket(REFRESH_TOKEN_KEY_PREFIX + memberKey).get();
    }

    public void validateRefreshToken(String refreshToken) {
        jwtTokenProvider.validateToken(refreshToken);
    }

    public void validateStoredRefreshToken(String memberKey, String refreshToken) {

        // 기존 refresh token 검증
        String storedRefreshToken = getRefreshToken(memberKey);

        if (storedRefreshToken == null || !storedRefreshToken.equals(refreshToken)) {
            throw new GeneralException(GeneralErrorCode.TOKEN_INVALID);
        }
    }

    public void deleteRefreshToken(String memberKey) {
        redissonClient.getBucket(REFRESH_TOKEN_KEY_PREFIX + memberKey).delete();
    }

    public String getMemberKey(String token) {
        return jwtTokenProvider.getMemberKey(token);
    }

    public Role getRole(String token) {
        return jwtTokenProvider.getRole(token);
    }

    public String generateAccessToken(String memberKey, Role role) {
        return jwtTokenProvider.generateAccessToken(memberKey, role);
    }

    public String generateRefreshToken(String memberKey, Role role) {
        return jwtTokenProvider.generateRefreshToken(memberKey, role);
    }

    public long getAccessTokenExpiration() {
        return jwtTokenProvider.getAccessTokenExpiration();
    }

    public long getRefreshTokenExpiration() {
        return jwtTokenProvider.getRefreshTokenExpiration();
    }
}
