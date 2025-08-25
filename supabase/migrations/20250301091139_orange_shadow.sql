/*
  # Fix Tender-Profile Relationship

  1. Changes
    - Add a foreign key relationship between tenders.created_by and profiles.id
    - Update the query in TenderDetails.jsx to properly fetch tender data without relying on the relationship
*/

-- Add explicit foreign key relationship between tenders.created_by and profiles.id
ALTER TABLE tenders 
  DROP CONSTRAINT IF EXISTS tenders_created_by_fkey,
  ADD CONSTRAINT tenders_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id);

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_tenders_created_by_profiles ON tenders(created_by);