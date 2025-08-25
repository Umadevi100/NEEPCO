import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { processPayment } from '../../lib/api/payments';

const paymentSchema = Yup.object().shape({
  invoice_id: Yup.string().required('Invoice is required'),
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be positive'),
  payment_method: Yup.string().required('Payment method is required'),
  notes: Yup.string(),
});

export default function PaymentForm({ invoice, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formik = useFormik({
    initialValues: {
      invoice_id: invoice?.id || '',
      amount: invoice?.amount || '',
      payment_method: '',
      notes: '',
    },
    validationSchema: paymentSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        await processPayment({
          ...values,
          status: 'pending',
        });
        onSuccess?.();
        formik.resetForm();
      } catch (error) {
        console.error('Error processing payment:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">
          Payment Method
        </label>
        <select
          id="payment_method"
          name="payment_method"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.payment_method}
        >
          <option value="">Select payment method</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="check">Check</option>
          <option value="credit_card">Credit Card</option>
        </select>
        {formik.touched.payment_method && formik.errors.payment_method && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.payment_method}</div>
        )}
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
          Amount
        </label>
        <input
          type="number"
          id="amount"
          name="amount"
          step="0.01"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.amount}
        />
        {formik.touched.amount && formik.errors.amount && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.amount}</div>
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
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.notes}
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
          {isSubmitting ? 'Processing...' : 'Process Payment'}
        </button>
      </div>
    </form>
  );
}