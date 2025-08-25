import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const vendorVerificationSchema = Yup.object().shape({
  name: Yup.string().required('Business name is required'),
  businessType: Yup.string()
    .oneOf(['MSE', 'Large Enterprise'], 'Please select a valid business type')
    .required('Business type is required'),
  contactPerson: Yup.string().required('Contact person is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone number is required'),
  address: Yup.string().required('Address is required'),
  mseCertificate: Yup.string().when('businessType', {
    is: 'MSE',
    then: (schema) => schema.required('MSE certificate number is required'),
    otherwise: (schema) => schema.optional(),
  }),
});

export default function VendorVerification() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialValues, setInitialValues] = useState({
    name: '',
    businessType: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    mseCertificate: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if user already has a vendor profile
    const checkVendorProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data: vendor, error: vendorError } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (vendorError) {
          // Handle rate limit errors gracefully
          if (vendorError.code === '429' || vendorError.message?.includes('rate limit')) {
            console.warn('Rate limit reached, using fallback approach');
            // Continue with form without checking for existing profile
            prePopulateForm();
            setLoading(false);
            return;
          }
          
          throw vendorError;
        }

        if (vendor) {
          // If vendor profile exists, redirect to pending approval page
          navigate('/pending-approval');
          return;
        }

        // Pre-fill form with user metadata
        prePopulateForm();
      } catch (error) {
        console.error('Error checking vendor profile:', error);
        setError('Something went wrong. Please try again or contact support.');
        toast.error('Error loading profile data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    const prePopulateForm = () => {
      // Pre-fill form with user metadata if available
      if (user.user_metadata) {
        setInitialValues({
          name: user.user_metadata.businessName || '',
          businessType: user.user_metadata.businessType || '',
          contactPerson: user.user_metadata.contactPerson || `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim(),
          email: user.email || '',
          phone: user.user_metadata.phone || '',
          address: user.user_metadata.address || '',
          mseCertificate: user.user_metadata.mseCertificate || '',
        });
      }
    };

    checkVendorProfile();
  }, [user, navigate]);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError(null);
      
      if (!user) {
        toast.error('You must be logged in to complete this process');
        navigate('/login');
        return;
      }

      // Create vendor profile
      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          name: values.name,
          business_type: values.businessType,
          contact_person: values.contactPerson,
          email: values.email,
          phone: values.phone,
          address: values.address,
          mse_certificate: values.mseCertificate,
          user_id: user.id,
          status: 'Pending', // Explicitly set status to Pending
        }])
        .select()
        .single();

      if (error) {
        // Handle rate limit errors gracefully
        if (error.code === '429' || error.message?.includes('rate limit')) {
          toast.error('Service is currently busy. Please try again in a few minutes.');
          return;
        }
        throw error;
      }

      // Update user metadata to indicate vendor profile is complete
      await supabase.auth.updateUser({
        data: { hasVendorProfile: true }
      });

      toast.success('Vendor information verified successfully! Your account is pending approval.');
      navigate('/pending-approval');
    } catch (error) {
      console.error('Error creating vendor profile:', error);
      toast.error(error.message || 'Failed to create vendor profile. Please try again.');
      setError('Failed to create vendor profile. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Verify Your Vendor Information
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please review and confirm your business details before submitting for approval
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <Formik
            initialValues={initialValues}
            validationSchema={vendorVerificationSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({ errors, touched, values, isSubmitting }) => (
              <Form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Business Name
                  </label>
                  <Field
                    name="name"
                    type="text"
                    className="input mt-1"
                  />
                  {errors.name && touched.name && (
                    <div className="mt-1 text-sm text-red-600">{errors.name}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
                    Business Type
                  </label>
                  <Field
                    as="select"
                    name="businessType"
                    className="input mt-1"
                  >
                    <option value="">Select business type</option>
                    <option value="MSE">MSE (Micro and Small Enterprise)</option>
                    <option value="Large Enterprise">Large Enterprise</option>
                  </Field>
                  {errors.businessType && touched.businessType && (
                    <div className="mt-1 text-sm text-red-600">{errors.businessType}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
                    Contact Person
                  </label>
                  <Field
                    name="contactPerson"
                    type="text"
                    className="input mt-1"
                  />
                  {errors.contactPerson && touched.contactPerson && (
                    <div className="mt-1 text-sm text-red-600">{errors.contactPerson}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <Field
                    name="email"
                    type="email"
                    className="input mt-1"
                  />
                  {errors.email && touched.email && (
                    <div className="mt-1 text-sm text-red-600">{errors.email}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <Field
                    name="phone"
                    type="text"
                    className="input mt-1"
                  />
                  {errors.phone && touched.phone && (
                    <div className="mt-1 text-sm text-red-600">{errors.phone}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Business Address
                  </label>
                  <Field
                    name="address"
                    as="textarea"
                    rows={3}
                    className="input mt-1"
                  />
                  {errors.address && touched.address && (
                    <div className="mt-1 text-sm text-red-600">{errors.address}</div>
                  )}
                </div>

                {values.businessType === 'MSE' && (
                  <div>
                    <label htmlFor="mseCertificate" className="block text-sm font-medium text-gray-700">
                      MSE Certificate Number
                    </label>
                    <Field
                      name="mseCertificate"
                      type="text"
                      className="input mt-1"
                    />
                    {errors.mseCertificate && touched.mseCertificate && (
                      <div className="mt-1 text-sm text-red-600">{errors.mseCertificate}</div>
                    )}
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Approval Notice</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Your vendor account will require approval from a procurement officer before you can access the system. You'll be notified once your account is approved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Verify and Submit for Approval'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}