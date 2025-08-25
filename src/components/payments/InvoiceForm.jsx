import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createInvoice } from '../../lib/api/payments';

const invoiceSchema = Yup.object().shape({
  vendor_id: Yup.string().required('Vendor is required'),
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be positive'),
  description: Yup.string().required('Description is required'),
  invoice_number: Yup.string().required('Invoice number is required'),
  due_date: Yup.date()
    .required('Due date is required')
    .min(new Date(), 'Due date must be in the future'),
});

export default function InvoiceForm({ onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formik = useFormik({
    initialValues: {
      vendor_id: '',
      amount: '',
      description: '',
      invoice_number: '',
      due_date: '',
    },
    validationSchema: invoiceSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        await createInvoice({
          ...values,
          status: 'pending',
        });
        onSuccess?.();
        formik.resetForm();
      } catch (error) {
        console.error('Error creating invoice:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">
          Vendor
        </label>
        <select
          id="vendor_id"
          name="vendor_id"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.vendor_id}
        >
          <option value="">Select vendor</option>
          {/* TODO: Add vendor options */}
        </select>
        {formik.touched.vendor_id && formik.errors.vendor_id && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.vendor_id}</div>
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
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.description}
        />
        {formik.touched.description && formik.errors.description && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.description}</div>
        )}
      </div>

      <div>
        <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700">
          Invoice Number
        </label>
        <input
          type="text"
          id="invoice_number"
          name="invoice_number"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.invoice_number}
        />
        {formik.touched.invoice_number && formik.errors.invoice_number && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.invoice_number}</div>
        )}
      </div>

      <div>
        <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
          Due Date
        </label>
        <input
          type="date"
          id="due_date"
          name="due_date"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.due_date}
        />
        {formik.touched.due_date && formik.errors.due_date && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.due_date}</div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}