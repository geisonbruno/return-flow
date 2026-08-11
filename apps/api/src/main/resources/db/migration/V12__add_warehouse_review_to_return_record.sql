-- Phase 7A: the warehouse-review lifecycle fields the domain didn't need
-- until now — review ownership, warehouse decisions, close, and
-- cancellation. `version` starts every existing row (and every future one)
-- at 0, a permanently valid value, so unlike V8/V9's product/quantity
-- backfills this default is not a temporary placeholder and is not dropped.
ALTER TABLE return_record ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE return_record ADD COLUMN review_started_by UUID;
ALTER TABLE return_record ADD COLUMN review_started_at TIMESTAMP;

ALTER TABLE return_record ADD COLUMN sellable BOOLEAN;
ALTER TABLE return_record ADD COLUMN credit_customer BOOLEAN;
ALTER TABLE return_record ADD COLUMN charge_customer BOOLEAN;
ALTER TABLE return_record ADD COLUMN charge_driver BOOLEAN;
ALTER TABLE return_record ADD COLUMN warehouse_observation VARCHAR(2000);

ALTER TABLE return_record ADD COLUMN closed_by UUID;
ALTER TABLE return_record ADD COLUMN closed_at TIMESTAMP;

ALTER TABLE return_record ADD COLUMN cancelled_by UUID;
ALTER TABLE return_record ADD COLUMN cancelled_at TIMESTAMP;
ALTER TABLE return_record ADD COLUMN cancellation_reason VARCHAR(500);

ALTER TABLE return_record ADD CONSTRAINT fk_return_record_review_started_by FOREIGN KEY (review_started_by) REFERENCES app_user (id);
ALTER TABLE return_record ADD CONSTRAINT fk_return_record_closed_by FOREIGN KEY (closed_by) REFERENCES app_user (id);
ALTER TABLE return_record ADD CONSTRAINT fk_return_record_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES app_user (id);

-- "Closed Today" (AdminReturnService) needs to filter by status and range on closed_at together.
CREATE INDEX idx_return_record_closed_at ON return_record (closed_at);
