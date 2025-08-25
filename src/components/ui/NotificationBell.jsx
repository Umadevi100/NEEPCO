import { useState, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
  const [showDropdown, setShowDropdown] = useState(false);
  const { user } = useAuth();
  
  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (error) {
          // Handle rate limit errors gracefully
          if (error.code === '429' || error.message?.includes('rate limit')) {
            console.warn('Rate limit reached when fetching notifications');
            return [];
          }
          throw error;
        }
        return data || [];
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 1, // Only retry once to avoid excessive requests
  });
  
  const markAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
        
      // Refetch notifications after marking as read
      refetch();
      
      // Close dropdown after clicking
      setShowDropdown(false);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.notification-container')) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);
  
  const unreadCount = notifications?.length || 0;
  
  // Get notification link based on type
  const getNotificationLink = (notification) => {
    switch (notification.type) {
      case 'vendor_approval':
        return '/vendors';
      case 'vendor_status':
        return '/profile';
      case 'tender_status':
        return `/procurement/${notification.related_id}`;
      case 'bid_status':
        return `/tenders/${notification.related_id}`;
      case 'technical_score':
        return `/tenders/${notification.related_id}`;
      default:
        return '#';
    }
  };
  
  return (
    <div className="notification-container relative">
      <button 
        className="relative p-1 rounded-full text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="sr-only">View notifications</span>
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-primary-700"></span>
        )}
      </button>
      
      {showDropdown && (
        <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
            <div className="font-medium">Notifications</div>
            {unreadCount > 0 && (
              <div className="text-xs text-gray-500">{unreadCount} unread</div>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-2 text-sm text-gray-700">Loading notifications...</div>
            ) : notifications?.length > 0 ? (
              notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className="px-4 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                >
                  <Link 
                    to={getNotificationLink(notification)} 
                    className="block"
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="text-sm font-medium text-gray-900">{notification.message}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </Link>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-700">No new notifications</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}