package com.example;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Basic context load test for the Spring Boot application.
 */
@SpringBootTest
class ApplicationTest {

    @Test
    void contextLoads() {
        // If the application context fails to load, this test will fail
        assertNotNull(this);
    }
}
