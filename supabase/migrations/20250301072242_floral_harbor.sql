/*
  # Remove technical_evaluation_criteria from tenders table

  1. Changes
    - Drop the technical_evaluation_criteria column from tenders table
    - Update existing queries to handle the absence of this column
*/

-- Remove technical_evaluation_criteria column from tenders table
ALTER TABLE tenders DROP COLUMN IF EXISTS technical_evaluation_criteria;

-- Create a function to handle tender details without technical_evaluation_criteria
CREATE OR REPLACE FUNCTION get_tender_details(tender_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  estimated_value NUMERIC,
  submission_deadline TIMESTAMPTZ,
  status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category TEXT,
  is_reserved_for_mse BOOLEAN,
  documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.estimated_value,
    t.submission_deadline,
    t.status,
    t.created_by,
    t.created_at,
    t.updated_at,
    t.category,
    t.is_reserved_for_mse,
    t.documents
  FROM tenders t
  WHERE t.id = tender_id;
END;
$$ LANGUAGE plpgsql;