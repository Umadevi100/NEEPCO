import { supabase } from '../supabase';

export async function getNotifications(userId, options = {}) {
  try {
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
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId, type = null) {
  try {
    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    // Filter by notification type if specified
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

export async function getUnreadNotificationCount(userId, type = null) {
  try {
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    // Filter by notification type if specified
    if (type) {
      query = query.eq('type', type);
    }
    
    const { count, error } = await query;
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}