package com.interpark_clone.domain.health;

import com.interpark_clone.global.code.SuccessCode;
import com.interpark_clone.global.response.Response;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Health", description = "헬스체크 API")
@RestController
public class HealthController {

    @Operation(summary = "헬스체크", description = "서버 정상 동작 여부를 확인합니다.")
    @GetMapping("/health")
    public ResponseEntity<Response<Void>> health() {
        Response response = Response.success(
                SuccessCode.HEALTH_CHECK_SUCCESS,
                "헬스체크 API"
        );
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
