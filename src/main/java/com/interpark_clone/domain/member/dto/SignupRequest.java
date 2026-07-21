package com.interpark_clone.domain.member.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SignupRequest(
        @Schema(description = "이메일", example = "user@example.com")
        @NotBlank(message = "이메일은 필수 입력 값입니다.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        String email,
        @Schema(description = "비밀번호", example = "password1234!")
        @NotBlank(message = "비밀번호는 필수 입력 값입니다.")
        String password
) {
}
