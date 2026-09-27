-- Run this once if you already created the `orders` table before the payment feature was added.
-- Safe to skip on a fresh database created from 00_schema.sql (it already includes these columns).
USE cloudmart;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'COD',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
