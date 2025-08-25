import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

export default function VendorApprovalList() {
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: pendingVendors, isLoading } = useQuery({
    queryKey: ['pending-vendors'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('status', 'Pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching pending vendors:', error);
        toast.error('Failed to load pending vendors');
        return [];
      }
    },
  });

  const updateVendorStatus = useMutation({
    mutationFn: async ({ id, status, reason = null }) => {
      if (!id) {
        throw new Error('Vendor ID is required');
      }
      
      const updateData = { 
        status,
        approved_by: user.id
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
      
      // Also create a notification for the vendor
      const vendorUser = await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', id)
        .single();
        
      if (vendorUser?.data?.user_id) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: vendorUser.data.user_id,
            type: 'vendor_status',
            message: status === 'Active' 
              ? 'Your vendor account has been approved! You can now access the system.'
              : 'Your vendor account has been suspended. Please contact support for more information.',
            related_id: id
          }]);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['pending-vendors']);
      queryClient.invalidateQueries(['vendors']); 
      
      const statusMessage = {
        'Active': 'Vendor approved successfully',
        'Suspended': 'Vendor suspended successfully',
      };
      toast.success(statusMessage[data.status] || 'Vendor status updated successfully');
      
      // Reset rejection reason and close modal
      setRejectionReason('');
      setShowReasonModal(false);
      setSelectedVendorId(null);
    },
    onError: (error) => {
      console.error('Error updating vendor status:', error);
      toast.error(error.message || 'Failed to update vendor status');
      setShowReasonModal(false);
      setSelectedVendorId(null);
    }
  });

  const handleApproveVendor = (id) => {
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    updateVendorStatus.mutate({ id, status: 'Active' });
  };

  const handleRejectVendor = (id) => {
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    // Store the vendor ID and show the reason modal
    setSelectedVendorId(id);
    setShowReasonModal(true);
  };
  
  const confirmRejection = () => {
    if (!selectedVendorId) {
      toast.error('Vendor ID is missing');
      return;
    }
    
    updateVendorStatus.mutate({ 
      id: selectedVendorId, 
      status: 'Suspended', 
      reason: rejectionReason 
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {/* Rejection Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Rejection Reason</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this vendor. This will be recorded in the system and visible to the vendor.
            </p>
            <textarea
              className="input w-full h-32 mb-4"
              placeholder="Enter reason for rejection"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowReasonModal(false);
                  setSelectedVendorId(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmRejection}
                disabled={!rejectionReason.trim() || updateVendorStatus.isLoading}
              >
                {updateVendorStatus.isLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Vendor Approvals</h2>
      
      {pendingVendors && pendingVendors.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Person
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingVendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {vendor.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vendor.business_type === 'MSE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {vendor.business_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {vendor.contact_person}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {vendor.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApproveVendor(vendor.id)}
                        className="text-green-600 hover:text-green-900 font-medium"
                        disabled={updateVendorStatus.isLoading}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectVendor(vendor.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                        disabled={updateVendorStatus.isLoading}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-600">No pending vendor approvals found.</p>
        </div>
      )}
    </div>
  );
}