/*
  # Procurement Officer Actions Tracking

  1. New Tables
    - `action_logs` - Tracks all procurement officer actions
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action_type` (text)
      - `entity_type` (text)
      - `entity_id` (uuid)
      - `details` (jsonb)
      - `created_at` (timestamptz)
  
  2. Changes
    - Add functions and triggers to automatically log procurement officer actions
    - Create notification system for vendors
  
  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Create action_logs table to track procurement officer actions
CREATE TABLE IF NOT EXISTS action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on action_logs
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for action_logs
CREATE POLICY "Admin can manage action logs" ON action_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Procurement officers can read action logs" ON action_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('procurement_officer', 'admin')
    )
  );

-- Function to log tender status changes and notify vendors
CREATE OR REPLACE FUNCTION log_tender_status_change()
RETURNS TRIGGER AS $$
DECLARE
  bid_record RECORD;
  vendor_user_id UUID;
BEGIN
  -- Only log if status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Insert a record into the action_logs table
    INSERT INTO action_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      details
    ) VALUES (
      auth.uid(),
      'status_change',
      'tender',
      NEW.id,
      jsonb_build_object(
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'tender_title', NEW.title
      )
    );
    
    -- If tender status changes to 'under_review' or 'awarded', notify all vendors who submitted bids
    IF NEW.status IN ('under_review', 'awarded') THEN
      FOR bid_record IN 
        SELECT b.vendor_id, v.user_id 
        FROM bids b
        JOIN vendors v ON b.vendor_id = v.id
        WHERE b.tender_id = NEW.id
      LOOP
        -- Get the vendor's user_id
        vendor_user_id := bid_record.user_id;
        
        -- Create a notification for the vendor
        IF vendor_user_id IS NOT NULL THEN
          INSERT INTO notifications (
            user_id,
            type,
            message,
            related_id
          ) VALUES (
            vendor_user_id,
            'tender_status',
            CASE 
              WHEN NEW.status = 'under_review' THEN 'Tender "' || NEW.title || '" is now under review'
              WHEN NEW.status = 'awarded' THEN 'Tender "' || NEW.title || '" has been awarded'
              ELSE 'Tender "' || NEW.title || '" status has been updated to ' || NEW.status
            END,
            NEW.id
          );
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to log tender status changes
DROP TRIGGER IF EXISTS on_tender_status_change ON tenders;
CREATE TRIGGER on_tender_status_change
  AFTER UPDATE OF status ON tenders
  FOR EACH ROW EXECUTE FUNCTION log_tender_status_change();

-- Function to log bid status changes and notify vendors
CREATE OR REPLACE FUNCTION log_bid_status_change()
RETURNS TRIGGER AS $$
DECLARE
  tender_title TEXT;
  vendor_user_id UUID;
BEGIN
  -- Only log if status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get the tender title
    SELECT title INTO tender_title FROM tenders WHERE id = NEW.tender_id;
    
    -- Insert a record into the action_logs table
    INSERT INTO action_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      details
    ) VALUES (
      auth.uid(),
      'status_change',
      'bid',
      NEW.id,
      jsonb_build_object(
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'tender_id', NEW.tender_id,
        'tender_title', tender_title,
        'vendor_id', NEW.vendor_id
      )
    );
    
    -- Get the vendor's user_id
    SELECT user_id INTO vendor_user_id FROM vendors WHERE id = NEW.vendor_id;
    
    -- Create a notification for the vendor
    IF vendor_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        message,
        related_id
      ) VALUES (
        vendor_user_id,
        'bid_status',
        CASE 
          WHEN NEW.status = 'under_review' THEN 'Your bid for "' || tender_title || '" is now under review'
          WHEN NEW.status = 'accepted' THEN 'Congratulations! Your bid for "' || tender_title || '" has been accepted'
          WHEN NEW.status = 'rejected' THEN 'Your bid for "' || tender_title || '" has been rejected'
          ELSE 'Your bid status for "' || tender_title || '" has been updated to ' || NEW.status
        END,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to log bid status changes
DROP TRIGGER IF EXISTS on_bid_status_change ON bids;
CREATE TRIGGER on_bid_status_change
  AFTER UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION log_bid_status_change();

-- Function to log technical score updates and notify vendors
CREATE OR REPLACE FUNCTION log_technical_score_update()
RETURNS TRIGGER AS $$
DECLARE
  tender_title TEXT;
  vendor_user_id UUID;
BEGIN
  -- Only log if technical_score has changed
  IF OLD.technical_score IS DISTINCT FROM NEW.technical_score THEN
    -- Get the tender title
    SELECT title INTO tender_title FROM tenders WHERE id = NEW.tender_id;
    
    -- Insert a record into the action_logs table
    INSERT INTO action_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      details
    ) VALUES (
      auth.uid(),
      'technical_score_update',
      'bid',
      NEW.id,
      jsonb_build_object(
        'previous_score', OLD.technical_score,
        'new_score', NEW.technical_score,
        'tender_id', NEW.tender_id,
        'tender_title', tender_title,
        'vendor_id', NEW.vendor_id
      )
    );
    
    -- Get the vendor's user_id
    SELECT user_id INTO vendor_user_id FROM vendors WHERE id = NEW.vendor_id;
    
    -- Create a notification for the vendor
    IF vendor_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        message,
        related_id
      ) VALUES (
        vendor_user_id,
        'technical_score',
        'Your technical score for "' || tender_title || '" has been updated to ' || NEW.technical_score || '%',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to log technical score updates
DROP TRIGGER IF EXISTS on_technical_score_update ON bids;
CREATE TRIGGER on_technical_score_update
  AFTER UPDATE OF technical_score ON bids
  FOR EACH ROW EXECUTE FUNCTION log_technical_score_update();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_entity_type_entity_id ON action_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_action_type ON action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at);