import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const tenderSchema = Yup.object().shape({
  title: Yup.string().required('Title is required'),
  description: Yup.string().required('Description is required'),
  estimatedValue: Yup.number()
    .required('Estimated value is required')
    .positive('Estimated value must be positive'),
  submissionDeadline: Yup.date()
    .required('Submission deadline is required')
    .min(new Date(), 'Submission deadline must be in the future'),
  category: Yup.string()
    .required('Category is required')
    .oneOf(['goods', 'services', 'works'], 'Invalid category'),
  isReservedForMSE: Yup.boolean()
});

export default function TenderForm({ onSuccess, initialValues = null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formik = useFormik({
    initialValues: initialValues || {
      title: '',
      description: '',
      estimatedValue: '',
      submissionDeadline: '',
      category: 'goods',
      isReservedForMSE: false
    },
    validationSchema: tenderSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        
        if (!user) {
          toast.error('You must be logged in to create a tender');
          return;
        }
        
        // Format the submission deadline
        const submissionDeadline = new Date(values.submissionDeadline).toISOString();
        
        const { data, error } = await supabase
          .from('tenders')
          .insert([{
            title: values.title,
            description: values.description,
            estimated_value: parseFloat(values.estimatedValue),
            submission_deadline: submissionDeadline,
            status: 'draft',
            category: values.category,
            is_reserved_for_mse: values.isReservedForMSE,
            created_by: user.id
          }])
          .select()
          .single();

        if (error) {
          console.error('Error creating tender:', error);
          throw error;
        }
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries(['tenders']);
        
        toast.success('Tender created successfully');
        formik.resetForm();
        onSuccess?.(data);
      } catch (error) {
        console.error('Error creating tender:', error);
        toast.error(error.message || 'Failed to create tender');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            className="input mt-1"
            placeholder="Enter tender title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.title && formik.errors.title && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.title}</div>
          )}
        </div>

        <div>
          <label htmlFor="estimatedValue" className="block text-sm font-medium text-gray-700">
            Estimated Value (₹)
          </label>
          <input
            type="number"
            id="estimatedValue"
            name="estimatedValue"
            min="0"
            step="0.01"
            className="input mt-1"
            placeholder="Enter estimated value"
            value={formik.values.estimatedValue}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.estimatedValue && formik.errors.estimatedValue && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.estimatedValue}</div>
          )}
        </div>
        
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category"
            name="category"
            className="input mt-1"
            value={formik.values.category}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          >
            <option value="goods">Goods</option>
            <option value="services">Services</option>
            <option value="works">Works</option>
          </select>
          {formik.touched.category && formik.errors.category && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.category}</div>
          )}
        </div>

        <div>
          <label htmlFor="submissionDeadline" className="block text-sm font-medium text-gray-700">
            Submission Deadline
          </label>
          <input
            type="datetime-local"
            id="submissionDeadline"
            name="submissionDeadline"
            className="input mt-1"
            value={formik.values.submissionDeadline}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.submissionDeadline && formik.errors.submissionDeadline && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.submissionDeadline}</div>
          )}
        </div>
        
        <div className="col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className="input mt-1"
            placeholder="Enter tender description"
            value={formik.values.description}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.description && formik.errors.description && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.description}</div>
          )}
        </div>
        
        <div className="col-span-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isReservedForMSE"
              name="isReservedForMSE"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              checked={formik.values.isReservedForMSE}
              onChange={formik.handleChange}
            />
            <label htmlFor="isReservedForMSE" className="ml-2 block text-sm text-gray-700">
              Reserve for MSE vendors only
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Creating...' : 'Create Tender'}
        </button>
      </div>
    </form>
  );
}