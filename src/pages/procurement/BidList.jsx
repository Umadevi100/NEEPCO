import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

export default function BidList({ tenderId, tenderStatus }) {
  const { hasRole, user } = useAuth();
  const queryClient = useQueryClient();
  const isProcurementOfficer = hasRole('procurement_officer') || hasRole('admin');
  const [selectedBid, setSelectedBid] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showTechnicalScoreModal, setShowTechnicalScoreModal] = useState(false);
  const [technicalScore, setTechnicalScore] = useState(0);

  const { data: bids, isLoading } = useQuery({
    queryKey: ['bids', tenderId],
    queryFn: async () => {
      if (!tenderId) return [];
      
      try {
        const { data, error } = await supabase
          .from('bids')
          .select(`
            *,
            vendors (
              id,
              name,
              business_type,
              compliance_score
            )
          `)
          .eq('tender_id', tenderId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching bids:', error);
        toast.error('Failed to load bids');
        return [];
      }
    },
    enabled: !!tenderId,
  });

  // Get the awarded bid ID for this tender
  const { data: tender } = useQuery({
    queryKey: ['tender-awarded-bid', tenderId],
    queryFn: async () => {
      if (!tenderId) return null;
      
      try {
        const { data, error } = await supabase
          .from('tenders')
          .select('awarded_bid_id')
          .eq('id', tenderId)
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching tender awarded bid:', error);
        return null;
      }
    },
    enabled: !!tenderId,
  });

  const updateBidStatus = useMutation({
    mutationFn: async ({ bidId, status, reason = null, technicalScore = null }) => {
      if (!bidId) {
        throw new Error('Bid ID is required');
      }
      
      const updates = { 
        status,
        evaluated_by: isProcurementOfficer ? user.id : null,
        evaluated_at: new Date().toISOString()
      };
      
      if (reason && status === 'rejected') {
        updates.notes = reason;
      }
      
      if (technicalScore !== null) {
        updates.technical_score = technicalScore;
      }
      
      const { data, error } = await supabase
        .from('bids')
        .update(updates)
        .eq('id', bidId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bids', tenderId]);
      queryClient.invalidateQueries(['tenders', tenderId]);
      
      // Reset state
      setRejectionReason('');
      setShowReasonModal(false);
      setSelectedBid(null);
      setShowTechnicalScoreModal(false);
      setTechnicalScore(0);
      
      toast.success('Bid status updated successfully');
    },
    onError: (error) => {
      console.error('Error updating bid status:', error);
      toast.error(error.message || 'Failed to update bid status');
      setShowReasonModal(false);
      setSelectedBid(null);
      setShowTechnicalScoreModal(false);
    }
  });

  const updateTenderStatus = useMutation({
    mutationFn: async ({ status, awardedBidId = null }) => {
      const updates = { status };
      
      // If we're awarding the tender, store the awarded bid ID
      if (status === 'awarded' && awardedBidId) {
        updates.awarded_bid_id = awardedBidId;
      }
      
      const { data, error } = await supabase
        .from('tenders')
        .update(updates)
        .eq('id', tenderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenders', tenderId]);
      queryClient.invalidateQueries(['tenders']);
    },
    onError: (error) => {
      console.error('Error updating tender status:', error);
      toast.error(error.message || 'Failed to update tender status');
    }
  });

  const handleBidStatusUpdate = (bidId, newStatus) => {
    if (newStatus === 'rejected') {
      setSelectedBid(bidId);
      setShowReasonModal(true);
    } else if (newStatus === 'under_review') {
      setSelectedBid(bidId);
      setShowTechnicalScoreModal(true);
    } else {
      updateBidStatus.mutate({ bidId, status: newStatus });
      
      // If accepting a bid, also update the tender status to awarded
      if (newStatus === 'accepted') {
        updateTenderStatus.mutate({ 
          status: 'awarded',
          awardedBidId: bidId
        });
        
        // Also reject all other bids for this tender
        if (bids) {
          bids.forEach(bid => {
            if (bid.id !== bidId && bid.status !== 'rejected') {
              updateBidStatus.mutate({ 
                bidId: bid.id, 
                status: 'rejected',
                reason: 'Another bid was accepted for this tender'
              });
            }
          });
        }
      }
    }
  };
  
  const confirmRejection = () => {
    if (!selectedBid) {
      toast.error('Bid ID is missing');
      return;
    }
    
    updateBidStatus.mutate({ 
      bidId: selectedBid, 
      status: 'rejected', 
      reason: rejectionReason 
    });
  };
  
  const confirmTechnicalScore = () => {
    if (!selectedBid) {
      toast.error('Bid ID is missing');
      return;
    }
    
    updateBidStatus.mutate({ 
      bidId: selectedBid, 
      status: 'under_review',
      technicalScore: Math.round(technicalScore * 10) / 10 // Round to 1 decimal place
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!bids || bids.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-600">No bids have been submitted for this tender yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rejection Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Rejection Reason</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this bid. This will be recorded in the system and visible to the vendor.
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
                  setSelectedBid(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmRejection}
                disabled={!rejectionReason.trim() || updateBidStatus.isLoading}
              >
                {updateBidStatus.isLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Technical Score Modal */}
      {showTechnicalScoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Technical Evaluation</h3>
            <p className="text-gray-600 mb-4">
              Assign a technical score for this bid (0-100).
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Technical Score
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input"
                  value={technicalScore}
                  onChange={(e) => setTechnicalScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
                <span className="ml-2 text-gray-500">/ 100</span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowTechnicalScoreModal(false);
                  setSelectedBid(null);
                  setTechnicalScore(0);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmTechnicalScore}
                disabled={updateBidStatus.isLoading}
              >
                {updateBidStatus.isLoading ? 'Processing...' : 'Save Score'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Technical Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted At
              </th>
              {isProcurementOfficer && tenderStatus === 'under_review' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bids.map((bid) => {
              // Check if this bid is awarded
              const isAwarded = tender?.awarded_bid_id === bid.id;
              
              return (
                <tr key={bid.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {bid.vendors?.name || 'Unknown Vendor'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          bid.vendors?.business_type === 'MSE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {bid.vendors?.business_type}
                        </span>
                        {bid.vendors?.compliance_score !== null && (
                          <span className="ml-2">
                            Score: {bid.vendors?.compliance_score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ₹{bid.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {bid.technical_score !== null ? (
                      <span className="font-medium">{bid.technical_score}%</span>
                    ) : (
                      <span className="text-gray-400">Not evaluated</span>
                    )}
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
                      {isAwarded && (
                        <span className="mt-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
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
                    {format(new Date(bid.created_at), 'PPp')}
                  </td>
                  {isProcurementOfficer && tenderStatus === 'under_review' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bid.status === 'submitted' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleBidStatusUpdate(bid.id, 'under_review')}
                            className="text-yellow-600 hover:text-yellow-900"
                            disabled={updateBidStatus.isLoading}
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleBidStatusUpdate(bid.id, 'accepted')}
                            className="text-green-600 hover:text-green-900"
                            disabled={updateBidStatus.isLoading}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleBidStatusUpdate(bid.id, 'rejected')}
                            className="text-red-600 hover:text-red-900"
                            disabled={updateBidStatus.isLoading}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {bid.status === 'under_review' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleBidStatusUpdate(bid.id, 'accepted')}
                            className="text-green-600 hover:text-green-900"
                            disabled={updateBidStatus.isLoading}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleBidStatusUpdate(bid.id, 'rejected')}
                            className="text-red-600 hover:text-red-900"
                            disabled={updateBidStatus.isLoading}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}