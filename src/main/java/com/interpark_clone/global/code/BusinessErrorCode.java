package com.interpark_clone.global.code;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum BusinessErrorCode implements Code{

    // 멤버 관련 에러
    MEMBER_NOT_FOUND(404, "존재하지 않는 회원입니다."),
    MEMBER_ALREADY_EXISTS(409, "이미 가입된 회원입니다."),
    LOGIN_FAILED(401, "이메일 혹은 비밀번호가 올바르지 않습니다.");

    private final int statusCode;
    private final String message;

}
