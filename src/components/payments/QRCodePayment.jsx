import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

export default function QRCodePayment({ payment, onSuccess }) {
  const [showPayButton, setShowPayButton] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const updatePayment = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'processing',
          payment_method: 'bank_transfer',
          transaction_id: `QR-${Date.now()}`,
          notes: payment.notes ? `${payment.notes} | Paid via QR Code` : 'Paid via QR Code'
        })
        .eq('id', payment.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['vendor-payments']);
      toast.success('Payment processed successfully. Awaiting verification.');
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Failed to process payment');
    }
  });

  // Generate a secure payment URL that includes the payment ID and user token
  const paymentUrl = user ? 
    `${window.location.origin}/pay/${payment.id}?token=${encodeURIComponent(user.id)}` :
    '';

  const handleQRCodeScan = () => {
    setShowPayButton(true);
  };

  const handlePayment = async () => {
    try {
      await updatePayment.mutateAsync();
    } catch (error) {
      console.error('Payment error:', error);
    }
  };

  if (!user) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-red-700">You must be logged in to access payment details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code Payment</h3>
        
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <QRCodeSVG 
              value={paymentUrl}
              size={200}
              level="H"
              includeMargin={true}
              onClick={handleQRCodeScan}
              className="cursor-pointer"
            />
          </div>
          
          <p className="text-sm text-gray-600">
            Scan the QR code to proceed with payment
          </p>

          {showPayButton && (
            <button
              onClick={handlePayment}
              disabled={updatePayment.isLoading}
              className="btn btn-primary w-full"
            >
              {updatePayment.isLoading ? 'Processing...' : `Pay ₹${payment.amount.toLocaleString()}`}
            </button>
          )}
        </div>

        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Payment Instructions:</h4>
          <ol className="list-decimal list-inside space-y-2 text-blue-700">
            <li>Scan the QR code using your mobile device</li>
            <li>Review the payment details on the payment page</li>
            <li>Click the Pay Now button to complete the payment</li>
            <li>Wait for verification from the procurement officer</li>
          </ol>
        </div>
      </div>
    </div>
  );
}