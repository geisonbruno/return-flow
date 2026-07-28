package com.returnflow.tenant;

import com.returnflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TenantFilterIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void requestIsResolvedToTheDefaultTenant() throws Exception {
		mockMvc.perform(get("/test-fixture/tenant/current-slug"))
				.andExpect(status().isOk())
				.andExpect(content().string("warehouse"));

		assertThat(TenantContext.get()).isNull();
	}

	@Test
	void contextIsClearedEvenWhenTheRequestFails() throws Exception {
		mockMvc.perform(get("/test-fixture/tenant/boom"))
				.andExpect(status().isInternalServerError());

		assertThat(TenantContext.get()).isNull();
	}
}
