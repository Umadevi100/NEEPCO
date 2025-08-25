import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

export default function TenderDetails() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const isVendor = hasRole('vendor');
  const [bidAmount, setBidAmount] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [documents, setDocuments] = useState([]);

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

  const submitBid = useMutation({
    mutationFn: async ({ tenderId, vendorId, amount, notes, documentsList }) => {
      // Format documents for storage
      const formattedDocuments = documentsList.map(doc => ({
        name: doc.name,
        type: doc.type,
        size: doc.size,
        uploadedAt: new Date().toISOString()
      }));
      
      const { data, error } = await supabase
        .from('bids')
        .insert([{
          tender_id: tenderId,
          vendor_id: vendorId,
          amount: parseFloat(amount),
          notes: notes,
          documents: formattedDocuments,
          status: 'submitted'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vendor-bid', id, vendorDetails?.id]);
      toast.success('Bid submitted successfully');
      setBidAmount('');
      setBidNotes('');
      setDocuments([]);
    },
    onError: (error) => {
      console.error('Error submitting bid:', error);
      if (error.code === '23505') {
        toast.error('You have already submitted a bid for this tender');
      } else {
        toast.error(error.message || 'Failed to submit bid');
      }
    }
  });

  const handleSubmitBid = (e) => {
    e.preventDefault();
    
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      toast.error('Please enter a valid bid amount');
      return;
    }
    
    submitBid.mutate({
      tenderId: id,
      vendorId: vendorDetails.id,
      amount: bidAmount,
      notes: bidNotes,
      documentsList: documents
    });
  };

  const handleDocumentChange = (e) => {
    const files = Array.from(e.target.files);
    setDocuments(prev => [...prev, ...files]);
  };

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const isLoading = isLoadingTender || (isVendor && (isLoadingVendor || isLoadingVendorBid));

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

  // Check if this tender is reserved for MSE vendors
  const isMSEReserved = tender.is_reserved_for_mse;
  const isMSEVendor = vendorDetails?.business_type === 'MSE';
  
  // If tender is MSE-reserved and vendor is not MSE, they cannot bid
  const cannotBidDueToMSE = isMSEReserved && !isMSEVendor;

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
            </dl>
          </div>

          {canSubmitBid && !cannotBidDueToMSE && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Submit Bid</h2>
              <form onSubmit={handleSubmitBid} className="space-y-6">
                <div>
                  <label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700">
                    Bid Amount (₹)
                  </label>
                  <input
                    type="number"
                    id="bidAmount"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="input mt-1"
                    placeholder="Enter your bid amount"
                    required
                    min="1"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label htmlFor="documents" className="block text-sm font-medium text-gray-700">
                    Supporting Documents (Optional)
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="file"
                      id="documents"
                      multiple
                      className="sr-only"
                      onChange={handleDocumentChange}
                    />
                    <label
                      htmlFor="documents"
                      className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Upload Files
                    </label>
                  </div>
                  
                  {documents.length > 0 && (
                    <ul className="mt-2 divide-y divide-gray-200 border border-gray-200 rounded-md">
                      {documents.map((doc, index) => (
                        <li key={index} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                          <div className="w-0 flex-1 flex items-center">
                            <span className="ml-2 flex-1 w-0 truncate">{doc.name}</span>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <button
                              type="button"
                              className="font-medium text-primary-600 hover:text-primary-500"
                              onClick={() => removeDocument(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div>
                  <label htmlFor="bidNotes" className="block text-sm font-medium text-gray-700">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="bidNotes"
                    value={bidNotes}
                    onChange={(e) => setBidNotes(e.target.value)}
                    className="input mt-1"
                    placeholder="Add any additional information about your bid"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitBid.isLoading}
                  >
                    {submitBid.isLoading ? 'Submitting...' : 'Submit Bid'}
                  </button>
                </div>
              </form>
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
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">Bid Submitted</h2>
              <p className="text-blue-700 mb-2">
                You have already submitted a bid for this tender.
              </p>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-blue-700">Amount:</dt>
                  <dd className="text-sm font-semibold text-blue-800">₹{vendorBid.amount.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-blue-700">Status:</dt>
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
                  <dt className="text-sm font-medium text-blue-700">Submitted:</dt>
                  <dd className="text-sm text-blue-800">{format(new Date(vendorBid.created_at), 'PPp')}</dd>
                </div>
                {vendorBid.notes && (
                  <div>
                    <dt className="text-sm font-medium text-blue-700">Notes:</dt>
                    <dd className="text-sm text-blue-800 mt-1">{vendorBid.notes}</dd>
                  </div>
                )}
                {vendorBid.technical_score !== null && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-blue-700">Technical Score:</dt>
                    <dd className="text-sm font-semibold text-blue-800">{vendorBid.technical_score}%</dd>
                  </div>
                )}
              </dl>
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