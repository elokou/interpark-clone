package com.interpark_clone.global.code;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum GeneralErrorCode implements Code {

    // 공통 에러
    BAD_REQUEST(400, "잘못된 요청입니다."),
    UNAUTHORIZED(401, "인증이 필요합니다."),
    FORBIDDEN(403, "접근 권한이 없습니다."),
    NOT_FOUND(404, "리소스를 찾을 수 없습니다."),
    METHOD_NOT_ALLOWED(405, "지원하지 않는 HTTP 메서드입니다."),
    CONFLICT(409, "이미 존재하거나 현재 상태와 충돌하는 리소스입니다."),
    UNSUPPORTED_MEDIA_TYPE(415, "지원하지 않는 미디어 타입입니다."),
    TOO_MANY_REQUESTS(429, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."),
    INTERNAL_SERVER_ERROR(500, "서버 에러, 관리자에게 문의 바랍니다."),
    SERVICE_UNAVAILABLE(503, "서비스를 일시적으로 사용할 수 없습니다."),

    // 입력값 검증
    VALIDATION_ERROR(400, "입력값이 올바르지 않습니다."),
    INVALID_REQUEST_PARAMETER(400, "잘못된 요청 파라미터입니다."),
    MISSING_REQUEST_PARAMETER(400, "필수 요청 파라미터가 누락되었습니다."),
    INVALID_REQUEST_BODY(400, "요청 본문이 올바르지 않습니다."),
    TYPE_MISMATCH(400, "요청 값의 타입이 올바르지 않습니다."),
    UNSUPPORTED_OPERATION(400, "지원하지 않는 요청입니다."),

    // 인증/인가
    TOKEN_EXPIRED(401, "토큰이 만료되었습니다."),
    TOKEN_INVALID(401, "유효하지 않은 토큰입니다."),
    TOKEN_EMPTY(401, "토큰이 비어 있습니다.");

    private final int statusCode;
    private final String message;

}
