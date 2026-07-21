package com.interpark_clone.domain.member.repository;

import com.interpark_clone.domain.member.entity.Member;
import com.interpark_clone.domain.member.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    boolean existsByEmailAndProvider(String email, Provider provider);
    Optional<Member> findByEmailAndProvider(String email, Provider provider);
}
