/*
  # Add payment relations to bids and tenders

  1. New Columns
    - Add `related_tender` column to payments table to link payments to tenders
    - Add `related_bid` column to payments table to link payments to bids
  
  2. Indexes
    - Create indexes for the new foreign key columns for better query performance
*/

-- Add related_tender and related_bid columns to payments table if they don't exist
DO $$ 
BEGIN
  -- Add related_tender column to payments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'payments' AND column_name = 'related_tender') THEN
    ALTER TABLE payments ADD COLUMN related_tender UUID REFERENCES tenders(id);
  END IF;

  -- Add related_bid column to payments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'payments' AND column_name = 'related_bid') THEN
    ALTER TABLE payments ADD COLUMN related_bid UUID REFERENCES bids(id);
  END IF;
END $$;

-- Create indexes for the new foreign key columns
CREATE INDEX IF NOT EXISTS idx_payments_related_tender ON payments(related_tender);
CREATE INDEX IF NOT EXISTS idx_payments_related_bid ON payments(related_bid);

-- Update RLS policies to include the new columns
DROP POLICY IF EXISTS "Vendors can read own payments" ON payments;
CREATE POLICY "Vendors can read own payments" ON payments
  FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );