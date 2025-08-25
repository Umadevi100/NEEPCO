-- Update the payments policy for vendors
DROP POLICY IF EXISTS "Vendors can update own payments" ON payments;
CREATE POLICY "Vendors can update own payments" ON payments
  FOR UPDATE TO authenticated
  USING (
    -- Can only update their own payments
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
    -- Can only update pending payments
    AND status = 'pending'
  )
  WITH CHECK (
    -- Can only set status to processing
    status = 'processing'
    -- Must provide transaction ID and payment method
    AND transaction_id IS NOT NULL
    AND payment_method IS NOT NULL
  );

-- Function to validate vendor payment updates
CREATE OR REPLACE FUNCTION validate_vendor_payment_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure vendor can only update specific fields
  IF TG_OP = 'UPDATE' THEN
    -- Keep original values for these fields
    NEW.vendor_id := OLD.vendor_id;
    NEW.amount := OLD.amount;
    NEW.related_tender := OLD.related_tender;
    NEW.related_bid := OLD.related_bid;
    
    -- Set payment date when moving to processing
    IF NEW.status = 'processing' AND OLD.status = 'pending' THEN
      NEW.payment_date := CURRENT_TIMESTAMP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment validation
DROP TRIGGER IF EXISTS validate_vendor_payment_update_trigger ON payments;
CREATE TRIGGER validate_vendor_payment_update_trigger
  BEFORE UPDATE ON payments
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'processing')
  EXECUTE FUNCTION validate_vendor_payment_update();

-- Function to notify procurement officers of new payments
CREATE OR REPLACE FUNCTION notify_procurement_officers_of_payment()
RETURNS TRIGGER AS $$
DECLARE
  procurement_officer RECORD;
  vendor_name TEXT;
BEGIN
  -- Only notify when status changes to processing
  IF NEW.status = 'processing' AND OLD.status = 'pending' THEN
    -- Get vendor name
    SELECT name INTO vendor_name
    FROM vendors
    WHERE id = NEW.vendor_id;
    
    -- Notify all procurement officers
    FOR procurement_officer IN 
      SELECT id FROM profiles 
      WHERE role IN ('procurement_officer', 'admin')
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        message,
        related_id
      ) VALUES (
        procurement_officer.id,
        'payment_submitted',
        'New payment submitted by ' || COALESCE(vendor_name, 'Unknown Vendor') || ' requires verification',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment notifications
DROP TRIGGER IF EXISTS notify_payment_submitted_trigger ON payments;
CREATE TRIGGER notify_payment_submitted_trigger
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'processing')
  EXECUTE FUNCTION notify_procurement_officers_of_payment();