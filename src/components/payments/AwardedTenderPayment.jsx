import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const paymentSchema = Yup.object().shape({
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be positive'),
  paymentMethod: Yup.string()
    .required('Payment method is required')
    .oneOf(['bank_transfer', 'check', 'credit_card'], 'Invalid payment method'),
  notes: Yup.string(),
});

export default function AwardedTenderPayment({ tender, bid, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const createPayment = useMutation({
    mutationFn: async (paymentData) => {
      const { data, error } = await supabase
        .from('payments')
        .insert([{
          vendor_id: bid.vendor_id,
          amount: paymentData.amount,
          payment_method: paymentData.paymentMethod,
          notes: paymentData.notes,
          status: 'pending',
          related_tender: tender.id,
          related_bid: bid.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['vendor-payments', bid.vendor_id]);
      toast.success('Payment created successfully');
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Error creating payment:', error);
      toast.error(error.message || 'Failed to create payment');
    }
  });

  const formik = useFormik({
    initialValues: {
      amount: bid.amount || '',
      paymentMethod: 'bank_transfer',
      notes: `Payment for awarded tender: ${tender.title}`,
    },
    validationSchema: paymentSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        await createPayment.mutateAsync(values);
        formik.resetForm();
      } catch (error) {
        console.error('Error submitting payment:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Process Payment for Awarded Tender</h3>
      
      <div className="mb-6 bg-green-50 p-4 rounded-lg border border-green-200">
        <h4 className="font-medium text-green-800 mb-2">Tender Award Details</h4>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-green-700">Tender Title</dt>
            <dd className="mt-1 text-sm text-green-900">{tender.title}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-green-700">Awarded To</dt>
            <dd className="mt-1 text-sm text-green-900">{bid.vendors?.name || 'Vendor'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-green-700">Bid Amount</dt>
            <dd className="mt-1 text-sm text-green-900">₹{bid.amount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-green-700">Award Date</dt>
            <dd className="mt-1 text-sm text-green-900">{format(new Date(tender.updated_at), 'PPp')}</dd>
          </div>
        </dl>
      </div>
      
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Payment Amount (₹)
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            className="input mt-1"
            value={formik.values.amount}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.amount && formik.errors.amount && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.amount}</div>
          )}
        </div>

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
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="input mt-1"
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
            {isSubmitting ? 'Processing...' : 'Create Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}