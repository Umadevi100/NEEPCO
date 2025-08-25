import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import BidForm from './BidForm';
import BidList from './BidList';
import AwardedTenderPayment from '../../components/payments/AwardedTenderPayment';
import { useState } from 'react';

export default function TenderDetails() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isProcurementOfficer = hasRole('procurement_officer') || hasRole('admin');
  const isFinanceOfficer = hasRole('finance_officer') || hasRole('procurement_officer') || hasRole('admin');
  const isVendor = hasRole('vendor');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const { data: tender, isLoading: isLoadingTender } = useQuery({
    queryKey: ['tenders', id],
    queryFn: async () => {
      try {
        // First get the tender details
        const { data: tenderData, error: tenderError } = await supabase
          .from('tenders')
          .select('*')
          .eq('id', id)
          .single();

        if (tenderError) throw tenderError;
        
        // If we have a created_by field, get the creator's profile separately
        if (tenderData.created_by) {
          const { data: creatorData, error: creatorError } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', tenderData.created_by)
            .maybeSingle();
            
          if (!creatorError && creatorData) {
            // Combine the data
            return {
              ...tenderData,
              profiles: creatorData
            };
          }
        }
        
        return tenderData;
      } catch (error) {
        console.error('Error fetching tender:', error);
        toast.error('Failed to load tender details');
        throw error;
      }
    },
    enabled: !!id,
    retry: 2, // Retry failed requests up to 2 times
  });

  // Get vendor details if user is a vendor
  const { data: vendorDetails, isLoading: isLoadingVendor } = useQuery({
    queryKey: ['vendor-details', user?.id],
    queryFn: async () => {
      if (!isVendor || !user?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id, status, business_type')
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

  // Check if vendor has already submitted a bid for this tender
  const { data: vendorBid, isLoading: isLoadingVendorBid } = useQuery({
    queryKey: ['vendor-bid', id, vendorDetails?.id],
    queryFn: async () => {
      if (!vendorDetails?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('bids')
          .select('*')
          .eq('tender_id', id)
          .eq('vendor_id', vendorDetails.id)
          .maybeSingle();
          
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } catch (error) {
        console.error('Error checking vendor bid:', error);
        return null;
      }
    },
    enabled: !!id && !!vendorDetails?.id,
  });

  // Get awarded bid details if tender is awarded
  const { data: awardedBid, isLoading: isLoadingAwardedBid } = useQuery({
    queryKey: ['awarded-bid', tender?.awarded_bid_id],
    queryFn: async () => {
      if (!tender?.awarded_bid_id) return null;
      
      try {
        const { data, error } = await supabase
          .from('bids')
          .select(`
            *,
            vendors (
              id,
              name,
              business_type
            )
          `)
          .eq('id', tender.awarded_bid_id)
          .single();
          
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching awarded bid:', error);
        return null;
      }
    },
    enabled: !!tender?.awarded_bid_id,
  });

  // Check if payment has been created for this awarded tender
  const { data: tenderPayment, isLoading: isLoadingTenderPayment } = useQuery({
    queryKey: ['tender-payment', id, tender?.awarded_bid_id],
    queryFn: async () => {
      if (!id || !tender?.awarded_bid_id) return null;
      
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('related_tender', id)
          .eq('related_bid', tender.awarded_bid_id)
          .maybeSingle();
          
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } catch (error) {
        console.error('Error checking tender payment:', error);
        return null;
      }
    },
    enabled: !!id && !!tender?.awarded_bid_id,
  });

  const updateTenderStatus = useMutation({
    mutationFn: async (status) => {
      const { data, error } = await supabase
        .from('tenders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tenders', id]);
      queryClient.invalidateQueries(['tenders']);
      toast.success(`Tender status updated to ${data.status.replace('_', ' ')}`);
    },
    onError: (error) => {
      console.error('Error updating tender status:', error);
      toast.error(error.message || 'Failed to update tender status');
    }
  });

  const handleStatusUpdate = (newStatus) => {
    updateTenderStatus.mutate(newStatus);
  };

  const handleBidSubmitted = () => {
    queryClient.invalidateQueries(['vendor-bid', id, vendorDetails?.id]);
    queryClient.invalidateQueries(['bids', id]);
  };

  const handlePaymentCreated = () => {
    setShowPaymentForm(false);
    queryClient.invalidateQueries(['tender-payment', id, tender?.awarded_bid_id]);
    toast.success('Payment created successfully');
  };

  const isLoading = isLoadingTender || 
                   (isVendor && (isLoadingVendor || isLoadingVendorBid)) || 
                   (tender?.awarded_bid_id && isLoadingAwardedBid) ||
                   (tender?.awarded_bid_id && isLoadingTenderPayment);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!tender) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-3">Tender Not Found</h2>
        <p className="text-red-700">The tender you're looking for doesn't exist or has been removed.</p>
        <button 
          onClick={() => window.history.back()} 
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Check if tender submission deadline has passed
  const isDeadlinePassed = new Date(tender.submission_deadline) < new Date();
  
  // Check if vendor can submit a bid (active vendor, published tender, deadline not passed, no existing bid)
  const canSubmitBid = isVendor && 
                      vendorDetails?.status === 'Active' && 
                      tender.status === 'published' && 
                      !isDeadlinePassed && 
                      !vendorBid;

  // Render different views based on user role
  if (isProcurementOfficer) {
    return <ProcurementOfficerView 
      tender={tender} 
      isDeadlinePassed={isDeadlinePassed}
      handleStatusUpdate={handleStatusUpdate}
      updateTenderStatus={updateTenderStatus}
      awardedBid={awardedBid}
      tenderPayment={tenderPayment}
      showPaymentForm={showPaymentForm}
      setShowPaymentForm={setShowPaymentForm}
      handlePaymentCreated={handlePaymentCreated}
      isFinanceOfficer={isFinanceOfficer}
    />;
  } else {
    return <VendorView 
      tender={tender} 
      isDeadlinePassed={isDeadlinePassed}
      vendorDetails={vendorDetails}
      vendorBid={vendorBid}
      canSubmitBid={canSubmitBid}
      handleBidSubmitted={handleBidSubmitted}
      id={id}
      awardedBid={awardedBid}
      tenderPayment={tenderPayment}
    />;
  }
}

// Procurement Officer View Component
function ProcurementOfficerView({ 
  tender, 
  isDeadlinePassed, 
  handleStatusUpdate, 
  updateTenderStatus, 
  awardedBid,
  tenderPayment,
  showPaymentForm,
  setShowPaymentForm,
  handlePaymentCreated,
  isFinanceOfficer
}) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{tender.title}</h1>
            <p className="text-gray-600">{tender.description}</p>
          </div>
          <div className="space-x-2">
            {tender.status === 'draft' && (
              <button
                onClick={() => handleStatusUpdate('published')}
                className="btn btn-primary"
                disabled={updateTenderStatus.isLoading}
              >
                {updateTenderStatus.isLoading ? 'Publishing...' : 'Publish Tender'}
              </button>
            )}
            {tender.status === 'published' && (
              <button
                onClick={() => handleStatusUpdate('under_review')}
                className="btn btn-secondary"
                disabled={updateTenderStatus.isLoading}
              >
                {updateTenderStatus.isLoading ? 'Processing...' : 'Start Review'}
              </button>
            )}
            {tender.status === 'under_review' && !tender.awarded_bid_id && (
              <button
                onClick={() => handleStatusUpdate('awarded')}
                className="btn btn-primary"
                disabled={updateTenderStatus.isLoading}
              >
                {updateTenderStatus.isLoading ? 'Processing...' : 'Award Tender'}
              </button>
            )}
            {tender.status === 'awarded' && (
              <span className="px-3 py-2 bg-green-100 text-green-800 rounded-md">
                Tender Awarded
              </span>
            )}
            {tender.status === 'cancelled' && (
              <span className="px-3 py-2 bg-red-100 text-red-800 rounded-md">
                Tender Cancelled
              </span>
            )}
            {tender.status !== 'cancelled' && tender.status !== 'awarded' && (
              <button
                onClick={() => handleStatusUpdate('cancelled')}
                className="btn btn-secondary"
                disabled={updateTenderStatus.isLoading}
              >
                {updateTenderStatus.isLoading ? 'Cancelling...' : 'Cancel Tender'}
              </button>
            )}
            {tender.status === 'cancelled' && tender.status !== 'awarded' && (
              <button
                onClick={() => handleStatusUpdate('draft')}
                className="btn btn-primary"
                disabled={updateTenderStatus.isLoading}
              >
                {updateTenderStatus.isLoading ? 'Reactivating...' : 'Reactivate Tender'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Estimated Value</dt>
                <dd className="text-lg text-gray-900">₹{tender.estimated_value.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="text-lg text-gray-900 capitalize">{tender.category || 'Goods'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Submission Deadline</dt>
                <dd className="text-lg text-gray-900">
                  {format(new Date(tender.submission_deadline), 'PPp')}
                  {isDeadlinePassed && (
                    <span className="ml-2 text-sm text-red-600">(Passed)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
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
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created By</dt>
                <dd className="text-lg text-gray-900">
                  {tender.profiles ? 
                    `${tender.profiles.first_name || ''} ${tender.profiles.last_name || ''}` : 
                    'Procurement Officer'}
                </dd>
              </div>
              {tender.is_reserved_for_mse && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Reserved For</dt>
                  <dd>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      MSE Vendors Only
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Procurement Details</h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="text-lg text-gray-900">
                  {format(new Date(tender.created_at), 'PPp')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-lg text-gray-900">
                  {format(new Date(tender.updated_at), 'PPp')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tender ID</dt>
                <dd className="text-lg text-gray-900 font-mono text-sm">
                  {tender.id}
                </dd>
              </div>
              {tender.documents && tender.documents.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Documents</dt>
                  <dd className="mt-1">
                    <ul className="space-y-1">
                      {tender.documents.map((doc, index) => (
                        <li key={index} className="text-primary-600 hover:text-primary-800">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            {doc.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {tender.status === 'awarded' && awardedBid && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Awarded To</dt>
                  <dd className="mt-1">
                    <div className="bg-green-50 p-3 rounded-md border border-green-200">
                      <div className="font-medium text-green-800">{awardedBid.vendors?.name}</div>
                      <div className="text-sm text-green-700 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          awardedBid.vendors?.business_type === 'MSE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {awardedBid.vendors?.business_type}
                        </span>
                        <span className="ml-2">Bid Amount: ₹{awardedBid.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Payment Section for Awarded Tenders */}
      {tender.status === 'awarded' && awardedBid && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Payment Status</h2>
            {isFinanceOfficer && !tenderPayment && !showPaymentForm && (
              <button
                onClick={() => setShowPaymentForm(true)}
                className="btn btn-primary"
              >
                Process Payment
              </button>
            )}
          </div>
          
          {showPaymentForm && !tenderPayment ? (
            <AwardedTenderPayment 
              tender={tender} 
              bid={awardedBid} 
              onSuccess={handlePaymentCreated} 
            />
          ) : tenderPayment ? (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Payment Information</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-green-700">Payment Amount</dt>
                  <dd className="mt-1 text-lg font-bold text-green-900">₹{tenderPayment.amount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-green-700">Payment Method</dt>
                  <dd className="mt-1 text-lg text-green-900 capitalize">{tenderPayment.payment_method.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-green-700">Payment Status</dt>
                  <dd className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tenderPayment.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : tenderPayment.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : tenderPayment.status === 'processing'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {tenderPayment.status.toUpperCase()}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-green-700">Created At</dt>
                  <dd className="mt-1 text-lg text-green-900">{format(new Date(tenderPayment.created_at), 'PPp')}</dd>
                </div>
                {tenderPayment.notes && (
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-green-700">Notes</dt>
                    <dd className="mt-1 text-lg text-green-900">{tenderPayment.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 text-center">
              <p className="text-yellow-800">No payment has been processed for this awarded tender yet.</p>
              {!isFinanceOfficer && (
                <p className="mt-2 text-yellow-700">A finance officer needs to process the payment.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Submitted Bids</h2>
        <BidList tenderId={tender.id} tenderStatus={tender.status} />
      </div>

      <div className="card bg-blue-50">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Tender Status Management</h2>
        <div className="prose max-w-none text-blue-800">
          <p>Use the buttons above to manage this tender's status:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Draft:</strong> Initial state, only visible to procurement officers</li>
            <li><strong>Published:</strong> Visible to vendors who can submit bids</li>
            <li><strong>Under Review:</strong> Bidding closed, procurement team evaluating bids</li>
            <li><strong>Awarded:</strong> Tender has been awarded to a vendor</li>
            <li><strong>Cancelled:</strong> Tender has been cancelled</li>
          </ul>
          <p className="mt-4">
            <strong>Note:</strong> Changing the status to "Published" will make this tender visible to all vendors who can then submit bids until the submission deadline.
          </p>
        </div>
      </div>
    </div>
  );
}

// Vendor View Component
function VendorView({ 
  tender, 
  isDeadlinePassed, 
  vendorDetails, 
  vendorBid, 
  canSubmitBid, 
  handleBidSubmitted, 
  id, 
  awardedBid,
  tenderPayment
}) {
  // Check if this tender is reserved for MSE vendors
  const isMSEReserved = tender.is_reserved_for_mse;
  const isMSEVendor = vendorDetails?.business_type === 'MSE';
  
  // If tender is MSE-reserved and vendor is not MSE, they cannot bid
  const cannotBidDueToMSE = isMSEReserved && !isMSEVendor;

  // Check if this vendor's bid was accepted
  const isMyBidAccepted = vendorBid && awardedBid && vendorBid.id === awardedBid.id;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{tender.title}</h1>
        <p className="text-gray-600 mb-6">{tender.description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tender Details</h2>
            <dl className="mt-4 space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Estimated Value</dt>
                <dd className="text-lg text-gray-900">₹{tender.estimated_value.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="text-lg text-gray-900 capitalize">{tender.category || 'Goods'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Submission Deadline</dt>
                <dd className="text-lg text-gray-900">
                  {format(new Date(tender.submission_deadline), 'PPp')}
                  {isDeadlinePassed && (
                    <span className="ml-2 text-sm text-red-600">(Passed)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
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
                </dd>
              </div>
              {isMSEReserved && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Reserved For</dt>
                  <dd>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      MSE Vendors Only
                    </span>
                  </dd>
                </div>
              )}
              {tender.documents && tender.documents.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Documents</dt>
                  <dd className="mt-1">
                    <ul className="space-y-1">
                      {tender.documents.map((doc, index) => (
                        <li key={index} className="text-primary-600 hover:text-primary-800">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            {doc.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {tender.status === 'awarded' && awardedBid && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Awarded To</dt>
                  <dd className="mt-1">
                    <div className={`p-3 rounded-md border ${isMyBidAccepted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className={`font-medium ${isMyBidAccepted ? 'text-green-800' : 'text-gray-800'}`}>
                        {awardedBid.vendors?.name}
                        {isMyBidAccepted && (
                          <span className="ml-2 text-green-600">(Your bid was accepted!)</span>
                        )}
                      </div>
                      <div className="text-sm mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          awardedBid.vendors?.business_type === 'MSE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {awardedBid.vendors?.business_type}
                        </span>
                      </div>
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {canSubmitBid && !cannotBidDueToMSE && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Submit Bid</h2>
              <BidForm 
                tenderId={id} 
                vendorId={vendorDetails.id}
                onSuccess={handleBidSubmitted} 
              />
            </div>
          )}
          
          {canSubmitBid && cannotBidDueToMSE && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">MSE-Only Tender</h2>
              <p className="text-yellow-700">
                This tender is reserved for Micro and Small Enterprise (MSE) vendors only. 
                Your business type does not qualify for this tender.
              </p>
            </div>
          )}
          
          {vendorBid && (
            <div className={`p-4 rounded-lg border ${isMyBidAccepted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <h2 className={`text-lg font-semibold mb-2 ${isMyBidAccepted ? 'text-green-800' : 'text-blue-800'}`}>
                {isMyBidAccepted ? 'Your Bid Was Accepted!' : 'Bid Submitted'}
              </h2>
              <p className={`mb-2 ${isMyBidAccepted ? 'text-green-700' : 'text-blue-700'}`}>
                {isMyBidAccepted 
                  ? 'Congratulations! Your bid for this tender has been accepted.' 
                  : 'You have already submitted a bid for this tender.'}
              </p>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className={`text-sm font-medium ${isMyBidAccepted ? 'text-green-700' : 'text-blue-700'}`}>Amount:</dt>
                  <dd className={`text-sm font-semibold ${isMyBidAccepted ? 'text-green-800' : 'text-blue-800'}`}>₹{vendorBid.amount.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className={`text-sm font-medium ${isMyBidAccepted ? 'text-green-700' : 'text-blue-700'}`}>Status:</dt>
                  <dd className="text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vendorBid.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : vendorBid.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {vendorBid.status.toUpperCase()}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className={`text-sm font-medium ${isMyBidAccepted ? 'text-green-700' : 'text-blue-700'}`}>Submitted:</dt>
                  <dd className={`text-sm ${isMyBidAccepted ? 'text-green-800' : 'text-blue-800'}`}>{format(new Date(vendorBid.created_at), 'PPp')}</dd>
                </div>
                {vendorBid.notes && (
                  <div>
                    <dt className={`text-sm font-medium ${isMyBidAccepted ? 'text-green-700' : 'text-blue-700'}`}>Notes:</dt>
                    <dd className={`text-sm mt-1 ${isMyBidAccepted ? 'text-green-800' : 'text-blue-800'}`}>{vendorBid.notes}</dd>
                  </div>
                )}
                {vendorBid.technical_score !== null && (
                  <div className="flex justify-between">
                    <dt className={`text-sm font-medium ${isMyBidAccepted ? 'text-green-700' : 'text-blue-700'}`}>Technical Score:</dt>
                    <dd className={`text-sm font-semibold ${isMyBidAccepted ? 'text-green-800' : 'text-blue-800'}`}>{vendorBid.technical_score}%</dd>
                  </div>
                )}
              </dl>
              {isMyBidAccepted && (
                <div className="mt-4 p-3 bg-green-100 rounded-md">
                  <p className="text-green-800 font-medium">Next Steps:</p>
                  <p className="text-green-700 text-sm mt-1">
                    The procurement team will contact you soon with further details about the contract and payment arrangements.
                  </p>
                  
                  {/* Payment Status Section */}
                  {tenderPayment && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-green-800 font-medium">Payment Status:</p>
                      <div className="flex justify-between mt-1">
                        <span className="text-green-700 text-sm">Amount:</span>
                        <span className="text-green-800 text-sm font-semibold">₹{tenderPayment.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-green-700 text-sm">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          tenderPayment.status === 'completed'
                            ? 'bg-green-200 text-green-800'
                            : tenderPayment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {tenderPayment.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-green-700 text-sm">Method:</span>
                        <span className="text-green-800 text-sm capitalize">{tenderPayment.payment_method.replace('_', ' ')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {vendorDetails?.status !== 'Active' && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">Account Not Active</h2>
              <p className="text-yellow-700">
                Your vendor account must be approved before you can submit bids.
              </p>
            </div>
          )}
          
          {isDeadlinePassed && tender.status === 'published' && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Deadline Passed</h2>
              <p className="text-red-700">
                The submission deadline for this tender has passed. No new bids can be submitted.
              </p>
            </div>
          )}
        </div>
      </div>

      {tender.status !== 'draft' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bidding Guidelines</h2>
          <div className="prose max-w-none">
            <p>
              Please review the following guidelines before submitting your bid:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Ensure your bid amount is competitive and realistic</li>
              <li>Include any relevant details about your proposal in the notes section</li>
              <li>Once submitted, bids cannot be modified or withdrawn</li>
              <li>All bids will be evaluated based on price, quality, and vendor compliance history</li>
              <li>The procurement officer will review all bids after the submission deadline</li>
              {isMSEReserved && (
                <li className="font-semibold">This tender is reserved for MSE vendors only</li>
              )}
            </ul>
            <p className="mt-4">
              For any questions regarding this tender, please contact the procurement team.
            </p>
          </div>
        </div>
      )}

      <div className="card bg-blue-50">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Tender Status Guide</h2>
        <div className="prose max-w-none text-blue-800">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Published:</strong> Open for bidding. You can submit your bid if the deadline hasn't passed.</li>
            <li><strong>Under Review:</strong> Bidding is closed. The procurement team is evaluating all submitted bids.</li>
            <li><strong>Awarded:</strong> The tender has been awarded to a vendor. Check your bid status to see if you were selected.</li>
            <li><strong>Cancelled:</strong> The tender has been cancelled and is no longer active.</li>
          </ul>
          <p className="mt-4">
            <strong>Note:</strong> You can only submit bids for tenders with "Published" status and before the submission deadline.
          </p>
        </div>
      </div>
    </div>
  );
}