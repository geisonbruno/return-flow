CREATE TABLE return_photo (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    return_record_id UUID NOT NULL,
    storage_key VARCHAR(300) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    size_bytes INTEGER NOT NULL,
    photo_position INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_return_photo_tenant FOREIGN KEY (tenant_id) REFERENCES tenant (id),
    CONSTRAINT fk_return_photo_return_record FOREIGN KEY (return_record_id) REFERENCES return_record (id),
    CONSTRAINT uk_return_photo_storage_key UNIQUE (storage_key),
    CONSTRAINT uk_return_photo_return_position UNIQUE (return_record_id, photo_position),
    CONSTRAINT chk_return_photo_position_range CHECK (photo_position BETWEEN 1 AND 5),
    CONSTRAINT chk_return_photo_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX idx_return_photo_tenant_id ON return_photo (tenant_id);
CREATE INDEX idx_return_photo_return_record_id ON return_photo (return_record_id);
