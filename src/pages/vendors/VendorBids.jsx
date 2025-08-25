import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

export default function VendorBids({ vendorId }) {
  const { user } = useAuth();
  
  // Get vendor details if vendorId is not provided
  const { data: vendorDetails, isLoading: isLoadingVendor } = useQuery({
    queryKey: ['vendor-details-for-bids', user?.id],
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

  const { data: bids, isLoading: isLoadingBids } = useQuery({
    queryKey: ['vendor-bids', effectiveVendorId],
    queryFn: async () => {
      if (!effectiveVendorId) return [];
      
      try {
        // Use explicit aliasing to avoid ambiguity
        const { data, error } = await supabase
          .from('bids')
          .select(`
            id,
            amount,
            status,
            technical_score,
            notes,
            created_at,
            updated_at,
            tender:tender_id (
              id,
              title,
              status,
              submission_deadline,
              estimated_value,
              awarded_bid_id
            )
          `)
          .eq('vendor_id', effectiveVendorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendor bids:', error);
        return [];
      }
    },
    enabled: !!effectiveVendorId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const isLoading = isLoadingVendor || isLoadingBids;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!effectiveVendorId) {
    return (
      <div className="bg-yellow-50 p-6 rounded-lg text-center">
        <p className="text-yellow-600">Unable to find vendor information. Please contact support.</p>
      </div>
    );
  }

  if (!bids || bids.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-600">You haven't submitted any bids yet.</p>
        <Link to="/tenders" className="mt-4 inline-block text-primary-600 hover:text-primary-800">
          Browse Available Tenders
        </Link>
      </div>
    );
  }

  return (
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
              Tender Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Bid Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Technical Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Submitted At
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {bids.map((bid) => {
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
                    bid.tender?.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : bid.tender?.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : bid.tender?.status === 'under_review'
                      ? 'bg-yellow-100 text-yellow-800'
                      : bid.tender?.status === 'awarded'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {bid.tender?.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
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
                    {isAwarded && bid.status === 'accepted' && (
                      <span className="mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full w-fit">
                        AWARDED
                      </span>
                    )}
                    {bid.status === 'rejected' && bid.notes && (
                      <div className="mt-1 text-xs text-red-600">
                        Reason: {bid.notes}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {bid.technical_score !== null ? (
                    <span className="font-medium">{bid.technical_score}%</span>
                  ) : (
                    <span className="text-gray-400">Not evaluated</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {format(new Date(bid.created_at), 'PPp')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    to={`/tenders/${bid.tender?.id}`}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    View Tender
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}