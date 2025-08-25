/*
  # Fix vendor bids permissions

  1. Changes
    - Update RLS policy for bids to allow vendors to view their own bids
    - Add index for bids vendor_id and tender_id for better performance
*/

-- Update the policy for vendors to read their own bids
DROP POLICY IF EXISTS "Vendors can read own bids" ON bids;
CREATE POLICY "Vendors can read own bids" ON bids
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = bids.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

-- Create a composite index for better performance
CREATE INDEX IF NOT EXISTS idx_bids_vendor_tender ON bids(vendor_id, tender_id);