/*
  # Update Bid Status Display

  1. New Function
    - Create a function to determine if a bid is awarded based on the tender's awarded_bid_id
  
  2. Security
    - Function is marked as SECURITY DEFINER to ensure it runs with appropriate permissions
*/

-- Function to check if a bid is awarded
CREATE OR REPLACE FUNCTION is_bid_awarded(bid_id UUID, tender_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  awarded_id UUID;
BEGIN
  -- Get the awarded bid ID from the tender
  SELECT awarded_bid_id INTO awarded_id
  FROM tenders
  WHERE id = tender_id;
  
  -- Return true if this bid is the awarded bid
  RETURN bid_id = awarded_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for better performance when checking awarded bids
CREATE INDEX IF NOT EXISTS idx_tenders_awarded_bid_id_lookup ON tenders(id, awarded_bid_id);