package com.interpark_clone.domain.member.dto;

import org.springframework.http.ResponseCookie;

public record LogoutDto(
        ResponseCookie accessTokenCookie,
        ResponseCookie refreshTokenCookie
) {
}
