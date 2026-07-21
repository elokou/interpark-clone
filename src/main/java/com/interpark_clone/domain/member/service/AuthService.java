package com.interpark_clone.domain.member.service;

import com.interpark_clone.domain.member.dto.AuthDto;
import com.interpark_clone.domain.member.dto.LoginRequest;
import com.interpark_clone.domain.member.dto.LogoutDto;
import com.interpark_clone.domain.member.dto.SignupRequest;
import com.interpark_clone.domain.member.dto.AuthResponse;
import com.interpark_clone.domain.member.entity.Member;
import com.interpark_clone.domain.member.entity.Provider;
import com.interpark_clone.domain.member.entity.Role;
import com.interpark_clone.domain.member.repository.MemberRepository;
import com.interpark_clone.global.code.BusinessErrorCode;
import com.interpark_clone.global.code.GeneralErrorCode;
import com.interpark_clone.global.exception.BusinessException;
import com.interpark_clone.global.exception.GeneralException;
import com.interpark_clone.global.exception.JwtAuthenticationException;
import com.interpark_clone.global.util.CookieUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final MemberRepository memberRepository;
    private final TokenService tokenService;
    private final CookieUtil cookieUtil;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthDto signup(SignupRequest request) {

        // 이메일 중복 체크
        if (memberRepository.existsByEmailAndProvider(request.email(), Provider.LOCAL)) {
            throw new BusinessException(BusinessErrorCode.MEMBER_ALREADY_EXISTS);
        }

        // 멤버 생성
        Member member = Member.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .provider(Provider.LOCAL)
                .build();

        memberRepository.save(member);

        // 토큰 발급 및 쿠키 생성
        AuthDto response = processLogin(member.getMemberKey(), member.getRole());
        return response;
    }

    @Transactional(readOnly = true)
    public AuthDto localLogin(LoginRequest request) {

        // member 조회
        Member member = memberRepository.findByEmailAndProvider(request.email(), Provider.LOCAL)
                .orElseThrow(() -> new BusinessException(BusinessErrorCode.LOGIN_FAILED));

        // 비밀 번호 검증
        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new BusinessException(BusinessErrorCode.LOGIN_FAILED);
        }

        // 토큰 발급 및 쿠키 생성
        AuthDto response = processLogin(member.getMemberKey(), member.getRole());
        return response;
    }

    public AuthDto reissue(String refreshToken) {

        // refresh token 유효성 검증
        if (refreshToken == null) {
            throw new GeneralException(GeneralErrorCode.TOKEN_EMPTY);
        }
        tokenService.validateRefreshToken(refreshToken);

        // 저장된 refresh token과 일치 여부 검증
        String memberKey = tokenService.getMemberKey(refreshToken);
        Role role = tokenService.getRole(refreshToken);
        tokenService.validateStoredRefreshToken(memberKey, refreshToken);

        // 새 토큰 발급 및 쿠키 생성
        AuthDto response = processLogin(memberKey, role);
        return response;
    }

    public LogoutDto logout(String refreshToken) {
        if (refreshToken != null) {
            try {
                tokenService.validateRefreshToken(refreshToken);
                String memberKey = tokenService.getMemberKey(refreshToken);
                tokenService.deleteRefreshToken(memberKey);
            } catch (JwtAuthenticationException ignored) {
                // 유효하지 않은 토큰이어도 클라이언트 쿠키는 만료시킴
            }
        }

        return new LogoutDto(
                cookieUtil.deleteCookie("accessToken"),
                cookieUtil.deleteCookie("refreshToken")
        );
    }

    private AuthDto processLogin(String memberKey, Role role){

        // 토큰 발급
        String accessToken = tokenService.generateAccessToken(memberKey, role);
        String refreshToken = tokenService.generateRefreshToken(memberKey, role);
        tokenService.saveRefreshToken(memberKey, refreshToken);

        // 쿠키 생성
        ResponseCookie accessTokenCookie = cookieUtil.createCookie(
                "accessToken",
                accessToken,
                tokenService.getAccessTokenExpiration()
        );

        ResponseCookie refreshTokenCookie = cookieUtil.createCookie(
                "refreshToken",
                refreshToken,
                tokenService.getRefreshTokenExpiration()
        );

        AuthResponse response = new AuthResponse(memberKey);
        return new AuthDto(response, accessTokenCookie, refreshTokenCookie);
    }
}
