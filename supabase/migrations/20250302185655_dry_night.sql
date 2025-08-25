-- Add transaction_id column to payments table if it doesn't exist
DO $$ 
BEGIN
  -- Add transaction_id column to payments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'payments' AND column_name = 'transaction_id') THEN
    ALTER TABLE payments ADD COLUMN transaction_id TEXT;
  END IF;
END $$;

-- Create index for transaction_id
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- Update RLS policies to include the new column
DROP POLICY IF EXISTS "Vendors can read own payments" ON payments;
CREATE POLICY "Vendors can read own payments" ON payments
  FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );