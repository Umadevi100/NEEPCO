import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

export default function ActivityLog({ vendorId }) {
  const { user } = useAuth();
  
  // Get vendor details if vendorId is not provided
  const { data: vendorDetails, isLoading: isLoadingVendor } = useQuery({
    queryKey: ['vendor-details', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching vendor details:', error);
        return null;
      }
    },
    enabled: !vendorId && !!user?.id,
  });

  // Use provided vendorId or get from vendor details
  const effectiveVendorId = vendorId || vendorDetails?.id;

  // Get all bids for this vendor
  const { data: bids, isLoading: isLoadingBids } = useQuery({
    queryKey: ['vendor-bids', effectiveVendorId],
    queryFn: async () => {
      if (!effectiveVendorId) return [];
      
      try {
        const { data, error } = await supabase
          .from('bids')
          .select(`
            id,
            tender_id
          `)
          .eq('vendor_id', effectiveVendorId);
          
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendor bids:', error);
        return [];
      }
    },
    enabled: !!effectiveVendorId,
  });

  // Get all tender IDs this vendor has bid on
  const tenderIds = bids?.map(bid => bid.tender_id) || [];
  const bidIds = bids?.map(bid => bid.id) || [];

  // Get all action logs related to this vendor's bids and tenders
  const { data: actionLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['vendor-action-logs', effectiveVendorId, tenderIds, bidIds],
    queryFn: async () => {
      if (!effectiveVendorId || (tenderIds.length === 0 && bidIds.length === 0)) return [];
      
      try {
        // Get logs for vendor status changes
        const { data: vendorLogs, error: vendorError } = await supabase
          .from('action_logs')
          .select('*')
          .eq('entity_type', 'vendor')
          .eq('entity_id', effectiveVendorId)
          .order('created_at', { ascending: false });
          
        if (vendorError) throw vendorError;
        
        // Get logs for tender status changes
        const { data: tenderLogs, error: tenderError } = tenderIds.length > 0 ? await supabase
          .from('action_logs')
          .select('*')
          .eq('entity_type', 'tender')
          .in('entity_id', tenderIds)
          .order('created_at', { ascending: false }) : { data: [], error: null };
          
        if (tenderError) throw tenderError;
        
        // Get logs for bid status changes
        const { data: bidLogs, error: bidError } = bidIds.length > 0 ? await supabase
          .from('action_logs')
          .select('*')
          .eq('entity_type', 'bid')
          .in('entity_id', bidIds)
          .order('created_at', { ascending: false }) : { data: [], error: null };
          
        if (bidError) throw bidError;
        
        // Combine all logs and sort by created_at
        const allLogs = [...(vendorLogs || []), ...(tenderLogs || []), ...(bidLogs || [])];
        return allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } catch (error) {
        console.error('Error fetching action logs:', error);
        return [];
      }
    },
    enabled: !!effectiveVendorId && (tenderIds.length > 0 || bidIds.length > 0),
  });

  // Get all vendor approval logs
  const { data: approvalLogs, isLoading: isLoadingApprovalLogs } = useQuery({
    queryKey: ['vendor-approval-logs', effectiveVendorId],
    queryFn: async () => {
      if (!effectiveVendorId) return [];
      
      try {
        const { data, error } = await supabase
          .from('vendor_approval_logs')
          .select('*')
          .eq('vendor_id', effectiveVendorId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching approval logs:', error);
        return [];
      }
    },
    enabled: !!effectiveVendorId,
  });

  // Get all notifications for this user
  const { data: notifications, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['user-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Combine all activity logs
  const allActivity = [
    ...(actionLogs || []).map(log => ({
      type: 'action',
      data: log,
      date: new Date(log.created_at)
    })),
    ...(approvalLogs || []).map(log => ({
      type: 'approval',
      data: log,
      date: new Date(log.created_at)
    })),
    ...(notifications || []).map(notification => ({
      type: 'notification',
      data: notification,
      date: new Date(notification.created_at)
    }))
  ].sort((a, b) => b.date - a.date);

  const isLoading = isLoadingVendor || isLoadingBids || isLoadingLogs || isLoadingApprovalLogs || isLoadingNotifications;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (allActivity.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-600">No activity logs found.</p>
      </div>
    );
  }

  // Function to render activity item based on type
  const renderActivityItem = (activity) => {
    const { type, data } = activity;
    
    if (type === 'action') {
      // Render action log
      const actionType = data.action_type;
      const entityType = data.entity_type;
      const details = data.details;
      
      if (actionType === 'status_change') {
        if (entityType === 'tender') {
          return (
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-900">
                  Tender Status Changed
                </div>
                <div className="text-sm text-gray-500">
                  Tender "{details.tender_title}" status changed from {details.previous_status.replace('_', ' ')} to {details.new_status.replace('_', ' ')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {format(new Date(data.created_at), 'PPp')}
                </div>
              </div>
            </div>
          );
        } else if (entityType === 'bid') {
          return (
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-900">
                  Bid Status Changed
                </div>
                <div className="text-sm text-gray-500">
                  Your bid for "{details.tender_title}" status changed from {details.previous_status.replace('_', ' ')} to {details.new_status.replace('_', ' ')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {format(new Date(data.created_at), 'PPp')}
                </div>
              </div>
            </div>
          );
        }
      } else if (actionType === 'technical_score_update') {
        return (
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">
                Technical Score Updated
              </div>
              <div className="text-sm text-gray-500">
                Your technical score for "{details.tender_title}" was updated to {details.new_score}%
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {format(new Date(data.created_at), 'PPp')}
              </div>
            </div>
          </div>
        );
      }
    } else if (type === 'approval') {
      // Render approval log
      return (
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              data.new_status === 'Active' 
                ? 'bg-green-100 text-green-600' 
                : data.new_status === 'Suspended'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {data.new_status === 'Active' 
                ? 'Account Approved' 
                : data.new_status === 'Suspended'
                ? 'Account Suspended'
                : 'Status Changed'}
            </div>
            <div className="text-sm text-gray-500">
              Your account status changed from {data.previous_status || 'New'} to {data.new_status}
              {data.reason && (
                <div className="mt-1 text-sm text-gray-700">
                  Reason: {data.reason}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {format(new Date(data.created_at), 'PPp')}
            </div>
          </div>
        </div>
      );
    } else if (type === 'notification') {
      // Render notification
      return (
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {data.type.replace('_', ' ').charAt(0).toUpperCase() + data.type.replace('_', ' ').slice(1)}
            </div>
            <div className="text-sm text-gray-500">
              {data.message}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {format(new Date(data.created_at), 'PPp')}
            </div>
          </div>
        </div>
      );
    }
    
    // Default fallback
    return (
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="ml-4">
          <div className="text-sm font-medium text-gray-900">
            Activity
          </div>
          <div className="text-sm text-gray-500">
            Unknown activity type
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {format(activity.date, 'PPp')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {allActivity.map((activity, index) => (
        <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          {renderActivityItem(activity)}
        </div>
      ))}
    </div>
  );
}