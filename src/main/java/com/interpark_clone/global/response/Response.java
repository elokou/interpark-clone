package com.interpark_clone.global.response;


import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.interpark_clone.global.code.Code;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({"statusCode", "isSuccess", "message", "pageInfo", "payload"})
public class Response<T> {

    private int statusCode;

    @Getter(AccessLevel.NONE)
    private boolean isSuccess;

    @JsonProperty("isSuccess")
    public boolean isSuccess() {
        return isSuccess;
    }

    private String message;

    private PageInfo pageInfo;

    private T payload;

    public static <T> Response<T> success(Code code) {
        return Response.<T>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(true)
                .message(code.getMessage())
                .build();
    }

    public static <T> Response<T> success(Code code, T payload) {
        return Response.<T>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(true)
                .message(code.getMessage())
                .payload(payload)
                .build();
    }

    public static <T> Response<T> success(Code code, String message) {
        return Response.<T>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(true)
                .payload(null)
                .message(message)
                .build();
    }

    public static <T> Response<T> success(Code code, T payload, String message) {
        return Response.<T>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(true)
                .message(message)
                .payload(payload)
                .build();
    }

    public static <T> Response<List<T>> success(Code code, Page<T> page, String message) {
        PageInfo pageInfo = new PageInfo(
                page.getNumber(),
                page.getSize(),
                page.hasNext(),
                page.getTotalElements(),
                page.getTotalPages()
        );

        return Response.<List<T>>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(true)
                .message(message)
                .pageInfo(pageInfo)
                .payload(page.getContent())
                .build();
    }

    public static <T> Response<T> fail(Code code) {
        return Response.<T>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(false)
                .message(code.getMessage())
                .build();
    }

    public static <T> Response<T> fail(Code code, String message) {
        return Response.<T>builder()
                .statusCode(code.getStatusCode())
                .isSuccess(false)
                .message(message)
                .build();
    }
}
