import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function PublicPaymentPage() {
  const { paymentId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    fetchPaymentDetails();
  }, [paymentId, token]);

  const fetchPaymentDetails = async () => {
    try {
      if (!token) {
        setIsAuthorized(false);
        return;
      }

      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          *,
          vendors (
            name,
            business_type,
            user_id
          ),
          related_tender (
            title,
            description
          )
        `)
        .eq('id', paymentId)
        .single();

      if (error) throw error;

      // Check if the user is authorized to view this payment
      if (payment.vendors?.user_id === token) {
        setIsAuthorized(true);
        setPayment(payment);
      } else {
        setIsAuthorized(false);
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
      toast.error('Failed to load payment details');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setIsProcessing(true);
      
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'processing',
          payment_method: 'bank_transfer',
          transaction_id: `QR-${Date.now()}`,
          notes: payment.notes ? `${payment.notes} | Paid via QR Code` : 'Paid via QR Code'
        })
        .eq('id', paymentId);

      if (error) throw error;
      
      toast.success('Payment processed successfully. Awaiting verification.');
      fetchPaymentDetails(); // Refresh payment details
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
          <p className="text-gray-600">
            You are not authorized to view this payment. Please log in to your vendor account to access payment details.
          </p>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Payment Not Found</h1>
          <p className="text-gray-600">
            The payment you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Payment Details</h1>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vendor</h2>
            <p className="text-gray-600">{payment.vendors?.name}</p>
            <span className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-medium ${
              payment.vendors?.business_type === 'MSE'
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {payment.vendors?.business_type}
            </span>
          </div>

          {payment.related_tender && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Related Tender</h2>
              <p className="text-gray-600">{payment.related_tender.title}</p>
              <p className="text-sm text-gray-500 mt-1">{payment.related_tender.description}</p>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-gray-900">Amount</h2>
            <p className="text-2xl font-bold text-primary-600">₹{payment.amount.toLocaleString()}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900">Status</h2>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
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
          </div>

          {payment.status === 'pending' && (
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-md font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Pay Now'}
            </button>
          )}

          {payment.status !== 'pending' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-center text-gray-600">
                {payment.status === 'completed'
                  ? 'This payment has been completed.'
                  : payment.status === 'processing'
                  ? 'This payment is being processed and awaiting verification.'
                  : 'This payment cannot be processed at this time.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}