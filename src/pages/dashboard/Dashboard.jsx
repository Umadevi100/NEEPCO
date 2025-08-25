import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function Dashboard() {
  const { hasRole, user } = useAuth();
  
  // Only fetch data relevant to the user's role
  const shouldFetchTenders = hasRole('procurement_officer') || hasRole('admin');
  const shouldFetchVendors = hasRole('procurement_officer') || hasRole('admin');
  const shouldFetchPayments = hasRole('procurement_officer') || hasRole('admin') || hasRole('vendor');

  const { data: tenders, isLoading: loadingTenders } = useQuery({
    queryKey: ['tenders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: shouldFetchTenders,
  });

  const { data: vendors, isLoading: loadingVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: shouldFetchVendors,
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          vendors (
            name,
            business_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: shouldFetchPayments,
  });

  const { data: pendingVendors, isLoading: loadingPendingVendors } = useQuery({
    queryKey: ['pending-vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: shouldFetchVendors,
  });

  // For vendors, fetch their bids
  const { data: vendorDetails, isLoading: loadingVendorDetails } = useQuery({
    queryKey: ['vendor-details', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('vendors')
        .select('id, status')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && hasRole('vendor'),
  });

  const { data: vendorBids, isLoading: loadingVendorBids } = useQuery({
    queryKey: ['vendor-bids', vendorDetails?.id],
    queryFn: async () => {
      if (!vendorDetails?.id) return [];
      
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          tenders (
            id,
            title,
            status,
            submission_deadline
          )
        `)
        .eq('vendor_id', vendorDetails.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorDetails?.id && hasRole('vendor'),
  });

  // Fetch notifications for procurement officers
  const { data: notifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('type', 'vendor_approval')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && (hasRole('procurement_officer') || hasRole('admin')),
  });

  const isLoading = 
    (shouldFetchTenders && loadingTenders) || 
    (shouldFetchVendors && loadingVendors) || 
    (shouldFetchPayments && loadingPayments) ||
    (shouldFetchVendors && loadingPendingVendors) ||
    ((hasRole('procurement_officer') || hasRole('admin')) && loadingNotifications) ||
    (hasRole('vendor') && (loadingVendorDetails || loadingVendorBids));

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shouldFetchTenders && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Procurement Overview</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Tenders</dt>
                <dd className="font-semibold">{tenders?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Active Tenders</dt>
                <dd className="font-semibold text-green-600">
                  {tenders?.filter(t => t.status === 'published').length || 0}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {shouldFetchVendors && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendor Overview</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Vendors</dt>
                <dd className="font-semibold">{vendors?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Active Vendors</dt>
                <dd className="font-semibold text-green-600">
                  {vendors?.filter(v => v.status === 'Active').length || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Pending Approval</dt>
                <dd className="font-semibold text-yellow-600">
                  {pendingVendors?.length || 0}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {shouldFetchPayments && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Overview</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Payments</dt>
                <dd className="font-semibold">{payments?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Pending Payments</dt>
                <dd className="font-semibold text-yellow-600">
                  {payments?.filter(p => p.status === 'pending').length || 0}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {hasRole('vendor') && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Bids</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Bids</dt>
                <dd className="font-semibold">{vendorBids?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Accepted Bids</dt>
                <dd className="font-semibold text-green-600">
                  {vendorBids?.filter(b => b.status === 'accepted').length || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Pending Bids</dt>
                <dd className="font-semibold text-yellow-600">
                  {vendorBids?.filter(b => b.status === 'submitted' || b.status === 'under_review').length || 0}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Notification for new vendor approvals */}
      {(hasRole('procurement_officer') || hasRole('admin')) && notifications?.length > 0 && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">New Vendor Approval Requests</h2>
          <p className="text-yellow-800 mb-4">
            You have {notifications.length} new vendor{notifications.length > 1 ? 's' : ''} waiting for approval.
          </p>
          <div className="flex justify-end">
            <Link to="/vendors" className="btn btn-primary">
              Review Vendors
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hasRole('procurement_officer') && (
          <Link
            to="/procurement/create"
            className="card hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-primary-700">
              Create New Tender
            </h3>
            <p className="mt-2 text-gray-600">
              Start a new procurement process
            </p>
          </Link>
        )}

        {hasRole('procurement_officer') && (
          <Link
            to="/vendors"
            className="card hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-primary-700">
              Manage Vendors
            </h3>
            <p className="mt-2 text-gray-600">
              View and manage vendor relationships
            </p>
          </Link>
        )}

        {(hasRole('procurement_officer') || hasRole('vendor')) && (
          <Link
            to="/payments"
            className="card hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-primary-700">
              Process Payments
            </h3>
            <p className="mt-2 text-gray-600">
              Handle vendor payments and invoices
            </p>
          </Link>
        )}

        {hasRole('vendor') && (
          <Link
            to="/tenders"
            className="card hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-primary-700">
              View Available Tenders
            </h3>
            <p className="mt-2 text-gray-600">
              Browse and bid on available tenders
            </p>
          </Link>
        )}

        {hasRole('vendor') && (
          <Link
            to="/profile"
            className="card hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-primary-700">
              Vendor Profile
            </h3>
            <p className="mt-2 text-gray-600">
              Manage your vendor information and view bids
            </p>
          </Link>
        )}
      </div>

      {/* Recent Activity Section for Vendors */}
      {hasRole('vendor') && vendorBids && vendorBids.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Bid Activity</h2>
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
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vendorBids.slice(0, 5).map((bid) => (
                  <tr key={bid.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bid.tenders?.title || 'Unknown Tender'}
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
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {bid.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(bid.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/tenders/${bid.tenders?.id}`}
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
          {vendorBids.length > 5 && (
            <div className="mt-4 text-center">
              <Link to="/profile" className="text-primary-600 hover:text-primary-900">
                View All Bids
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}