import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { LoadingSpinner } from '../ui';

export default function ProtectedRoute({ children }) {
  const { user, loading, vendorStatus } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is a vendor with pending or suspended status
  const isVendor = user.user_metadata?.role === 'vendor';
  
  // Check if vendor has completed profile verification
  const hasVendorProfile = user.user_metadata?.hasVendorProfile === true;
  
  // If vendor hasn't completed profile verification, redirect to verification page
  if (isVendor && !hasVendorProfile) {
    return <Navigate to="/vendor-verification" state={{ from: location }} replace />;
  }
  
  // If vendor profile is pending or suspended, redirect to pending approval page
  if (isVendor && (vendorStatus === 'Pending' || vendorStatus === 'Suspended')) {
    return <Navigate to="/pending-approval" state={{ from: location }} replace />;
  }

  return children;
}