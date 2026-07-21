package com.interpark_clone.domain.member.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record AuthResponse(
        @Schema(description = "회원 고유 키 (UUID)", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
        String memberKey
) {
}
