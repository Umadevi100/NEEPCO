/*
  # Add awarded_bid_id to tenders table

  1. New Fields
    - Add `awarded_bid_id` to tenders table to track which bid was accepted
  
  2. Changes
    - Update tenders table to include reference to the accepted bid
*/

-- Add awarded_bid_id to tenders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tenders' AND column_name = 'awarded_bid_id') THEN
    ALTER TABLE tenders ADD COLUMN awarded_bid_id UUID REFERENCES bids(id);
  END IF;
END $$;

-- Create index for awarded_bid_id
CREATE INDEX IF NOT EXISTS idx_tenders_awarded_bid_id ON tenders(awarded_bid_id);