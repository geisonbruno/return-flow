package com.returnflow.common.error;

import com.returnflow.common.error.support.TestFixtureController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises {@link GlobalExceptionHandler} through a minimal, test-only
 * controller (never shipped in main) so the shared ProblemDetail behavior is
 * verified without inventing a business endpoint ahead of its phase.
 *
 * <p>Security auto-configuration is excluded: this slice never loads the
 * real {@code auth.security.SecurityConfig} bean (it isn't a
 * {@code @Controller}/{@code @RestControllerAdvice}, which is all a
 * {@code @WebMvcTest} slice pulls in), so leaving Spring Boot's own default
 * security auto-configuration active would deny-by-default and turn every
 * assertion below into 401 instead of the validation/error behavior this
 * test actually exercises — unrelated to authentication.
 */
@WebMvcTest(controllers = TestFixtureController.class,
		excludeAutoConfiguration = { SecurityAutoConfiguration.class, SecurityFilterAutoConfiguration.class,
				ServletWebSecurityAutoConfiguration.class })
class GlobalExceptionHandlerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void validationFailureReturnsProblemDetailWithFieldErrors() throws Exception {
		mockMvc.perform(post("/test-fixture/validate")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType("application/problem+json"))
				.andExpect(jsonPath("$.title").value("Validation Error"))
				.andExpect(jsonPath("$.errors[0]").value("name: must not be blank"));
	}

	@Test
	void unexpectedExceptionReturnsGenericProblemDetailWithoutLeakingDetails() throws Exception {
		mockMvc.perform(get("/test-fixture/boom"))
				.andExpect(status().isInternalServerError())
				.andExpect(content().contentType("application/problem+json"))
				.andExpect(jsonPath("$.title").value("Internal Server Error"))
				.andExpect(jsonPath("$.detail").value("An unexpected error occurred."));
	}
}
