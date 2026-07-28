package com.returnflow.tenant;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class TenantFilterConfig {

	@Bean
	FilterRegistrationBean<TenantFilter> tenantFilterRegistration(TenantResolver tenantResolver) {
		FilterRegistrationBean<TenantFilter> registration = new FilterRegistrationBean<>(new TenantFilter(tenantResolver));
		registration.addUrlPatterns("/*");
		return registration;
	}
}
