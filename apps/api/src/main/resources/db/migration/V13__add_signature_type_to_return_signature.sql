-- Phase 7A reuses return_signature for the warehouse signature too (root
-- CLAUDE.md §13.1), distinguished by signature_type. Every existing row
-- predates this column and can only ever have been a customer signature, so
-- backfilling to 'CUSTOMER' is unambiguous and safe regardless of whether
-- return_signature already has rows.
ALTER TABLE return_signature ADD COLUMN signature_type VARCHAR(20);
UPDATE return_signature SET signature_type = 'CUSTOMER';
ALTER TABLE return_signature ALTER COLUMN signature_type SET NOT NULL;

ALTER TABLE return_signature DROP CONSTRAINT uk_return_signature_return_record;
ALTER TABLE return_signature ADD CONSTRAINT uk_return_signature_return_record_type UNIQUE (return_record_id, signature_type);
