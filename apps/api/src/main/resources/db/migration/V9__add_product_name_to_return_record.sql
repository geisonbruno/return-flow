ALTER TABLE return_record
    ADD COLUMN product_name VARCHAR(200) NOT NULL DEFAULT 'Unknown product';

ALTER TABLE return_record
    ALTER COLUMN product_name DROP DEFAULT;
