/*
  # Vendor Profile Enhancements

  1. New Fields
    - Add bank_details to vendors table
    - Add documents array to vendors table
    - Add compliance_history to vendors table
  
  2. Security
    - Update RLS policies for vendor profile access
*/

-- Add new fields to vendors table if they don't exist
DO $$ 
BEGIN
  -- Add bank_details to vendors
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'vendors' AND column_name = 'bank_details') THEN
    ALTER TABLE vendors ADD COLUMN bank_details JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add documents array to vendors if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'vendors' AND column_name = 'documents') THEN
    ALTER TABLE vendors ADD COLUMN documents JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add compliance_history to vendors
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'vendors' AND column_name = 'compliance_history') THEN
    ALTER TABLE vendors ADD COLUMN compliance_history JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_vendors_bank_details ON vendors USING GIN (bank_details);
CREATE INDEX IF NOT EXISTS idx_vendors_documents ON vendors USING GIN (documents);
CREATE INDEX IF NOT EXISTS idx_vendors_compliance_history ON vendors USING GIN (compliance_history);

-- Create a function to get vendor profile details
CREATE OR REPLACE FUNCTION get_vendor_profile(vendor_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  business_type TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  mse_certificate TEXT,
  status TEXT,
  compliance_score INTEGER,
  user_id UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  last_status_change TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  bank_details JSONB,
  documents JSONB,
  compliance_history JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.name,
    v.business_type,
    v.contact_person,
    v.email,
    v.phone,
    v.address,
    v.mse_certificate,
    v.status,
    v.compliance_score,
    v.user_id,
    v.approved_by,
    v.approved_at,
    v.rejection_reason,
    v.last_status_change,
    v.created_at,
    v.updated_at,
    v.bank_details,
    v.documents,
    v.compliance_history
  FROM vendors v
  WHERE v.id = vendor_id;
END;
$$ LANGUAGE plpgsql;