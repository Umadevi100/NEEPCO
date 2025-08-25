import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

const loginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError(null);
      const { user } = await signIn(values);
      
      // Show welcome message with role
      const role = user?.user_metadata?.role || 'user';
      const formattedRole = role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      toast.success(`Welcome! You are logged in as ${formattedRole}`);
      
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'An error occurred during login. Please try again.';
      
      if (error.status === 503 || error.status === 500) {
        errorMessage = 'Connection to authentication service failed. Please try again later.';
      } else if (error.status === 429) {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.status === 400 && error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Login to Your Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {location.state?.message && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {location.state.message}
            </div>
          )}

          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={loginSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched, isSubmitting }) => (
              <Form className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="mt-1">
                    <Field
                      name="email"
                      type="email"
                      className="input"
                      placeholder="Enter your email"
                    />
                    {errors.email && touched.email && (
                      <div className="mt-1 text-sm text-red-600">{errors.email}</div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <Field
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                    {errors.password && touched.password && (
                      <div className="mt-1 text-sm text-red-600">{errors.password}</div>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn btn-primary"
                  >
                    {isSubmitting ? 'Logging in...' : 'Login'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>

          <div className="mt-6">
            <div className="text-sm text-center">
              <Link to="/forgot-password" className="text-primary-600 hover:text-primary-500">
                Forgot your password?
              </Link>
            </div>
            <div className="mt-2 text-sm text-center">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary-600 hover:text-primary-500">
                Sign up here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}