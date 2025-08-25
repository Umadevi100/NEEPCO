import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const paymentSchema = Yup.object().shape({
  paymentMethod: Yup.string()
    .required('Payment method is required')
    .oneOf(['bank_transfer', 'check', 'credit_card'], 'Invalid payment method'),
  transactionId: Yup.string().required('Transaction ID is required'),
  notes: Yup.string(),
});

export default function VendorPaymentForm({ payment, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const updatePayment = useMutation({
    mutationFn: async (values) => {
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'processing', // Change status to processing
          payment_method: values.paymentMethod,
          transaction_id: values.transactionId,
          notes: values.notes ? `${payment.notes || ''} | Vendor note: ${values.notes}` : payment.notes
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
      toast.success('Payment submitted successfully. Awaiting verification.');
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Error submitting payment:', error);
      toast.error(error.message || 'Failed to submit payment');
    }
  });

  const formik = useFormik({
    initialValues: {
      paymentMethod: payment.payment_method || 'bank_transfer',
      transactionId: '',
      notes: '',
    },
    validationSchema: paymentSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        await updatePayment.mutateAsync(values);
      } catch (error) {
        console.error('Error submitting payment:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
          Payment Method
        </label>
        <select
          id="paymentMethod"
          name="paymentMethod"
          className="input mt-1"
          value={formik.values.paymentMethod}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        >
          <option value="bank_transfer">Bank Transfer</option>
          <option value="check">Check</option>
          <option value="credit_card">Credit Card</option>
        </select>
        {formik.touched.paymentMethod && formik.errors.paymentMethod && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.paymentMethod}</div>
        )}
      </div>

      <div>
        <label htmlFor="transactionId" className="block text-sm font-medium text-gray-700">
          Transaction ID / Reference Number
        </label>
        <input
          type="text"
          id="transactionId"
          name="transactionId"
          className="input mt-1"
          placeholder="Enter transaction ID or reference number"
          value={formik.values.transactionId}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
        {formik.touched.transactionId && formik.errors.transactionId && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.transactionId}</div>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Additional Notes (Optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="input mt-1"
          placeholder="Add any additional information about your payment"
          value={formik.values.notes}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
        {formik.touched.notes && formik.errors.notes && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.notes}</div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Processing...' : 'Submit Payment'}
        </button>
      </div>
    </form>
  );
}