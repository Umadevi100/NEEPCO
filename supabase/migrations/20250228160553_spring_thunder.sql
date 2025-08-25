/*
  # Consolidated Migration

  1. New Tables
    - `profiles` - User profiles linked to auth.users
    - `vendors` - Vendor information
    - `tenders` - Procurement tenders
    - `bids` - Vendor bids on tenders
    - `payments` - Payment records
    - `vendor_approval_logs` - Logs of vendor approval status changes
    - `notifications` - User notifications
    - `vendor_approvals` - Vendor approval records

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Add policies for specific roles (admin, procurement_officer)
    
  3. Functions
    - Functions for handling user creation
    - Functions for vendor status changes
    - Functions for notifications
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  role TEXT CHECK (role IN ('vendor', 'procurement_officer', 'admin')),
  department TEXT,
  employee_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_type TEXT NOT NULL CHECK (business_type IN ('MSE', 'Large Enterprise')),
  contact_person TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  mse_certificate TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Suspended')),
  compliance_score INTEGER DEFAULT 0 CHECK (compliance_score >= 0 AND compliance_score <= 100),
  user_id UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tenders table
CREATE TABLE IF NOT EXISTS tenders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_value NUMERIC NOT NULL CHECK (estimated_value > 0),
  submission_deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'under_review', 'awarded', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected')),
  technical_score NUMERIC CHECK (technical_score >= 0 AND technical_score <= 100),
  notes TEXT,
  evaluated_by UUID REFERENCES auth.users(id),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, vendor_id)
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'check', 'credit_card')),
  notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendor approval logs table
CREATE TABLE IF NOT EXISTS vendor_approval_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendor_approvals table
CREATE TABLE IF NOT EXISTS vendor_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policies for vendors
CREATE POLICY "Vendors can read all vendors" ON vendors
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Vendors can update own profile" ON vendors
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vendors can insert own profile" ON vendors
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Procurement officers can update vendor status"
  ON vendors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('procurement_officer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('procurement_officer', 'admin')
    )
  );

CREATE POLICY "Procurement officers can read all vendors"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('procurement_officer', 'admin')
    )
  );

-- Create policies for tenders
CREATE POLICY "Anyone can read published tenders" ON tenders
  FOR SELECT TO authenticated
  USING (status = 'published' OR auth.uid() = created_by);

CREATE POLICY "Procurement officers can manage tenders" ON tenders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'procurement_officer')
    )
  );

-- Create policies for bids
CREATE POLICY "Vendors can read own bids" ON bids
  FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert own bids" ON bids
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Procurement officers can read all bids" ON bids
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'procurement_officer')
    )
  );

-- Create policies for payments
CREATE POLICY "Admin can manage payments" ON payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Procurement officers can manage payments" ON payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'procurement_officer'
    )
  );

CREATE POLICY "Vendors can read own payments" ON payments
  FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Create policies for vendor_approval_logs
CREATE POLICY "Admin can manage vendor approval logs" ON vendor_approval_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Procurement officers can manage vendor approval logs" ON vendor_approval_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'procurement_officer'
    )
  );

-- Create policies for notifications
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Procurement officers can manage all notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('procurement_officer', 'admin')
    )
  );

-- Create policies for vendor_approvals
CREATE POLICY "Procurement officers can manage vendor approvals"
  ON vendor_approvals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('procurement_officer', 'admin')
    )
  );

CREATE POLICY "Vendors can view their own approval status"
  ON vendor_approvals
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Create a function to handle profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'firstName', ''),
    COALESCE(new.raw_user_meta_data->>'lastName', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'vendor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the transaction
    RAISE NOTICE 'Error creating profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to handle vendor status changes and update user metadata
CREATE OR REPLACE FUNCTION public.handle_vendor_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has changed and user_id exists
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.user_id IS NOT NULL THEN
    BEGIN
      -- Update the user's metadata to include vendor status
      -- Use the correct approach to update metadata without overwriting existing values
      UPDATE auth.users
      SET raw_user_meta_data = 
        CASE 
          WHEN raw_user_meta_data IS NULL THEN 
            jsonb_build_object('vendorStatus', NEW.status)
          ELSE
            jsonb_set(raw_user_meta_data, '{vendorStatus}', to_jsonb(NEW.status))
        END
      WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE NOTICE 'Error updating user metadata: %', SQLERRM;
    END;
    
    -- If status is changing to Active, set approved_at
    IF NEW.status = 'Active' THEN
      NEW.approved_at = NOW();
    END IF;
    
    -- Update the last_status_change timestamp
    NEW.last_status_change = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to update user metadata when vendor status changes
DROP TRIGGER IF EXISTS on_vendor_status_update ON public.vendors;
CREATE TRIGGER on_vendor_status_update
  BEFORE UPDATE OF status ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.handle_vendor_status_change();

-- Function to log vendor status changes
CREATE OR REPLACE FUNCTION log_vendor_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Insert a record into the vendor_approval_logs table
    INSERT INTO vendor_approval_logs (
      vendor_id,
      previous_status,
      new_status,
      approved_by,
      reason
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.approved_by,
      CASE 
        WHEN NEW.status = 'Suspended' THEN NEW.rejection_reason
        ELSE NULL
      END
    );
    
    -- Update the last_status_change timestamp
    NEW.last_status_change = NOW();
    
    -- If status is changing to Active, set approved_at
    IF NEW.status = 'Active' AND OLD.status != 'Active' THEN
      NEW.approved_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to log vendor status changes
DROP TRIGGER IF EXISTS on_vendor_status_change_log ON vendors;
CREATE TRIGGER on_vendor_status_change_log
  BEFORE UPDATE OF status ON vendors
  FOR EACH ROW EXECUTE FUNCTION log_vendor_status_change();

-- Function to set initial vendor status on creation
CREATE OR REPLACE FUNCTION public.set_initial_vendor_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Set the vendor status to Pending by default
  NEW.status = 'Pending';
  
  -- Only update metadata if user_id exists
  IF NEW.user_id IS NOT NULL THEN
    BEGIN
      -- Update the user's metadata to include vendor status and hasVendorProfile
      UPDATE auth.users
      SET raw_user_meta_data = 
        CASE 
          WHEN raw_user_meta_data IS NULL THEN 
            jsonb_build_object('vendorStatus', 'Pending', 'hasVendorProfile', true)
          ELSE
            jsonb_set(
              jsonb_set(raw_user_meta_data, '{vendorStatus}', '"Pending"'::jsonb),
              '{hasVendorProfile}', 'true'::jsonb
            )
        END
      WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE NOTICE 'Error setting initial vendor status: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to set initial vendor status on creation
DROP TRIGGER IF EXISTS on_vendor_created ON public.vendors;
CREATE TRIGGER on_vendor_created
  BEFORE INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_initial_vendor_status();

-- Function to notify procurement officers when a new vendor registers
CREATE OR REPLACE FUNCTION notify_procurement_officers_of_new_vendor()
RETURNS TRIGGER AS $$
DECLARE
  procurement_officer RECORD;
BEGIN
  -- Only proceed if this is a new vendor with Pending status
  IF NEW.status = 'Pending' THEN
    -- Find all procurement officers and admins
    FOR procurement_officer IN 
      SELECT id FROM profiles 
      WHERE role IN ('procurement_officer', 'admin')
    LOOP
      -- Create a notification for each procurement officer
      INSERT INTO notifications (
        user_id,
        type,
        message,
        related_id
      ) VALUES (
        procurement_officer.id,
        'vendor_approval',
        'New vendor ' || NEW.name || ' requires approval',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to notify procurement officers when a new vendor is created
DROP TRIGGER IF EXISTS on_vendor_created_notify ON vendors;
CREATE TRIGGER on_vendor_created_notify
  AFTER INSERT ON vendors
  FOR EACH ROW EXECUTE FUNCTION notify_procurement_officers_of_new_vendor();

-- Function to notify vendor of status change
CREATE OR REPLACE FUNCTION notify_vendor_of_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has changed and user_id exists
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.user_id IS NOT NULL THEN
    BEGIN
      -- Create a notification for the vendor
      INSERT INTO notifications (
        user_id,
        type,
        message,
        related_id
      ) VALUES (
        NEW.user_id,
        'vendor_status',
        CASE 
          WHEN NEW.status = 'Active' THEN 'Your vendor account has been approved!'
          WHEN NEW.status = 'Suspended' THEN 'Your vendor account has been suspended. Please contact support.'
          ELSE 'Your vendor status has been updated to ' || NEW.status
        END,
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE NOTICE 'Error creating notification: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to notify vendors when their status changes
DROP TRIGGER IF EXISTS on_vendor_status_notify ON vendors;
CREATE TRIGGER on_vendor_status_notify
  AFTER UPDATE OF status ON vendors
  FOR EACH ROW EXECUTE FUNCTION notify_vendor_of_status_change();

-- Function to automatically create approval record when vendor is created
CREATE OR REPLACE FUNCTION create_vendor_approval()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vendor_approvals (vendor_id, status)
  VALUES (NEW.id, 'pending');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to create approval record when vendor is created
DROP TRIGGER IF EXISTS on_vendor_created_approval ON vendors;
CREATE TRIGGER on_vendor_created_approval
  AFTER INSERT ON vendors
  FOR EACH ROW EXECUTE FUNCTION create_vendor_approval();

-- Function to check if a vendor is allowed to login
CREATE OR REPLACE FUNCTION auth.check_vendor_login_permission()
RETURNS TRIGGER AS $$
DECLARE
  vendor_status TEXT;
  user_role TEXT;
BEGIN
  BEGIN
    -- Get the user's role from metadata
    user_role := NEW.raw_user_meta_data->>'role';
    
    -- If user is not a vendor, they can always login
    IF user_role != 'vendor' THEN
      RETURN NEW;
    END IF;
    
    -- Get vendor status from metadata (if available) or from vendors table
    vendor_status := NEW.raw_user_meta_data->>'vendorStatus';
    
    IF vendor_status IS NULL THEN
      -- If not in metadata, check the vendors table
      SELECT status INTO vendor_status 
      FROM public.vendors 
      WHERE user_id = NEW.id;
    END IF;
    
    -- If vendor is suspended, prevent login
    IF vendor_status = 'Suspended' THEN
      RAISE EXCEPTION 'Your vendor account has been suspended. Please contact the procurement officer.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the login
    RAISE NOTICE 'Error checking vendor login permission: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to check vendor login permission
-- Note: This trigger will run before a user signs in
DROP TRIGGER IF EXISTS check_vendor_login ON auth.users;
CREATE TRIGGER check_vendor_login
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION auth.check_vendor_login_permission();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_vendors_business_type ON vendors(business_type);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_submission_deadline ON tenders(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_tenders_created_by ON tenders(created_by);
CREATE INDEX IF NOT EXISTS idx_bids_tender_id ON bids(tender_id);
CREATE INDEX IF NOT EXISTS idx_bids_vendor_id ON bids(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id ON payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_vendor_approval_logs_vendor_id ON vendor_approval_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_approval_logs_approved_by ON vendor_approval_logs(approved_by);
CREATE INDEX IF NOT EXISTS idx_vendors_approved_by ON vendors(approved_by);
CREATE INDEX IF NOT EXISTS idx_vendors_last_status_change ON vendors(last_status_change);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_vendor_id ON vendor_approvals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_status ON vendor_approvals(status);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_approved_by ON vendor_approvals(approved_by);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id_status ON vendors(user_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles(id, role);