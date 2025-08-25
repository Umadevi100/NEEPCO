import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const bidSchema = Yup.object().shape({
  amount: Yup.number()
    .required('Bid amount is required')
    .positive('Bid amount must be positive'),
  notes: Yup.string(),
});

export default function BidForm({ tenderId, onSuccess, vendorId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documents, setDocuments] = useState([]);

  const formik = useFormik({
    initialValues: {
      amount: '',
      notes: '',
    },
    validationSchema: bidSchema,
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        
        if (!tenderId || !vendorId) {
          toast.error('Missing tender or vendor information');
          return;
        }
        
        // Format documents for storage
        const formattedDocuments = documents.map(doc => ({
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
            amount: parseFloat(values.amount),
            notes: values.notes,
            documents: formattedDocuments,
            status: 'submitted'
          }])
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('You have already submitted a bid for this tender');
          }
          throw error;
        }

        toast.success('Bid submitted successfully');
        formik.resetForm();
        setDocuments([]);
        onSuccess?.();
      } catch (error) {
        console.error('Error submitting bid:', error);
        toast.error(error.message || 'Failed to submit bid');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleDocumentChange = (e) => {
    const files = Array.from(e.target.files);
    setDocuments(prev => [...prev, ...files]);
  };

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
          Bid Amount (₹)
        </label>
        <input
          type="number"
          id="amount"
          name="amount"
          className="input mt-1"
          placeholder="Enter your bid amount"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.amount}
        />
        {formik.touched.amount && formik.errors.amount && (
          <div className="mt-1 text-sm text-red-600">{formik.errors.amount}</div>
        )}
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
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="input mt-1"
          placeholder="Add any additional information about your bid"
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
          {isSubmitting ? 'Submitting...' : 'Submit Bid'}
        </button>
      </div>
    </form>
  );
}