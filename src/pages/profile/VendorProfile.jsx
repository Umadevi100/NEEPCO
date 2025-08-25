import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import VendorBids from '../../components/vendors/VendorBids';
import ActivityLog from '../../components/vendors/ActivityLog';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function VendorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditingBankDetails, setIsEditingBankDetails] = useState(false);

  // First get the user profile from profiles table
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Then get the vendor details
  const { data: vendorDetails, isLoading: isLoadingVendor } = useQuery({
    queryKey: ['vendor-details', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle instead of single to handle no results

        if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows returned" error
        return data;
      } catch (error) {
        console.error('Error fetching vendor details:', error);
        return null;
      }
    },
    enabled: !!user,
  });

  // Get all bids for this vendor
  const { data: vendorBids, isLoading: isLoadingBids } = useQuery({
    queryKey: ['vendor-bids-count', vendorDetails?.id],
    queryFn: async () => {
      if (!vendorDetails?.id) return [];
      
      try {
        const { data, error } = await supabase
          .from('bids')
          .select('id', { count: 'exact' })
          .eq('vendor_id', vendorDetails.id);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendor bids count:', error);
        return [];
      }
    },
    enabled: !!vendorDetails?.id,
  });

  // Get awarded tenders for this vendor
  const { data: awardedTenders, isLoading: isLoadingAwardedTenders } = useQuery({
    queryKey: ['vendor-awarded-tenders', vendorDetails?.id],
    queryFn: async () => {
      if (!vendorDetails?.id) return [];
      
      try {
        // First get all bids by this vendor that were accepted
        const { data: acceptedBids, error: bidsError } = await supabase
          .from('bids')
          .select('id, tender_id, amount, technical_score, notes, status')
          .eq('vendor_id', vendorDetails.id)
          .eq('status', 'accepted');
          
        if (bidsError) throw bidsError;
        
        if (!acceptedBids || acceptedBids.length === 0) return [];
        
        // Get all tenders that have awarded_bid_id matching any of these bids
        const bidIds = acceptedBids.map(bid => bid.id);
        const tenderIds = acceptedBids.map(bid => bid.tender_id);
        
        const { data: tenders, error: tendersError } = await supabase
          .from('tenders')
          .select('*, awarded_bid_id')
          .in('id', tenderIds)
          .eq('status', 'awarded');
          
        if (tendersError) throw tendersError;
        
        // Combine tender data with bid data
        return (tenders || []).map(tender => {
          const matchingBid = acceptedBids.find(bid => bid.tender_id === tender.id);
          return {
            ...tender,
            bid: matchingBid
          };
        });
      } catch (error) {
        console.error('Error fetching awarded tenders:', error);
        return [];
      }
    },
    enabled: !!vendorDetails?.id,
  });

  // Get approval history - handle the case where the relationship might not exist yet
  const { data: approvalHistory, isLoading: isLoadingApprovalHistory } = useQuery({
    queryKey: ['vendor-approval-history', vendorDetails?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_approval_logs')
          .select('*')
          .eq('vendor_id', vendorDetails.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching approval history:', error);
        return [];
      }
    },
    enabled: !!vendorDetails?.id,
  });

  // Get payments for this vendor
  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['vendor-payments', vendorDetails?.id],
    queryFn: async () => {
      if (!vendorDetails?.id) return [];
      
      try {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            *,
            related_tender (
              id,
              title
            )
          `)
          .eq('vendor_id', vendorDetails.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendor payments:', error);
        return [];
      }
    },
    enabled: !!vendorDetails?.id,
  });

  // Get pending payments count
  const pendingPaymentsCount = payments?.filter(p => p.status === 'pending').length || 0;

  // Get compliance history for this vendor
  const { data: complianceHistory, isLoading: isLoadingComplianceHistory } = useQuery({
    queryKey: ['vendor-compliance-history', vendorDetails?.id],
    queryFn: async () => {
      if (!vendorDetails?.id) return [];
      
      try {
        // If compliance_history exists in vendor details, use it
        if (vendorDetails.compliance_history && Array.isArray(vendorDetails.compliance_history)) {
          return vendorDetails.compliance_history;
        }
        
        // Otherwise return empty array
        return [];
      } catch (error) {
        console.error('Error fetching compliance history:', error);
        return [];
      }
    },
    enabled: !!vendorDetails?.id,
  });

  const updateVendor = useMutation({
    mutationFn: async (updates) => {
      if (!vendorDetails?.id) throw new Error('Vendor profile not found');

      const { data, error } = await supabase
        .from('vendors')
        .update(updates)
        .eq('id', vendorDetails.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vendor-details', user?.id]);
      setIsEditing(false);
      setIsEditingBankDetails(false);
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    updateVendor.mutate({
      contact_person: formData.get('contactPerson'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    });
  };

  const handleBankDetailsSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const bankDetails = {
      accountName: formData.get('accountName'),
      accountNumber: formData.get('accountNumber'),
      bankName: formData.get('bankName'),
      ifscCode: formData.get('ifscCode')
    };
    
    updateVendor.mutate({
      bank_details: bankDetails
    });
  };

  if (isLoadingProfile || isLoadingVendor) {
    return <LoadingSpinner />;
  }

  // If no vendor profile exists, show a message directing the user to contact support
  if (!vendorDetails) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Vendor Profile Not Found</h1>
        </div>

        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">Profile Information Missing</h2>
          <p className="text-yellow-800 mb-4">
            Your vendor profile information appears to be missing. This could happen if there was an issue during the signup process.
          </p>
          <p className="text-yellow-800 mb-4">
            Please contact the procurement team at support@neepco.gov.in for assistance with completing your vendor profile setup.
          </p>
          <p className="text-yellow-800">
            Include your account email and any relevant details in your message to help us resolve this issue quickly.
          </p>
        </div>
      </div>
    );
  }

  // If vendor profile exists
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Vendor Profile</h1>
        <div className="flex space-x-2">
          {vendorDetails?.status === 'Active' && activeTab === 'profile' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-primary"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          )}
        </div>
      </div>

      {/* Pending Payments Alert */}
      {pendingPaymentsCount > 0 && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-yellow-900">Pending Payments</h2>
              <p className="text-yellow-800 mt-1">
                You have {pendingPaymentsCount} pending payment{pendingPaymentsCount > 1 ? 's' : ''} that require your attention.
              </p>
            </div>
            <Link to="/payments?filter=pending" className="btn btn-primary">
              View Payments
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Profile
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
            onClick={() => setActiveTab('awarded')}
            className={`${
              activeTab === 'awarded'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
          >
            Awarded Tenders
            {awardedTenders && awardedTenders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {awardedTenders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`${
              activeTab === 'payments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
          >
            Payments
            {pendingPaymentsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingPaymentsCount}
              </span>
            )}
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

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
            
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Business Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      defaultValue={vendorDetails?.name || ''}
                      className="input mt-1"
                      disabled
                    />
                    <p className="mt-1 text-sm text-gray-500">Business name cannot be changed</p>
                  </div>
                  
                  <div>
                    <label htmlFor="business_type" className="block text-sm font-medium text-gray-700">
                      Business Type
                    </label>
                    <input
                      type="text"
                      id="business_type"
                      name="business_type"
                      defaultValue={vendorDetails?.business_type || ''}
                      className="input mt-1"
                      disabled
                    />
                    <p className="mt-1 text-sm text-gray-500">Business type cannot be changed</p>
                  </div>
                  
                  <div>
                    <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      id="contactPerson"
                      name="contactPerson"
                      defaultValue={vendorDetails?.contact_person || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      defaultValue={vendorDetails?.email || ''}
                      className="input mt-1"
                      disabled
                    />
                    <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      defaultValue={vendorDetails?.phone || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                      Business Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      defaultValue={vendorDetails?.address || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updateVendor.isLoading}
                    className="btn btn-primary"
                  >
                    {updateVendor.isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Business Name</p>
                  <p className="mt-1 text-lg text-gray-900">{vendorDetails?.name || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Business Type</p>
                  <p className="mt-1">
                    {vendorDetails?.business_type && (
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                        vendorDetails.business_type === 'MSE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {vendorDetails.business_type}
                      </span>
                    )}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Contact Person</p>
                  <p className="mt-1 text-lg text-gray-900">{vendorDetails?.contact_person || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="mt-1 text-lg text-gray-900">{vendorDetails?.email || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="mt-1 text-lg text-gray-900">{vendorDetails?.phone || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="mt-1 text-lg text-gray-900">{vendorDetails?.address || 'N/A'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="mt-1">
                    {vendorDetails?.status && (
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                        vendorDetails.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : vendorDetails.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {vendorDetails.status}
                      </span>
                    )}
                  </p>
                </div>
                
                {vendorDetails?.business_type === 'MSE' && vendorDetails?.mse_certificate && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">MSE Certificate</p>
                    <p className="mt-1 text-lg text-gray-900">{vendorDetails.mse_certificate}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bank Details Section */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Bank Details</h2>
              {vendorDetails?.status === 'Active' && (
                <button
                  onClick={() => setIsEditingBankDetails(!isEditingBankDetails)}
                  className="btn btn-secondary"
                >
                  {isEditingBankDetails ? 'Cancel' : 'Edit Bank Details'}
                </button>
              )}
            </div>
            
            {isEditingBankDetails ? (
              <form onSubmit={handleBankDetailsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="accountName" className="block text-sm font-medium text-gray-700">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      id="accountName"
                      name="accountName"
                      defaultValue={vendorDetails?.bank_details?.accountName || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">
                      Account Number
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      name="accountNumber"
                      defaultValue={vendorDetails?.bank_details?.accountNumber || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      id="bankName"
                      name="bankName"
                      defaultValue={vendorDetails?.bank_details?.bankName || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-700">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      id="ifscCode"
                      name="ifscCode"
                      defaultValue={vendorDetails?.bank_details?.ifscCode || ''}
                      className="input mt-1"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updateVendor.isLoading}
                    className="btn btn-primary"
                  >
                    {updateVendor.isLoading ? 'Saving...' : 'Save Bank Details'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {vendorDetails?.bank_details && 
                 (vendorDetails.bank_details.accountName || 
                  vendorDetails.bank_details.accountNumber || 
                  vendorDetails.bank_details.bankName) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Account Holder Name</p>
                      <p className="mt-1 text-lg text-gray-900">{vendorDetails.bank_details.accountName || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Account Number</p>
                      <p className="mt-1 text-lg text-gray-900">
                        {vendorDetails.bank_details.accountNumber ? 
                          `XXXX-XXXX-${vendorDetails.bank_details.accountNumber.slice(-4)}` : 
                          'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Bank Name</p>
                      <p className="mt-1 text-lg text-gray-900">{vendorDetails.bank_details.bankName || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">IFSC Code</p>
                      <p className="mt-1 text-lg text-gray-900">{vendorDetails.bank_details.ifscCode || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600">No bank details have been added yet.</p>
                    {vendorDetails?.status === 'Active' && (
                      <button
                        onClick={() => setIsEditingBankDetails(true)}
                        className="mt-2 text-primary-600 hover:text-primary-800"
                      >
                        Add Bank Details
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            
            {vendorDetails?.documents && vendorDetails.documents.length > 0 ? (
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendorDetails.documents.map((doc, index) => (
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
                            {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'PP') : 'N/A'}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600">No documents have been uploaded yet.</p>
              </div>
            )}
          </div>

          {vendorDetails?.status === 'Pending' && (
            <div className="card bg-yellow-50">
              <h2 className="text-xl font-semibold text-yellow-900 mb-4">Pending Approval</h2>
              <p className="text-yellow-800">
                Your vendor profile is currently pending approval by a procurement officer. 
                You will be notified once your account is approved.
              </p>
            </div>
          )}

          {vendorDetails?.status === 'Suspended' && (
            <div className="card bg-red-50">
              <h2 className="text-xl font-semibold text-red-900 mb-4">Account Suspended</h2>
              <p className="text-red-800 mb-4">
                Your vendor account has been suspended. Please contact the procurement team for more information.
              </p>
              {vendorDetails?.rejection_reason && (
                <div className="bg-white p-4 rounded-md border border-red-200">
                  <h3 className="font-medium text-gray-900 mb-2">Suspension Reason</h3>
                  <p className="text-gray-700">{vendorDetails.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Approval History */}
          {approvalHistory && approvalHistory.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Approval History</h2>
              <div className="space-y-4">
                {approvalHistory.map((log, index) => (
                  <div key={log.id} className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        log.new_status === 'Active' 
                          ? 'bg-green-100 text-green-600' 
                          : log.new_status === 'Suspended'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <span className="font-medium">
                          {log.new_status === 'Active' 
                            ? 'Account Approved' 
                            : log.new_status === 'Suspended'
                            ? 'Account Suspended'
                            : 'Status Changed'}
                        </span>
                        <span className="mx-2">•</span>
                        <span className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        By: {log.approved_by ? 'Procurement Officer' : 'System'}
                      </p>
                      {log.reason && (
                        <p className="mt-1 text-sm text-gray-700">
                          Reason: {log.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Bids Tab */}
      {activeTab === 'bids' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Bids</h2>
          {isLoadingBids ? (
            <LoadingSpinner />
          ) : (
            <VendorBids vendorId={vendorDetails.id} />
          )}
        </div>
      )}

      {/* Awarded Tenders Tab */}
      {activeTab === 'awarded' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Awarded Tenders</h2>
          {isLoadingAwardedTenders ? (
            <LoadingSpinner />
          ) : awardedTenders && awardedTenders.length > 0 ? (
            <div className="space-y-6">
              {awardedTenders.map((tender) => (
                <div key={tender.id} className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-green-800">{tender.title}</h3>
                      <div className="mt-2 text-green-700">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100">
                          AWARDED
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-700">Estimated Value</p>
                      <p className="text-xl font-bold text-green-800">₹{tender.estimated_value.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-green-700">Your Winning Bid</p>
                      <p className="text-lg font-semibold text-green-800">₹{tender.bid?.amount.toLocaleString()}</p>
                    </div>
                    
                    {tender.bid?.technical_score !== null && (
                      <div>
                        <p className="text-sm font-medium text-green-700">Technical Score</p>
                        <p className="text-lg font-semibold text-green-800">{tender.bid.technical_score}%</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm font-medium text-green-700">Category</p>
                      <p className="text-lg text-green-800 capitalize">{tender.category || 'Goods'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-green-700">Award Date</p>
                      <p className="text-lg text-green-800">{format(new Date(tender.updated_at), 'PPp')}</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <Link
                      to={`/tenders/${tender.id}`}
                      className="btn btn-primary"
                    >
                      View Tender Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">You don't have any awarded tenders yet.</p>
              <Link to="/tenders" className="mt-4 inline-block text-primary-600 hover:text-primary-800">
                Browse Available Tenders
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Payment History</h2>
            <Link to="/payments" className="btn btn-primary">
              View All Payments
            </Link>
          </div>
          
          {isLoadingPayments ? (
            <LoadingSpinner />
          ) : payments && payments.length > 0 ? (
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
                      Related Tender
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.related_tender ? (
                          <Link 
                            to={`/tenders/${payment.related_tender.id}`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            {payment.related_tender.title}
                          </Link>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.payment_date 
                          ? format(new Date(payment.payment_date), 'PP') 
                          : format(new Date(payment.created_at), 'PP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <Link
                            to={`/payments/${payment.id}`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View Details
                          </Link>
                          {payment.status === 'pending' && (
                            <Link
                              to={`/payments/${payment.id}`}
                              className="text-green-600 hover:text-green-900 font-medium"
                            >
                              Pay Now
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">No payment records found.</p>
            </div>
          )}
          
          {pendingPaymentsCount > 0 && (
            <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-medium text-yellow-800 mb-2">Pending Payments</h3>
              <p className="text-yellow-700">
                You have {pendingPaymentsCount} pending payment{pendingPaymentsCount > 1 ? 's' : ''} that require your attention. 
                Please process these payments to avoid any delays in your business relationship with NEEPCO.
              </p>
              <div className="mt-4 flex justify-end">
                <Link to="/payments?filter=pending" className="btn btn-primary">
                  View Pending Payments
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Compliance Information</h2>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-gray-900">Compliance Score</h3>
              <div className="flex items-center">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  (vendorDetails?.compliance_score || 0) >= 80
                    ? 'bg-green-100 text-green-800'
                    : (vendorDetails?.compliance_score || 0) >= 50
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {vendorDetails?.compliance_score || 0}%
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${
                  (vendorDetails?.compliance_score || 0) >= 80
                    ? 'bg-green-600'
                    : (vendorDetails?.compliance_score || 0) >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-600'
                }`}
                style={{ width: `${vendorDetails?.compliance_score || 0}%` }}
              ></div>
            </div>
            
            <p className="mt-2 text-sm text-gray-600">
              Your compliance score is calculated based on your performance in previous tenders, document verification, and payment history.
            </p>
          </div>
          
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
                          {item.date ? format(new Date(item.date), 'PP') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-600">No compliance history available.</p>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Requirements</h3>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">How to Maintain Good Compliance</h4>
              <ul className="list-disc pl-5 space-y-1 text-blue-700">
                <li>Submit all required documents for verification</li>
                <li>Maintain high quality standards in all deliverables</li>
                <li>Complete projects within the agreed timeframe</li>
                <li>Respond promptly to procurement officer inquiries</li>
                <li>Adhere to all terms and conditions in tender agreements</li>
                <li>Process payments promptly when required</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Log</h2>
          <ActivityLog vendorId={vendorDetails.id} />
        </div>
      )}
    </div>
  );
}