import { supabase } from '../supabase';

export async function createInvoice(invoiceData) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('invoices')
    .insert([{
      ...invoiceData,
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getInvoices(filters = {}) {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      vendors (
        name,
        business_type
      )
    `);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function processPayment(paymentData) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      ...paymentData,
      processed_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPayments(filters = {}) {
  let query = supabase
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
    `);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getPaymentById(id) {
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

export async function updatePaymentStatus(id, status) {
  const updates = { 
    status,
    ...(status === 'completed' ? { payment_date: new Date().toISOString() } : {})
  };
  
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createPaymentSchedule(scheduleData) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('payment_schedules')
    .insert([{
      ...scheduleData,
      created_by: user?.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPaymentSchedules(filters = {}) {
  let query = supabase
    .from('payment_schedules')
    .select(`
      *,
      vendors (
        name
      )
    `);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId);
  }

  const { data, error } = await query.order('schedule_date', { ascending: true });

  if (error) throw error;
  return data;
}