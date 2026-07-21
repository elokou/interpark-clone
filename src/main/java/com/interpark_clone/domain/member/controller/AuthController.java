package com.interpark_clone.domain.member.controller;

import com.interpark_clone.domain.member.dto.AuthDto;
import com.interpark_clone.domain.member.dto.LoginRequest;
import com.interpark_clone.domain.member.dto.LogoutDto;
import com.interpark_clone.domain.member.dto.SignupRequest;
import com.interpark_clone.domain.member.dto.AuthResponse;
import com.interpark_clone.domain.member.service.AuthService;
import com.interpark_clone.global.code.SuccessCode;
import com.interpark_clone.global.response.Response;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth", description = "인증/인가 API")
@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "로그인", description = "이메일/비밀번호로 로그인하고 accessToken/refreshToken 쿠키를 발급합니다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "로그인 성공"),
            @ApiResponse(responseCode = "401", description = "이메일 또는 비밀번호 불일치")
    })
    @PostMapping("/auth/login")
    public ResponseEntity<Response<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthDto loginResponse = authService.localLogin(request);
        Response<AuthResponse> response = Response.success(
                SuccessCode.LOGIN_SUCCESS,
                loginResponse.authResponse(),
                "로그인 API"
        );
        return ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.SET_COOKIE, loginResponse.accessTokenCookie().toString())
                .header(HttpHeaders.SET_COOKIE, loginResponse.refreshTokenCookie().toString())
                .body(response);
    }

    @Operation(summary = "회원가입", description = "이메일/비밀번호로 회원가입하고 accessToken/refreshToken 쿠키를 발급합니다.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "회원가입 성공"),
            @ApiResponse(responseCode = "409", description = "이미 가입된 이메일")
    })
    @PostMapping("/auth/signup")
    public ResponseEntity<Response<AuthResponse>> signup(@Valid @RequestBody SignupRequest request) {
        AuthDto signupResponse  = authService.signup(request);
        Response<AuthResponse> response = Response.success(
                SuccessCode.INSERT_SUCCESS,
                signupResponse.authResponse(),
                "회원 가입 API"
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, signupResponse.accessTokenCookie().toString())
                .header(HttpHeaders.SET_COOKIE, signupResponse.refreshTokenCookie().toString())
                .body(response);
    }

    @Operation(summary = "토큰 재발급", description = "refreshToken 쿠키를 검증해 accessToken/refreshToken을 재발급합니다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "재발급 성공"),
            @ApiResponse(responseCode = "401", description = "refreshToken이 없거나 유효하지 않음")
    })
    @PostMapping("/auth/reissue")
    public ResponseEntity<Response<AuthResponse>> reissue(
            @Parameter(hidden = true)
            @CookieValue(value = "refreshToken", required = false) String refreshToken
    ) {
        AuthDto reissueResponse = authService.reissue(refreshToken);
        Response<AuthResponse> response = Response.success(
                SuccessCode.LOGIN_SUCCESS,
                reissueResponse.authResponse(),
                "토큰 재발급 API"
        );
        return ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.SET_COOKIE, reissueResponse.accessTokenCookie().toString())
                .header(HttpHeaders.SET_COOKIE, reissueResponse.refreshTokenCookie().toString())
                .body(response);
    }

    @Operation(summary = "로그아웃", description = "저장된 refreshToken을 삭제하고 accessToken/refreshToken 쿠키를 만료시킵니다.")
    @ApiResponse(responseCode = "200", description = "로그아웃 성공")
    @PostMapping("/auth/logout")
    public ResponseEntity<Response<Void>> logout(
            @Parameter(hidden = true)
            @CookieValue(value = "refreshToken", required = false) String refreshToken
    ) {
        LogoutDto logoutResponse = authService.logout(refreshToken);
        Response<Void> response = Response.success(
                SuccessCode.DELETE_SUCCESS,
                "로그아웃 API"
        );
        return ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.SET_COOKIE, logoutResponse.accessTokenCookie().toString())
                .header(HttpHeaders.SET_COOKIE, logoutResponse.refreshTokenCookie().toString())
                .body(response);
    }
}
