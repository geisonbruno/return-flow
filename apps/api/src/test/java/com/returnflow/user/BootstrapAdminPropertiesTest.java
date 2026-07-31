package com.returnflow.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BootstrapAdminPropertiesTest {

	@Test
	void allBlankIsDisabled() {
		var properties = new BootstrapAdminProperties(null, null, null);

		assertThat(properties.resolveIfEnabled()).isEmpty();
	}

	@Test
	void allPresentIsEnabled() {
		var properties = new BootstrapAdminProperties("admin@warehouse.example", "s3cret!", "Warehouse Admin");

		assertThat(properties.resolveIfEnabled()).contains(properties);
	}

	@Test
	void onlyEmailProvidedFailsFast() {
		var properties = new BootstrapAdminProperties("admin@warehouse.example", "", "");

		assertThatThrownBy(properties::resolveIfEnabled).isInstanceOf(IllegalStateException.class);
	}

	@Test
	void onlyPasswordAndNameProvidedFailsFast() {
		var properties = new BootstrapAdminProperties("", "s3cret!", "Warehouse Admin");

		assertThatThrownBy(properties::resolveIfEnabled).isInstanceOf(IllegalStateException.class);
	}
}
