import { supabase } from '../supabase';

export async function generateProcurementReport(filters = {}) {
  let query = supabase
    .from('tenders')
    .select(`
      *,
      bids (
        id,
        amount,
        status,
        vendors (
          name,
          business_type
        )
      )
    `);

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function generateVendorReport(filters = {}) {
  let query = supabase
    .from('vendors')
    .select(`
      *,
      bids (
        id,
        amount,
        status,
        tenders (
          title,
          status
        )
      )
    `);

  if (filters.businessType) {
    query = query.eq('business_type', filters.businessType);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function generatePaymentReport(filters = {}) {
  let query = supabase
    .from('payments')
    .select(`
      *,
      vendors (
        name,
        business_type
      )
    `);

  if (filters.startDate) {
    query = query.gte('payment_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('payment_date', filters.endDate);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('payment_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getDashboardMetrics() {
  const [
    { data: tenders, error: tendersError },
    { data: vendors, error: vendorsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase
      .from('tenders')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('vendors')
      .select('business_type, status')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('payments')
      .select('status, amount')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (tendersError || vendorsError || paymentsError) {
    throw new Error('Failed to fetch dashboard metrics');
  }

  return {
    tenders: {
      total: tenders.length,
      published: tenders.filter(t => t.status === 'published').length,
      underReview: tenders.filter(t => t.status === 'under_review').length,
      awarded: tenders.filter(t => t.status === 'awarded').length,
    },
    vendors: {
      total: vendors.length,
      mse: vendors.filter(v => v.business_type === 'MSE').length,
      active: vendors.filter(v => v.status === 'Active').length,
    },
    payments: {
      total: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      completed: payments.filter(p => p.status === 'completed').length,
      pending: payments.filter(p => p.status === 'pending').length,
    },
  };
}