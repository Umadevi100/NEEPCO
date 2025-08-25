import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createPaymentSchedule } from '../../lib/api/payments';

const scheduleSchema = Yup.object().shape({
  vendor_id: Yup.string().required('Vendor is required'),
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be positive'),
  schedule_date: Yup.date()
    .required('Schedule date is required')
    .min(new Date(), 'Schedule date must be in the future'),
  frequency: Yup.string().required('Frequency is required'),
  description: Yup.string(),
});

export default function PaymentScheduleForm({ onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formik = useFormik({
    initialValues: {
      vendor_id: '',
      amount: '',
      schedule_date: '',
      frequency: '',
      description: '',
    },
    validationSchema: scheduleSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        await createPaymentSchedule({
          ...values,
          status: 'active',
        });
        onSuccess?.();
        formik.resetForm();
      } catch (error) {
        console.error('Error creating payment schedule:', error);
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
        <label htmlFor="schedule_date" className="block text-sm font-medium text-gray-700">
          Schedule Date
        </label>
        <input
          type="date"
          id="schedule_date"
          name="schedule_date"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.schedule_date}
        />
        {formik.touched.schedule_date && formik.errors.schedule_date && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.schedule_date}</div>
        )}
      </div>

      <div>
        <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          className="input mt-1"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.frequency}
        >
          <option value="">Select frequency</option>
          <option value="one_time">One Time</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
        {formik.touched.frequency && formik.errors.frequency && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.frequency}</div>
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Creating...' : 'Create Schedule'}
        </button>
      </div>
    </form>
  );
}