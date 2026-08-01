-- Adds the quantity/unit/other-reason-details fields omitted from V7.
--
-- quantity and unit are added with a temporary DEFAULT so the ALTER TABLE
-- succeeds even if the table already has rows (it does not, as of this
-- migration — Phase 3A shipped no endpoint capable of persisting a real
-- return_record row outside ephemeral Testcontainers test runs — but a
-- migration should not depend on that remaining true forever). The default
-- is dropped immediately afterward so every future insert must supply both
-- values explicitly; the application never relies on it.
ALTER TABLE return_record
    ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN unit VARCHAR(10) NOT NULL DEFAULT 'EA',
    ADD COLUMN other_reason_details VARCHAR(500);

ALTER TABLE return_record
    ALTER COLUMN quantity DROP DEFAULT,
    ALTER COLUMN unit DROP DEFAULT;

ALTER TABLE return_record
    ADD CONSTRAINT chk_return_record_quantity_positive CHECK (quantity > 0),
    ADD CONSTRAINT chk_return_record_unit_valid CHECK (unit IN ('CTN', 'EA'));
