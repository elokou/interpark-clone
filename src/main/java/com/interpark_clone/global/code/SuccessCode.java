package com.interpark_clone.global.code;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum SuccessCode implements Code {

    HEALTH_CHECK_SUCCESS(200, "헬스 체크 성공"),
    GET_SUCCESS(200, "조회 성공"),
    INSERT_SUCCESS(201, "삽입 성공"),
    UPDATE_SUCCESS(200, "업데이트 성공"),
    DELETE_SUCCESS(200, "삭제 성공"),
    LOGIN_SUCCESS(200, "로그인 성공");

    private final int statusCode;
    private final String message;

}
