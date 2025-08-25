import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function TenderList() {
  const [filterStatus, setFilterStatus] = useState('published');
  const { hasRole, user } = useAuth();
  const isVendor = hasRole('vendor');

  const { data: tenders, isLoading } = useQuery({
    queryKey: ['tenders', filterStatus],
    queryFn: async () => {
      try {
        let query = supabase
          .from('tenders')
          .select(`
            *,
            bids!bids_tender_id_fkey (
              id,
              status,
              amount,
              vendor_id
            )
          `);
        
        // Filter by status if needed
        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching tenders:', error);
        return [];
      }
    },
  });

  // Get vendor details if user is a vendor
  const { data: vendorDetails } = useQuery({
    queryKey: ['vendor-details', user?.id],
    queryFn: async () => {
      if (!isVendor || !user?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id, status')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching vendor details:', error);
        return null;
      }
    },
    enabled: isVendor && !!user?.id,
  });

  // Check if vendor has already submitted bids for tenders
  const hasBidForTender = (tenderId) => {
    if (!tenders || !vendorDetails) return false;
    
    const tender = tenders.find(t => t.id === tenderId);
    if (!tender) return false;
    
    return tender.bids.some(bid => bid.vendor_id === vendorDetails.id);
  };

  // Check if vendor's bid was awarded for a tender
  const isAwardedBid = (tenderId) => {
    if (!tenders || !vendorDetails) return false;
    
    const tender = tenders.find(t => t.id === tenderId);
    if (!tender || !tender.awarded_bid_id) return false;
    
    return tender.bids.some(bid => 
      bid.vendor_id === vendorDetails.id && 
      bid.id === tender.awarded_bid_id
    );
  };

  // Get bid status for a tender
  const getBidStatus = (tenderId) => {
    if (!tenders || !vendorDetails) return 'Not Submitted';
    
    const tender = tenders.find(t => t.id === tenderId);
    if (!tender) return 'Not Submitted';
    
    const vendorBid = tender.bids.find(bid => bid.vendor_id === vendorDetails.id);
    if (!vendorBid) return 'Not Submitted';

    if (isAwardedBid(tenderId)) return 'Awarded';
    
    switch (tender.status) {
      case 'under_review':
        return 'Under Review';
      case 'awarded':
        return 'Not Awarded';
      default:
        return vendorBid.status.charAt(0).toUpperCase() + vendorBid.status.slice(1);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Available Tenders</h1>
        <div className="flex space-x-2">
          <button 
            className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button 
            className={`btn ${filterStatus === 'published' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('published')}
          >
            Published
          </button>
          <button 
            className={`btn ${filterStatus === 'under_review' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('under_review')}
          >
            Under Review
          </button>
          <button 
            className={`btn ${filterStatus === 'awarded' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('awarded')}
          >
            Awarded
          </button>
        </div>
      </div>

      {vendorDetails?.status !== 'Active' && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">Account Not Active</h2>
          <p className="text-yellow-800">
            Your vendor account must be approved before you can submit bids. You can view available tenders, but you cannot submit bids until your account is approved.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {filterStatus === 'all' ? 'All Tenders' : 
           filterStatus === 'published' ? 'Published Tenders' :
           filterStatus === 'under_review' ? 'Tenders Under Review' :
           'Awarded Tenders'}
        </h2>
        
        {tenders && tenders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estimated Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission Deadline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bid Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenders.map((tender) => {
                  // Check if deadline has passed
                  const isDeadlinePassed = new Date(tender.submission_deadline) < new Date();
                  
                  // Check if vendor has already submitted a bid
                  const hasBid = hasBidForTender(tender.id);
                  
                  // Check if vendor's bid was awarded
                  const isAwarded = isAwardedBid(tender.id);
                  
                  // Get bid status
                  const bidStatus = getBidStatus(tender.id);
                  
                  // Check if vendor can submit a bid
                  const canBid = vendorDetails?.status === 'Active' && 
                                tender.status === 'published' && 
                                !isDeadlinePassed && 
                                !hasBid;
                  
                  return (
                    <tr key={tender.id} className={isAwarded ? "bg-green-50" : ""}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{tender.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {tender.description}
                        </div>
                        {tender.is_reserved_for_mse && (
                          <span className="mt-1 inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            MSE Only
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{tender.estimated_value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(tender.submission_deadline), 'PPp')}
                        {isDeadlinePassed && (
                          <span className="ml-2 text-xs text-red-600">(Passed)</span>
                        )}
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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          bidStatus === 'Awarded'
                            ? 'bg-green-100 text-green-800'
                            : bidStatus === 'Under Review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : bidStatus === 'Not Awarded'
                            ? 'bg-red-100 text-red-800'
                            : bidStatus === 'Submitted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {bidStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/tenders/${tender.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {filterStatus === 'all' 
              ? 'No tenders found.'
              : `No ${filterStatus.replace('_', ' ')} tenders found.`}
          </div>
        )}
      </div>

      <div className="card bg-blue-50">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Tender Status Guide</h2>
        <div className="prose max-w-none text-blue-800">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Published:</strong> Open for bidding. You can submit your bid if the deadline hasn't passed.</li>
            <li><strong>Under Review:</strong> Bidding is closed. The procurement team is evaluating all submitted bids.</li>
            <li><strong>Awarded:</strong> The tender has been awarded to a vendor. Check your bid status to see if you were selected.</li>
          </ul>
          <p className="mt-4">
            <strong>Note:</strong> You can only submit bids for tenders with "Published" status and before the submission deadline.
          </p>
        </div>
      </div>
    </div>
  );
}