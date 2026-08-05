CREATE TABLE return_signature (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    return_record_id UUID NOT NULL,
    signer_name VARCHAR(100) NOT NULL,
    storage_key VARCHAR(300) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    size_bytes INTEGER NOT NULL,
    signed_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_return_signature_tenant FOREIGN KEY (tenant_id) REFERENCES tenant (id),
    CONSTRAINT fk_return_signature_return_record FOREIGN KEY (return_record_id) REFERENCES return_record (id),
    CONSTRAINT uk_return_signature_return_record UNIQUE (return_record_id),
    CONSTRAINT uk_return_signature_storage_key UNIQUE (storage_key),
    CONSTRAINT chk_return_signature_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX idx_return_signature_tenant_id ON return_signature (tenant_id);
