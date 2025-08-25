import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function PendingApproval() {
  const { signOut, user, vendorStatus } = useAuth();

  // Fetch vendor details to show more information
  const { data: vendorDetails, isLoading } = useQuery({
    queryKey: ['vendor-details', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isPending = vendorStatus === 'Pending';
  const isSuspended = vendorStatus === 'Suspended';

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isPending ? 'Account Pending Approval' : 'Account Suspended'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className={`${isPending ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'} border px-4 py-3 rounded mb-4`}>
            {isPending ? (
              'Your vendor account is currently pending approval by a procurement officer.'
            ) : (
              'Your vendor account has been suspended. Please contact the procurement team for more information.'
            )}
          </div>

          {vendorDetails && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Vendor Information</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Business Name</dt>
                  <dd className="text-sm text-gray-900">{vendorDetails.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Business Type</dt>
                  <dd className="text-sm text-gray-900">{vendorDetails.business_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
                  <dd className="text-sm text-gray-900">{vendorDetails.contact_person}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{vendorDetails.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vendorDetails.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : vendorDetails.status === 'Pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {vendorDetails.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="space-y-4">
            {isPending ? (
              <>
                <p className="text-gray-600">
                  Thank you for registering as a vendor with NEEPCO. Your account is currently under review by our procurement team.
                </p>
                
                <p className="text-gray-600">
                  Once your account is approved, you will be able to access the vendor portal, view tenders, and submit bids.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-600">
                  Your account has been suspended. This may be due to compliance issues, incomplete documentation, or other concerns identified by our procurement team.
                </p>
                
                {vendorDetails?.rejection_reason && (
                  <div className="bg-red-50 p-4 rounded-md border border-red-200">
                    <h4 className="text-sm font-medium text-red-800">Reason for Suspension:</h4>
                    <p className="mt-1 text-sm text-red-700">{vendorDetails.rejection_reason}</p>
                  </div>
                )}
              </>
            )}
            
            <p className="text-gray-600">
              If you have any questions or need assistance, please contact our support team at support@neepco.gov.in or call +91-1234567890.
            </p>
            
            <div className="mt-6 flex flex-col space-y-4">
              <button
                onClick={handleSignOut}
                className="w-full btn btn-primary"
              >
                Sign Out
              </button>
              
              <Link
                to="/about"
                className="text-center text-primary-600 hover:text-primary-500"
              >
                Learn more about NEEPCO
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}