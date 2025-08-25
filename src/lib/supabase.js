import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    // Add rate limiting handling
    fetch: (...args) => {
      return fetch(...args).then(async (response) => {
        // Handle rate limiting
        if (response.status === 429) {
          console.warn('Supabase rate limit reached');
        }
        return response;
      });
    }
  }
});

// Vendor API
export const vendorAPI = {
  async create(vendorData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('vendors')
      .insert([{
        ...vendorData,
        user_id: user?.id,
        status: 'Pending' // Ensure status is set to Pending
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  
  async updateStatus(id, status, reason = null) {
    if (!id) throw new Error('Vendor ID is required');
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const updateData = { 
      status,
      approved_by: user?.id
    };
    
    // Add rejection reason if provided
    if (reason && status === 'Suspended') {
      updateData.rejection_reason = reason;
    }
    
    const { data, error } = await supabase
      .from('vendors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  
  async getPendingVendors() {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

// Tender API
export const tenderAPI = {
  async create(tenderData) {
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

  async getAll() {
    const { data, error } = await supabase
      .from('tenders')
      .select(`
        *,
        bids!bids_tender_id_fkey (
          id,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    try {
      // First try to get just the tender data
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Then get the bids separately
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          vendors (
            id,
            name,
            business_type
          )
        `)
        .eq('tender_id', id);
        
      if (bidsError) {
        console.error('Error fetching bids:', bidsError);
        // Continue without bids if there's an error
      } else {
        // Add bids to the tender data
        data.bids = bids || [];
      }
      
      return data;
    } catch (error) {
      console.error('Error in tenderAPI.getById:', error);
      throw error;
    }
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('tenders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Bid API
export const bidAPI = {
  async create(bidData) {
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

  async getByTenderId(tenderId) {
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
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('bids')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  
  async getVendorBids(vendorId) {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        tenders (
          title,
          status,
          submission_deadline,
          estimated_value
        )
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// Payment API
export const paymentAPI = {
  async create(paymentData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('payments')
      .insert([{
        ...paymentData,
        processed_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        vendors (
          name,
          business_type
        ),
        related_tender (
          id,
          title
        ),
        related_bid (
          id,
          amount
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getByVendorId(vendorId) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        related_tender (
          id,
          title
        ),
        related_bid (
          id,
          amount
        )
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  
  async getById(id) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        vendors (
          name,
          business_type
        ),
        related_tender (
          id,
          title,
          description,
          estimated_value
        ),
        related_bid (
          id,
          amount,
          status
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }
};

// Profile API
export const profileAPI = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Action Logs API
export const actionLogsAPI = {
  async getActionLogs(entityType, entityId) {
    const { data, error } = await supabase
      .from('action_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getVendorActionLogs(vendorId) {
    const { data, error } = await supabase
      .from('action_logs')
      .select('*')
      .eq('entity_type', 'vendor')
      .eq('entity_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getUserActionLogs(userId) {
    const { data, error } = await supabase
      .from('action_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

// Notification API
export const notificationAPI = {
  async getNotifications(userId, options = {}) {
    const { isRead = false, limit = 10, type = null } = options;
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);
    
    // Filter by read status if specified
    if (isRead !== null) {
      query = query.eq('is_read', isRead);
    }
    
    // Filter by notification type if specified
    if (type) {
      query = query.eq('type', type);
    }
    
    // Order by created_at descending and limit results
    query = query.order('created_at', { ascending: false }).limit(limit);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async markAsRead(notificationId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select();
    
    if (error) throw error;
    return data;
  },

  async markAllAsRead(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) throw error;
    return data;
  }
};