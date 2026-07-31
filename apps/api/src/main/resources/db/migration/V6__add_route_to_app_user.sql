ALTER TABLE app_user
    ADD COLUMN route_id UUID,
    ADD CONSTRAINT fk_app_user_route FOREIGN KEY (route_id) REFERENCES route (id);

CREATE INDEX idx_app_user_route_id ON app_user (route_id);
