package com.returnflow.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

	@Bean
	public OpenAPI returnFlowOpenApi(BuildProperties buildProperties) {
		return new OpenAPI().info(new Info()
				.title("ReturnFlow API")
				.description("Backend API for the ReturnFlow product-return workflow.")
				.version(buildProperties.getVersion()));
	}
}
