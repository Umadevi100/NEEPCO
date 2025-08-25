import { supabase } from '../supabase';

// Helper functions for common database operations
export const dbHelpers = {
  async createTender(tenderData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('tenders')
      .insert([{
        ...tenderData,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getTenders() {
    const { data, error } = await supabase
      .from('tenders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getTenderById(id) {
    const { data, error } = await supabase
      .from('tenders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createVendor(vendorData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('vendors')
      .insert([{
        ...vendorData,
        user_id: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getVendors() {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getVendorById(id) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createBid(bidData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    // First get the vendor ID for the current user
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user?.id)
      .single();
      
    if (vendorError) throw vendorError;
    
    const { data, error } = await supabase
      .from('bids')
      .insert([{
        ...bidData,
        vendor_id: vendor.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getBidsByTenderId(tenderId) {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        vendors (
          name,
          business_type
        )
      `)
      .eq('tender_id', tenderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};