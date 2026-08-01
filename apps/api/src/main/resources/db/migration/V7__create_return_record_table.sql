CREATE SEQUENCE return_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE return_record (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    return_number VARCHAR(32) NOT NULL,
    driver_id UUID NOT NULL,
    route_id UUID NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    reason VARCHAR(30) NOT NULL,
    observation VARCHAR(2000) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_return_record_tenant FOREIGN KEY (tenant_id) REFERENCES tenant (id),
    CONSTRAINT fk_return_record_driver FOREIGN KEY (driver_id) REFERENCES app_user (id),
    CONSTRAINT fk_return_record_route FOREIGN KEY (route_id) REFERENCES route (id),
    CONSTRAINT uk_return_record_return_number UNIQUE (return_number)
);

CREATE INDEX idx_return_record_tenant_id ON return_record (tenant_id);
CREATE INDEX idx_return_record_driver_id ON return_record (driver_id);
CREATE INDEX idx_return_record_route_id ON return_record (route_id);
CREATE INDEX idx_return_record_status ON return_record (status);
CREATE INDEX idx_return_record_created_at ON return_record (created_at);
