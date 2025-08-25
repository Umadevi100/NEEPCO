import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';

export default function RoleBasedRoute({ children, requiredRoles = [] }) {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  // If no user is logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If no specific roles are required, allow access
  if (requiredRoles.length === 0) {
    return children;
  }

  // Check if user has any of the required roles
  const hasRequiredRole = requiredRoles.some(role => hasRole(role));

  if (!hasRequiredRole) {
    // Redirect to dashboard with access denied message
    return <Navigate to="/" replace />;
  }

  return children;
}