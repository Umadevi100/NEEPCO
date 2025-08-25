import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function ProcurementOfficerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['officer-profile', user?.id],
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

  const { data: tenders, isLoading: isLoadingTenders } = useQuery({
    queryKey: ['officer-tenders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenders')
        .select(`
          *,
          bids!bids_tender_id_fkey (
            id,
            status,
            amount
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: actionLogs, isLoading: isLoadingActionLogs } = useQuery({
    queryKey: ['officer-action-logs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingVendors, isLoading: isLoadingPendingVendors } = useQuery({
    queryKey: ['pending-vendors-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id', { count: 'exact' })
        .eq('status', 'Pending');

      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Get all vendors approved by this officer
  const { data: approvedVendors, isLoading: isLoadingApprovedVendors } = useQuery({
    queryKey: ['approved-vendors', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('approved_by', user.id)
        .order('approved_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Get all vendor approval logs created by this officer
  const { data: vendorApprovalLogs, isLoading: isLoadingVendorApprovalLogs } = useQuery({
    queryKey: ['vendor-approval-logs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_approval_logs')
        .select(`
          *,
          vendors (
            name,
            business_type
          )
        `)
        .eq('approved_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['officer-profile', user?.id]);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    updateProfile.mutate({
      first_name: formData.get('firstName'),
      last_name: formData.get('lastName'),
      department: formData.get('department'),
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Calculate statistics
  const totalTenders = tenders?.length || 0;
  const activeTenders = tenders?.filter(t => t.status === 'published').length || 0;
  const underReview = tenders?.filter(t => t.status === 'under_review').length || 0;
  const awarded = tenders?.filter(t => t.status === 'awarded').length || 0;
  const totalBids = tenders?.reduce((acc, tender) => acc + tender.bids.length, 0) || 0;
  const totalValue = tenders?.reduce((acc, tender) => acc + tender.estimated_value, 0) || 0;
  const totalApprovedVendors = approvedVendors?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Procurement Officer Profile</h1>
        <div className="flex space-x-2">
          {activeTab === 'profile' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-primary"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          )}
        </div>
      </div>

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
            onClick={() => setActiveTab('tenders')}
            className={`${
              activeTab === 'tenders'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            My Tenders
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`${
              activeTab === 'vendors'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Vendor Approvals
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
          <button
            onClick={() => setActiveTab('stats')}
            className={`${
              activeTab === 'stats'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Statistics
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Officer Information</h2>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    name="firstName"
                    defaultValue={profile.first_name}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    name="lastName"
                    defaultValue={profile.last_name}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <input
                    name="department"
                    defaultValue={profile.department}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    name="email"
                    defaultValue={user.email}
                    className="input mt-1"
                    disabled
                  />
                  <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <input
                    name="role"
                    defaultValue={profile.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    className="input mt-1"
                    disabled
                  />
                  <p className="mt-1 text-sm text-gray-500">Role cannot be changed</p>
                </div>
                {profile.employee_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                    <input
                      name="employeeId"
                      defaultValue={profile.employee_id}
                      className="input mt-1"
                      disabled
                    />
                    <p className="mt-1 text-sm text-gray-500">Employee ID cannot be changed</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProfile.isLoading}
                  className="btn btn-primary"
                >
                  {updateProfile.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="mt-1 text-lg text-gray-900">
                  {profile.first_name} {profile.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="mt-1 text-lg text-gray-900">{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Department</p>
                <p className="mt-1 text-lg text-gray-900">{profile.department || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Role</p>
                <p className="mt-1">
                  <span className="px-2 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {profile.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Procurement Officer'}
                  </span>
                </p>
              </div>
              {profile.employee_id && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Employee ID</p>
                  <p className="mt-1 text-lg text-gray-900">{profile.employee_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Account Created</p>
                <p className="mt-1 text-lg text-gray-900">
                  {profile.created_at ? format(new Date(profile.created_at), 'PPp') : 'Unknown'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tenders Tab */}
      {activeTab === 'tenders' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">My Tenders</h2>
            <Link to="/procurement" className="btn btn-primary">
              Manage Tenders
            </Link>
          </div>
          
          {isLoadingTenders ? (
            <LoadingSpinner />
          ) : tenders && tenders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tender Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estimated Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bids
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tenders.map((tender) => (
                    <tr key={tender.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tender.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tender.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : tender.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : tender.status === 'under_review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : tender.status === 'awarded'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tender.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{tender.estimated_value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tender.bids.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(tender.created_at), 'PP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/procurement/${tender.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">You haven't created any tenders yet.</p>
              <Link to="/procurement" className="mt-4 inline-block text-primary-600 hover:text-primary-800">
                Create Your First Tender
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Vendor Approvals</h2>
            <Link to="/vendors" className="btn btn-primary">
              Manage Vendors
            </Link>
          </div>
          
          {isLoadingApprovedVendors || isLoadingVendorApprovalLogs ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Approval Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Total Vendors Approved</p>
                    <p className="text-2xl font-bold text-primary-600">{totalApprovedVendors}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Pending Approvals</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingVendors}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Recent Approvals</p>
                    <p className="text-2xl font-bold text-green-600">
                      {vendorApprovalLogs?.filter(log => log.new_status === 'Active' && new Date(log.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length || 0}
                    </p>
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Approval Actions</h3>
              {vendorApprovalLogs && vendorApprovalLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vendor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status Change
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendorApprovalLogs.slice(0, 10).map((log) => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium">{log.vendors?.name || 'Unknown Vendor'}</span>
                              {log.vendors?.business_type && (
                                <span className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                                  log.vendors.business_type === 'MSE'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {log.vendors.business_type}
                                </span>
                              )}
                            </div>
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
                            {format(new Date(log.created_at), 'PPp')}
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
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <p className="text-gray-600">No vendor approval actions found.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Log</h2>
          {isLoadingActionLogs ? (
            <LoadingSpinner />
          ) : actionLogs && actionLogs.length > 0 ? (
            <div className="space-y-4">
              {actionLogs.map((log) => (
                <div key={log.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        log.action_type === 'status_change' 
                          ? 'bg-blue-100 text-blue-600' 
                          : log.action_type === 'technical_score_update'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {log.action_type === 'status_change' 
                          ? `${log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)} Status Changed` 
                          : log.action_type === 'technical_score_update'
                          ? 'Technical Score Updated'
                          : 'Action Performed'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {log.action_type === 'status_change' && log.entity_type === 'tender' && (
                          <>Tender "{log.details.tender_title}" status changed from {log.details.previous_status.replace('_', ' ')} to {log.details.new_status.replace('_', ' ')}</>
                        )}
                        {log.action_type === 'status_change' && log.entity_type === 'bid' && (
                          <>Bid for "{log.details.tender_title}" status changed from {log.details.previous_status.replace('_', ' ')} to {log.details.new_status.replace('_', ' ')}</>
                        )}
                        {log.action_type === 'technical_score_update' && (
                          <>Technical score for bid on "{log.details.tender_title}" updated to {log.details.new_score}%</>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {format(new Date(log.created_at), 'PPp')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">No activity logs found.</p>
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="font-medium text-gray-900">Active Tenders</h3>
              <p className="mt-2 text-2xl font-bold text-primary-600">{activeTenders}</p>
              <p className="mt-1 text-sm text-gray-500">out of {totalTenders} total</p>
            </div>
            <div className="card">
              <h3 className="font-medium text-gray-900">Under Review</h3>
              <p className="mt-2 text-2xl font-bold text-yellow-600">{underReview}</p>
              <p className="mt-1 text-sm text-gray-500">pending evaluation</p>
            </div>
            <div className="card">
              <h3 className="font-medium text-gray-900">Awarded</h3>
              <p className="mt-2 text-2xl font-bold text-green-600">{awarded}</p>
              <p className="mt-1 text-sm text-gray-500">successfully completed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="font-medium text-gray-900">Total Bids Received</h3>
              <p className="mt-2 text-2xl font-bold text-blue-600">{totalBids}</p>
              <p className="mt-1 text-sm text-gray-500">across all tenders</p>
            </div>
            <div className="card">
              <h3 className="font-medium text-gray-900">Total Value Managed</h3>
              <p className="mt-2 text-2xl font-bold text-indigo-600">
                ₹{totalValue.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-gray-500">estimated tender value</p>
            </div>
            <div className="card">
              <h3 className="font-medium text-gray-900">Vendors Approved</h3>
              <p className="mt-2 text-2xl font-bold text-green-600">{totalApprovedVendors}</p>
              <div className="mt-1">
                {pendingVendors > 0 && (
                  <Link to="/vendors" className="text-sm text-primary-600 hover:text-primary-800">
                    {pendingVendors} pending approval{pendingVendors > 1 ? 's' : ''}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tender Success Rate</h3>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">
                        {totalTenders > 0 ? Math.round((awarded / totalTenders) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-green-600">
                        {awarded} / {totalTenders} tenders awarded
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-green-200">
                    <div style={{ width: `${totalTenders > 0 ? (awarded / totalTenders) * 100 : 0}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"></div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Bid Conversion Rate</h3>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                        {totalBids > 0 ? Math.round((awarded / totalBids) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-blue-600">
                        {awarded} / {totalBids} bids converted
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                    <div style={{ width: `${totalBids > 0 ? (awarded / totalBids) * 100 : 0}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}