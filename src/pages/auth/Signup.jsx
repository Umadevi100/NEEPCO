import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

const signupSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
  role: Yup.string()
    .oneOf(['vendor', 'procurement_officer'], 'Invalid role')
    .required('Role is required'),
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  department: Yup.string().when('role', {
    is: (role) => role !== 'vendor',
    then: (schema) => schema.required('Department is required'),
    otherwise: (schema) => schema.optional(),
  }),
  employeeId: Yup.string().when('role', {
    is: (role) => role !== 'vendor',
    then: (schema) => schema.required('Employee ID is required'),
    otherwise: (schema) => schema.optional(),
  }),
  // Vendor specific fields
  businessName: Yup.string().when('role', {
    is: 'vendor',
    then: (schema) => schema.required('Business name is required'),
    otherwise: (schema) => schema.optional(),
  }),
  businessType: Yup.string().when('role', {
    is: 'vendor',
    then: (schema) => schema.oneOf(['MSE', 'Large Enterprise'], 'Please select a valid business type').required('Business type is required'),
    otherwise: (schema) => schema.optional(),
  }),
  phone: Yup.string().when('role', {
    is: 'vendor',
    then: (schema) => schema.required('Phone number is required'),
    otherwise: (schema) => schema.optional(),
  }),
  address: Yup.string().when('role', {
    is: 'vendor',
    then: (schema) => schema.required('Address is required'),
    otherwise: (schema) => schema.optional(),
  }),
  mseCertificate: Yup.string().when(['role', 'businessType'], {
    is: (role, businessType) => role === 'vendor' && businessType === 'MSE',
    then: (schema) => schema.required('MSE certificate number is required'),
    otherwise: (schema) => schema.optional(),
  }),
});

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError(null);
      
      // Prepare user metadata with all relevant fields
      const userMetadata = {
        role: values.role,
        firstName: values.firstName,
        lastName: values.lastName,
        department: values.department,
        employeeId: values.employeeId,
        hasVendorProfile: false // Initially set to false until vendor completes profile
      };
      
      // Add vendor specific fields to metadata if role is vendor
      if (values.role === 'vendor') {
        userMetadata.businessName = values.businessName;
        userMetadata.businessType = values.businessType;
        userMetadata.contactPerson = `${values.firstName} ${values.lastName}`;
        userMetadata.phone = values.phone;
        userMetadata.address = values.address;
        userMetadata.mseCertificate = values.mseCertificate;
      }
      
      // First, create the user account with metadata
      const { data, error: signUpError } = await signUp({
        email: values.email,
        password: values.password,
        options: {
          data: userMetadata
        }
      });
      
      if (signUpError) {
        // Handle specific error codes
        if (signUpError.code === 'user_already_exists') {
          throw new Error('An account with this email already exists. Please use a different email or try logging in.');
        }
        throw signUpError;
      }
      
      if (values.role === 'vendor') {
        toast.success('Account created successfully! Please complete your vendor profile.');
        navigate('/vendor-verification');
      } else {
        toast.success('Account created successfully! Please check your email for confirmation.');
        navigate('/login');
      }
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'An error occurred during signup. Please try again.';
      
      if (error.status === 503) {
        errorMessage = 'Connection to authentication service failed. Please try again later.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. This could be due to a temporary service issue.';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'user_already_exists') {
        errorMessage = 'An account with this email already exists. Please use a different email or try logging in.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Formik
            initialValues={{
              email: '',
              password: '',
              confirmPassword: '',
              role: '',
              firstName: '',
              lastName: '',
              department: '',
              employeeId: '',
              businessName: '',
              businessType: '',
              phone: '',
              address: '',
              mseCertificate: '',
            }}
            validationSchema={signupSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched, values, isSubmitting }) => (
              <Form className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <Field
                      as="select"
                      name="role"
                      className="input mt-1"
                    >
                      <option value="">Select a role</option>
                      <option value="vendor">Vendor</option>
                      <option value="procurement_officer">Procurement Officer</option>
                    </Field>
                    {errors.role && touched.role && (
                      <div className="mt-1 text-sm text-red-600">{errors.role}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                        First Name
                      </label>
                      <Field
                        name="firstName"
                        type="text"
                        className="input mt-1"
                        placeholder="Enter your first name"
                      />
                      {errors.firstName && touched.firstName && (
                        <div className="mt-1 text-sm text-red-600">{errors.firstName}</div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                        Last Name
                      </label>
                      <Field
                        name="lastName"
                        type="text"
                        className="input mt-1"
                        placeholder="Enter your last name"
                      />
                      {errors.lastName && touched.lastName && (
                        <div className="mt-1 text-sm text-red-600">{errors.lastName}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <Field
                      name="email"
                      type="email"
                      className="input mt-1"
                      placeholder="Enter your email"
                    />
                    {errors.email && touched.email && (
                      <div className="mt-1 text-sm text-red-600">{errors.email}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <div className="mt-1 relative">
                        <Field
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="input pr-10"
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                      {errors.password && touched.password && (
                        <div className="mt-1 text-sm text-red-600">{errors.password}</div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                        Confirm Password
                      </label>
                      <Field
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        className="input mt-1"
                        placeholder="Confirm password"
                      />
                      {errors.confirmPassword && touched.confirmPassword && (
                        <div className="mt-1 text-sm text-red-600">{errors.confirmPassword}</div>
                      )}
                    </div>
                  </div>

                  {values.role !== 'vendor' && (
                    <>
                      <div>
                        <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                          Department
                        </label>
                        <Field
                          name="department"
                          type="text"
                          className="input mt-1"
                          placeholder="Enter your department"
                        />
                        {errors.department && touched.department && (
                          <div className="mt-1 text-sm text-red-600">{errors.department}</div>
                        )}
                      </div>

                      <div>
                        <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                          Employee ID
                        </label>
                        <Field
                          name="employeeId"
                          type="text"
                          className="input mt-1"
                          placeholder="Enter your employee ID"
                        />
                        {errors.employeeId && touched.employeeId && (
                          <div className="mt-1 text-sm text-red-600">{errors.employeeId}</div>
                        )}
                      </div>
                    </>
                  )}

                  {values.role === 'vendor' && (
                    <>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Vendor Registration</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                              <p>
                                Please provide your business information below. Your account will require approval from a procurement officer before you can access the system.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                          Business Name
                        </label>
                        <Field
                          name="businessName"
                          type="text"
                          className="input mt-1"
                          placeholder="Enter your business name"
                        />
                        {errors.businessName && touched.businessName && (
                          <div className="mt-1 text-sm text-red-600">{errors.businessName}</div>
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
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <Field
                          name="phone"
                          type="text"
                          className="input mt-1"
                          placeholder="Enter your phone number"
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
                          placeholder="Enter your business address"
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
                            placeholder="Enter your MSE certificate number"
                          />
                          {errors.mseCertificate && touched.mseCertificate && (
                            <div className="mt-1 text-sm text-red-600">{errors.mseCertificate}</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating Account...' : 'Sign Up'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>

          <div className="mt-6 text-sm text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-500">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}