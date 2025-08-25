/*
  # Update tender and bid structure

  1. Changes
     - Add category field to tenders table
     - Add is_reserved_for_mse flag to tenders table
     - Add documents array to tenders table
     - Add technical_evaluation_criteria to tenders table
     - Add notes field to bids table
     - Add documents array to bids table
     - Add technical_score to bids table

  2. Security
     - Maintain existing RLS policies
*/

-- Add new fields to tenders table if they don't exist
DO $$ 
BEGIN
  -- Add category field to tenders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tenders' AND column_name = 'category') THEN
    ALTER TABLE tenders ADD COLUMN category TEXT CHECK (category IN ('goods', 'services', 'works')) DEFAULT 'goods';
  END IF;

  -- Add is_reserved_for_mse flag to tenders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tenders' AND column_name = 'is_reserved_for_mse') THEN
    ALTER TABLE tenders ADD COLUMN is_reserved_for_mse BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add documents array to tenders if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tenders' AND column_name = 'documents') THEN
    ALTER TABLE tenders ADD COLUMN documents JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add technical_evaluation_criteria to tenders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tenders' AND column_name = 'technical_evaluation_criteria') THEN
    ALTER TABLE tenders ADD COLUMN technical_evaluation_criteria JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add notes field to bids if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'bids' AND column_name = 'notes') THEN
    ALTER TABLE bids ADD COLUMN notes TEXT;
  END IF;

  -- Add documents array to bids if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'bids' AND column_name = 'documents') THEN
    ALTER TABLE bids ADD COLUMN documents JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add technical_score to bids if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'bids' AND column_name = 'technical_score') THEN
    ALTER TABLE bids ADD COLUMN technical_score NUMERIC CHECK (technical_score >= 0 AND technical_score <= 100);
  END IF;
END $$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_tenders_category ON tenders(category);
CREATE INDEX IF NOT EXISTS idx_tenders_is_reserved_for_mse ON tenders(is_reserved_for_mse);