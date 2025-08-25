import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ActivityLog from './ActivityLog';

function VendorDetails() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isEditingComplianceScore, setIsEditingComplianceScore] = useState(false);
  const [complianceScore, setComplianceScore] = useState(0);
  const [complianceNote, setComplianceNote] = useState('');
  const [complianceType, setComplianceType] = useState('neutral');

  const { data: vendor, isLoading, error } = useQuery({
    queryKey: ['vendors', id],
    queryFn: async () => {
      try {
        if (!id) {
          throw new Error('Vendor ID is missing');
        }
        
        // Use maybeSingle instead of single to handle the case where no vendor is found
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Vendor not found');
        
        return data;
      } catch (error) {
        console.error('Error fetching vendor:', error);
        throw error;
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: approvalLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['vendor-approval-logs', id],
    queryFn: async () => {
      try {
        if (!id) return [];
        
        const { data, error } = await supabase
          .from('vendor_approval_logs')
          .select('*')
          .eq('vendor_id', id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching approval logs:', error);
        return [];
      }
    },
    enabled: !!id,
  });

  // Get vendor bids
  const { data: vendorBids, isLoading: isLoadingBids } = useQuery({
    queryKey: ['vendor-bids', id],
    queryFn: async () => {
      if (!id) return [];
      
      try {
        const { data, error } = await supabase
          .from('bids')
          .select(`
            *,
            tender:tender_id (
              id,
              title,
              status,
              submission_deadline,
              estimated_value,
              awarded_bid_id
            )
          `)
          .eq('vendor_id', id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendor bids:', error);
        return [];
      }
    },
    enabled: !!id,
  });

  // Get vendor payments
  const { data: vendorPayments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['vendor-payments', id],
    queryFn: async () => {
      if (!id) return [];
      
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('vendor_id', id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendor payments:', error);
        return [];
      }
    },
    enabled: !!id,
  });

  // Get compliance history
  const { data: complianceHistory, isLoading: isLoadingComplianceHistory } = useQuery({
    queryKey: ['vendor-compliance-history', id],
    queryFn: async () => {
      if (!id) return [];
      
      try {
        // If compliance_history exists in vendor details, use it
        if (vendor?.compliance_history && Array.isArray(vendor.compliance_history)) {
          return vendor.compliance_history;
        }
        
        // Otherwise return empty array
        return [];
      } catch (error) {
        console.error('Error fetching compliance history:', error);
        return [];
      }
    },
    enabled: !!id && !!vendor,
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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['vendors', id]);
      queryClient.invalidateQueries(['vendors']); // Also invalidate the vendors list
      queryClient.invalidateQueries(['vendor-approval-logs', id]); // Refresh approval logs
      
      const statusMessage = {
        'Active': 'Vendor approved successfully',
        'Suspended': 'Vendor suspended successfully',
        'Pending': 'Vendor set to pending status'
      };
      toast.success(statusMessage[data.status] || 'Vendor status updated successfully');
      
      // Reset rejection reason and close modal
      setRejectionReason('');
      setShowReasonModal(false);
    },
    onError: (error) => {
      console.error('Error updating vendor status:', error);
      toast.error(error.message || 'Failed to update vendor status');
      setShowReasonModal(false);
    }
  });

  const updateComplianceScore = useMutation({
    mutationFn: async ({ id, score, note, type }) => {
      if (!id) {
        throw new Error('Vendor ID is required');
      }
      
      // Get current compliance history
      let currentHistory = [];
      if (vendor?.compliance_history && Array.isArray(vendor.compliance_history)) {
        currentHistory = [...vendor.compliance_history];
      }
      
      // Calculate score change
      const oldScore = vendor?.compliance_score || 0;
      const scoreChange = score - oldScore;
      
      // Create new compliance history entry
      const newEntry = {
        date: new Date().toISOString(),
        title: 'Compliance Score Update',
        description: note || 'Score updated by procurement officer',
        score_change: scoreChange,
        type: type || 'neutral',
        updated_by: user.id
      };
      
      // Add new entry to history
      const updatedHistory = [newEntry, ...currentHistory];
      
      // Update vendor
      const { data, error } = await supabase
        .from('vendors')
        .update({
          compliance_score: score,
          compliance_history: updatedHistory
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['vendors', id]);
      queryClient.invalidateQueries(['vendors']); // Also invalidate the vendors list
      queryClient.invalidateQueries(['vendor-compliance-history', id]); // Refresh compliance history
      
      toast.success('Compliance score updated successfully');
      
      // Reset form
      setIsEditingComplianceScore(false);
      setComplianceScore(0);
      setComplianceNote('');
      setComplianceType('neutral');
    },
    onError: (error) => {
      console.error('Error updating compliance score:', error);
      toast.error(error.message || 'Failed to update compliance score');
    }
  });

  const handleApproveVendor = () => {
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    updateVendorStatus.mutate({ id, status: 'Active' });
  };

  const handleSuspendVendor = () => {
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    // Show reason modal instead of immediately suspending
    setShowReasonModal(true);
  };
  
  const confirmSuspension = () => {
    updateVendorStatus.mutate({ 
      id, 
      status: 'Suspended', 
      reason: rejectionReason 
    });
  };

  const handleComplianceScoreSubmit = (e) => {
    e.preventDefault();
    
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    
    // Validate score
    const score = parseInt(complianceScore);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error('Compliance score must be between 0 and 100');
      return;
    }
    
    updateComplianceScore.mutate({
      id,
      score,
      note: complianceNote,
      type: complianceType
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="card p-6 bg-red-50 border border-red-200">
        <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
        <p className="text-red-700">{error.message || 'Failed to load vendor details'}</p>
        <button 
          onClick={() => window.history.back()} 
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="card p-6 bg-yellow-50 border border-yellow-200">
        <h2 className="text-xl font-semibold text-yellow-800 mb-2">Vendor Not Found</h2>
        <p className="text-yellow-700">The vendor you're looking for doesn't exist or has been removed.</p>
        <button 
          onClick={() => window.history.back()} 
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rejection Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Suspension Reason</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for suspending this vendor. This will be recorded in the system.
            </p>
            <textarea
              className="input w-full h-32 mb-4"
              placeholder="Enter reason for suspension"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowReasonModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmSuspension}
                disabled={!rejectionReason.trim() || updateVendorStatus.isLoading}
              >
                {updateVendorStatus.isLoading ? 'Processing...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{vendor.name}</h1>
        <div className="space-x-2">
          {vendor.status === 'Pending' && (
            <button
              onClick={handleApproveVendor}
              className="btn btn-primary"
              disabled={updateVendorStatus.isLoading}
            >
              {updateVendorStatus.isLoading ? 'Processing...' : 'Approve Vendor'}
            </button>
          )}
          {vendor.status === 'Active' && (
            <button
              onClick={handleSuspendVendor}
              className="btn btn-secondary"
              disabled={updateVendorStatus.isLoading}
            >
              {updateVendorStatus.isLoading ? 'Processing...' : 'Suspend Vendor'}
            </button>
          )}
          {vendor.status === 'Suspended' && (
            <button
              onClick={handleApproveVendor}
              className="btn btn-primary"
              disabled={updateVendorStatus.isLoading}
            >
              {updateVendorStatus.isLoading ? 'Processing...' : 'Reactivate Vendor'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`${
              activeTab === 'details'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('bids')}
            className={`${
              activeTab === 'bids'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Bids
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`${
              activeTab === 'payments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`${
              activeTab === 'compliance'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Compliance
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`${
              activeTab === 'activity'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Activity Log
          </button>
        </nav>
      </div>
      
      {/* Details Tab */}
      {activeTab === 'details' && (
        <>
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
                <dl className="mt-4 space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
                    <dd className="text-lg text-gray-900">{vendor.contact_person}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="text-lg text-gray-900">{vendor.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phone</dt>
                    <dd className="text-lg text-gray-900">{vendor.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Address</dt>
                    <dd className="text-lg text-gray-900">{vendor.address}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
                <dl className="mt-4 space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Business Type</dt>
                    <dd>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        vendor.business_type === 'MSE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {vendor.business_type}
                      </span>
                    </dd>
                  </div>
                  {vendor.business_type === 'MSE' && vendor.mse_certificate && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">MSE Certificate</dt>
                      <dd className="text-lg text-gray-900">{vendor.mse_certificate}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        vendor.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : vendor.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {vendor.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Compliance Score</dt>
                    <dd className="text-lg text-gray-900">{vendor.compliance_score || 0}%</dd>
                  </div>
                  {vendor.approved_at && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Approved On</dt>
                      <dd className="text-lg text-gray-900">
                        {new Date(vendor.approved_at).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  {vendor.approved_by && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Approved By</dt>
                      <dd className="text-lg text-gray-900">
                        Procurement Officer
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h2>
            
            {vendor?.bank_details && 
             (vendor.bank_details.accountName || 
              vendor.bank_details.accountNumber || 
              vendor.bank_details.bankName) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Account Holder Name</p>
                  <p className="mt-1 text-lg text-gray-900">{vendor.bank_details.accountName || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Account Number</p>
                  <p className="mt-1 text-lg text-gray-900">
                    {vendor.bank_details.accountNumber ? 
                      `XXXX-XXXX-${vendor.bank_details.accountNumber.slice(-4)}` : 
                      'N/A'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Bank Name</p>
                  <p className="mt-1 text-lg text-gray-900">{vendor.bank_details.bankName || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">IFSC Code</p>
                  <p className="mt-1 text-lg text-gray-900">{vendor.bank_details.ifscCode || 'N/A'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-gray-600">No bank details have been added by this vendor.</p>
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            
            {vendor?.documents && vendor.documents.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Document Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Uploaded On
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Verification Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendor.documents.map((doc, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap capitalize">
                            {doc.type?.replace('_', ' ') || 'Other'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {doc.url ? (
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-900">
                                {doc.name}
                              </a>
                            ) : (
                              doc.name
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {doc.verifiedAt ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Verified
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pending Verification
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {!doc.verifiedAt && (
                              <button
                                className="text-primary-600 hover:text-primary-900"
                                onClick={() => {
                                  // Handle document verification
                                  toast.success('Document verification feature coming soon');
                                }}
                              >
                                Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600">No documents have been uploaded by this vendor.</p>
              </div>
            )}
          </div>

          {vendor.status === 'Pending' && (
            <div className="card bg-yellow-50 border border-yellow-200">
              <h2 className="text-xl font-semibold text-yellow-900 mb-4">Vendor Approval Required</h2>
              <div className="space-y-4">
                <p className="text-yellow-800">
                  This vendor account is pending approval. Once approved, the vendor will be able to access the system and submit bids.
                </p>
                
                <div className="bg-white p-4 rounded-md border border-yellow-200">
                  <h3 className="font-medium text-gray-900 mb-2">Approval Checklist</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    <li>Verify business registration documents</li>
                    <li>Confirm contact information is accurate</li>
                    <li>Check MSE certification (if applicable)</li>
                    <li>Review compliance history</li>
                  </ul>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={handleApproveVendor}
                    className="btn btn-primary"
                    disabled={updateVendorStatus.isLoading}
                  >
                    {updateVendorStatus.isLoading ? 'Processing...' : 'Approve Vendor'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {vendor.status === 'Suspended' && (
            <div className="card bg-red-50">
              <h2 className="text-xl font-semibold text-red-900 mb-4">Vendor Account Suspended</h2>
              <p className="text-red-800 mb-4">
                This vendor account is currently suspended. The vendor cannot access the system or submit bids until reactivated.
              </p>
              {vendor.rejection_reason && (
                <div className="bg-white p-4 rounded-md border border-red-200 mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Suspension Reason</h3>
                  <p className="text-gray-700">{vendor.rejection_reason}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleApproveVendor}
                  className="btn btn-primary"
                  disabled={updateVendorStatus.isLoading}
                >
                  {updateVendorStatus.isLoading ? 'Processing...' : 'Reactivate Vendor'}
                </button>
              </div>
            </div>
          )}

          {/* Approval History */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Approval History</h2>
            {isLoadingLogs ? (
              <LoadingSpinner />
            ) : approvalLogs && approvalLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {approvalLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {log.previous_status && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                                log.previous_status === 'Active'
                                  ? 'bg-green-100 text-green-800'
                                  : log.previous_status === 'Pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {log.previous_status}
                              </span>
                            )}
                            <span className="mx-2">→</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.new_status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : log.new_status === 'Pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {log.new_status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.approved_by ? (
                            <span>Procurement Officer</span>
                          ) : (
                            <span className="text-gray-500">System</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {log.reason || <span className="text-gray-500">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No approval history found</p>
            )}
          </div>
        </>
      )}

      {/* Bids Tab */}
      {activeTab === 'bids' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Vendor Bids</h2>
          {isLoadingBids ? (
            <LoadingSpinner />
          ) : vendorBids && vendorBids.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tender
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bid Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Technical Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendorBids.map((bid) => {
                    // Check if this bid was awarded
                    const isAwarded = bid.tender?.awarded_bid_id === bid.id;
                    
                    return (
                      <tr key={bid.id} className={isAwarded ? "bg-green-50" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium">{bid.tender?.title || 'Unknown Tender'}</span>
                            {isAwarded && (
                              <span className="mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full w-fit">
                                Awarded
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ₹{bid.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            bid.status === 'accepted'
                              ? 'bg-green-100 text-green-800'
                              : bid.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : bid.status === 'under_review'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {bid.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {bid.technical_score !== null ? (
                            <span className="font-medium">{bid.technical_score}%</span>
                          ) : (
                            <span className="text-gray-400">Not evaluated</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(bid.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">This vendor hasn't submitted any bids yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
          {isLoadingPayments ? (
            <LoadingSpinner />
          ) : vendorPayments && vendorPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendorPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono">{payment.id.substring(0, 8)}...</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        ₹{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          payment.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : payment.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {payment.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap capitalize">
                        {payment.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.payment_date 
                          ? new Date(payment.payment_date).toLocaleDateString() 
                          : new Date(payment.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">No payment records found for this vendor.</p>
            </div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Compliance Information</h2>
            <button
              onClick={() => setIsEditingComplianceScore(!isEditingComplianceScore)}
              className="btn btn-primary"
            >
              {isEditingComplianceScore ? 'Cancel' : 'Update Compliance Score'}
            </button>
          </div>
          
          {isEditingComplianceScore ? (
            <form onSubmit={handleComplianceScoreSubmit} className="space-y-4 mb-6">
              <div>
                <label htmlFor="complianceScore" className="block text-sm font-medium text-gray-700">
                  Compliance Score (0-100)
                </label>
                <input
                  type="number"
                  id="complianceScore"
                  min="0"
                  max="100"
                  className="input mt-1"
                  value={complianceScore}
                  onChange={(e) => setComplianceScore(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="complianceType" className="block text-sm font-medium text-gray-700">
                  Update Type
                </label>
                <select
                  id="complianceType"
                  className="input mt-1"
                  value={complianceType}
                  onChange={(e) => setComplianceType(e.target.value)}
                  required
                >
                  <option value="positive">Positive (Improvement)</option>
                  <option value="negative">Negative (Issue)</option>
                  <option value="neutral">Neutral (Regular Update)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="complianceNote" className="block text-sm font-medium text-gray-700">
                  Note
                </label>
                <textarea
                  id="complianceNote"
                  className="input mt-1"
                  rows={3}
                  value={complianceNote}
                  onChange={(e) => setComplianceNote(e.target.value)}
                  placeholder="Explain the reason for this compliance score update"
                  required
                ></textarea>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateComplianceScore.isLoading}
                >
                  {updateComplianceScore.isLoading ? 'Updating...' : 'Update Score'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">Compliance Score</h3>
                <div className="flex items-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    (vendor?.compliance_score || 0) >= 80
                      ? 'bg-green-100 text-green-800'
                      : (vendor?.compliance_score || 0) >= 50
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {vendor?.compliance_score || 0}%
                  </span>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${
                    (vendor?.compliance_score || 0) >= 80
                      ? 'bg-green-600'
                      : (vendor?.compliance_score || 0) >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-600'
                  }`}
                  style={{ width: `${vendor?.compliance_score || 0}%` }}
                ></div>
              </div>
              
              <p className="mt-2 text-sm text-gray-600">
                The compliance score is calculated based on the vendor's performance in previous tenders, document verification, and payment history.
              </p>
            </div>
          )}
          
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance History</h3>
            
            {isLoadingComplianceHistory ? (
              <LoadingSpinner />
            ) : complianceHistory && complianceHistory.length > 0 ? (
              <div className="space-y-4">
                {complianceHistory.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.title || 'Compliance Update'}</h4>
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'positive'
                            ? 'bg-green-100 text-green-800'
                            : item.type === 'negative'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.score_change > 0 ? `+${item.score_change}` : item.score_change}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600">No compliance history available for this vendor.</p>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Guidelines</h3>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Vendor Compliance Criteria</h4>
              <ul className="list-disc pl-5 space-y-1 text-blue-700">
                <li>Document verification and authenticity</li>
                <li>Timely bid submissions and responses</li>
                <li>Quality of delivered goods and services</li>
                <li>Adherence to contract terms and conditions</li>
                <li>Responsiveness to procurement team inquiries</li>
                <li>History of successful project completions</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Log</h2>
          <ActivityLog vendorId={id} />
        </div>
      )}
    </div>
  );
}

export default VendorDetails;