import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import VendorPaymentForm from './VendorPaymentForm';
import { useState } from 'react';

export default function PaymentDetails() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const isFinanceOfficer = hasRole('finance_officer') || hasRole('procurement_officer') || hasRole('admin');
  const isVendor = hasRole('vendor');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payments', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            *,
            vendors (
              id,
              name,
              business_type,
              user_id
            ),
            related_tender (
              id,
              title,
              description,
              estimated_value
            ),
            related_bid (
              id,
              amount,
              status
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching payment details:', error);
        toast.error('Failed to load payment details');
        throw error;
      }
    },
    enabled: !!id,
  });

  // Check if the current user is the vendor for this payment
  const isPaymentVendor = payment?.vendors?.user_id === user?.id;

  const updatePayment = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments', id]);
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['vendor-payments']);
      toast.success('Payment status updated successfully');
    },
    onError: (error) => {
      console.error('Error updating payment:', error);
      toast.error(error.message || 'Failed to update payment');
    }
  });

  const handleStatusUpdate = (newStatus) => {
    updatePayment.mutate({
      id,
      updates: { 
        status: newStatus,
        payment_date: newStatus === 'completed' ? new Date().toISOString() : payment.payment_date
      },
    });
  };

  const handlePaymentSubmitted = () => {
    setShowPaymentForm(false);
    queryClient.invalidateQueries(['payments', id]);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Details</h1>
            <p className="text-gray-600">
              Payment to {payment.vendors?.name || 'Vendor'}
            </p>
          </div>
          <div className="space-x-2">
            {isFinanceOfficer && payment.status === 'processing' && (
              <button
                onClick={() => handleStatusUpdate('completed')}
                className="btn btn-primary"
              >
                Complete Payment
              </button>
            )}
            {isVendor && isPaymentVendor && payment.status === 'pending' && (
              <button
                onClick={() => setShowPaymentForm(true)}
                className="btn btn-primary"
              >
                Make Payment
              </button>
            )}
          </div>
        </div>

        {showPaymentForm && isVendor && isPaymentVendor && payment.status === 'pending' && (
          <div className="mt-6">
            <VendorPaymentForm payment={payment} onSuccess={handlePaymentSubmitted} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Information</h2>
            <dl className="mt-4 space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Amount</dt>
                <dd className="text-lg text-gray-900">₹{payment.amount.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                <dd className="text-lg text-gray-900 capitalize">
                  {payment.payment_method.replace('_', ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
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
                </dd>
              </div>
              {payment.payment_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment Date</dt>
                  <dd className="text-lg text-gray-900">
                    {format(new Date(payment.payment_date), 'PPp')}
                  </dd>
                </div>
              )}
              {payment.transaction_id && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Transaction ID</dt>
                  <dd className="text-lg text-gray-900">{payment.transaction_id}</dd>
                </div>
              )}
              {payment.notes && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="text-lg text-gray-900">{payment.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vendor Information</h2>
            <dl className="mt-4 space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Vendor Name</dt>
                <dd className="text-lg text-gray-900">{payment.vendors?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Business Type</dt>
                <dd className="text-lg text-gray-900">{payment.vendors?.business_type || 'N/A'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Related Tender Information */}
        {payment.related_tender && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Tender</h2>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-800 mb-2">{payment.related_tender.title}</h3>
              <p className="text-blue-700 mb-4">{payment.related_tender.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-700">Tender Estimated Value</p>
                  <p className="text-lg font-semibold text-blue-800">₹{payment.related_tender.estimated_value.toLocaleString()}</p>
                </div>
                {payment.related_bid && (
                  <div>
                    <p className="text-sm font-medium text-blue-700">Awarded Bid Amount</p>
                    <p className="text-lg font-semibold text-blue-800">₹{payment.related_bid.amount.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {(isFinanceOfficer || (isVendor && isPaymentVendor)) && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <span className="text-green-600">1</span>
              </div>
              <div>
                <p className="font-medium">Payment Created</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(payment.created_at), 'PPp')}
                </p>
              </div>
            </div>
            
            {payment.status !== 'pending' && (
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <span className="text-blue-600">2</span>
                </div>
                <div>
                  <p className="font-medium">Payment Processing</p>
                  <p className="text-sm text-gray-500">
                    {payment.updated_at ? format(new Date(payment.updated_at), 'PPp') : 'N/A'}
                  </p>
                </div>
              </div>
            )}
            
            {payment.status === 'completed' && (
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <span className="text-green-600">3</span>
                </div>
                <div>
                  <p className="font-medium">Payment Completed</p>
                  <p className="text-sm text-gray-500">
                    {payment.payment_date ? format(new Date(payment.payment_date), 'PPp') : 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isVendor && isPaymentVendor && payment.status === 'pending' && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">Payment Required</h2>
          <p className="text-yellow-800 mb-4">
            This payment requires your action. Please submit the payment details to proceed.
          </p>
          <button
            onClick={() => setShowPaymentForm(true)}
            className="btn btn-primary"
          >
            Make Payment
          </button>
        </div>
      )}

      {isVendor && isPaymentVendor && payment.status === 'processing' && (
        <div className="card bg-blue-50 border border-blue-200">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Payment Under Verification</h2>
          <p className="text-blue-800">
            Your payment is being verified by the procurement team. You will be notified once the verification is complete.
          </p>
        </div>
      )}

      {isFinanceOfficer && payment.status === 'processing' && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">Payment Verification Required</h2>
          <p className="text-yellow-800 mb-4">
            This payment needs to be verified. Please check the payment details and mark it as completed if everything is correct.
          </p>
          <button
            onClick={() => handleStatusUpdate('completed')}
            className="btn btn-primary"
          >
            Complete Payment
          </button>
        </div>
      )}
    </div>
  );
}