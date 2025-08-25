import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks';
import { DashboardLayout, PublicLayout } from './components/layouts';
import { ProtectedRoute, RoleBasedRoute } from './components/auth';
import { ErrorBoundary } from './components/ui';

// Pages
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VendorVerification from './pages/auth/VendorVerification';
import PendingApproval from './pages/auth/PendingApproval';
import About from './pages/About';
import Dashboard from './pages/dashboard/Dashboard';
import Procurement from './pages/procurement/Procurement';
import TenderDetails from './pages/procurement/TenderDetails';
import VendorManagement from './pages/vendors/VendorManagement';
import VendorDetails from './pages/vendors/VendorDetails';
import MSEFacilitation from './pages/vendors/MSEFacilitation';
import Payments from './pages/payments/Payments';
import PaymentDetails from './pages/payments/PaymentDetails';
import PublicPaymentPage from './pages/payments/PublicPaymentPage';
import Reports from './pages/Reports';
import Compliance from './pages/Compliance';
import VendorProfile from './pages/profile/VendorProfile';
import ProcurementOfficerProfile from './pages/profile/ProcurementOfficerProfile';
import TenderList from './pages/vendors/TenderList';
import VendorTenderDetails from './pages/vendors/TenderDetails';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<About />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
            </Route>

            {/* Public payment page */}
            <Route path="/pay/:paymentId" element={<PublicPaymentPage />} />

            {/* Vendor verification route */}
            <Route path="/vendor-verification" element={<VendorVerification />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              
              {/* Procurement routes - accessible by procurement officers and admins */}
              <Route path="procurement" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <Procurement />
              </RoleBasedRoute>} />
              <Route path="procurement/:id" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <TenderDetails />
              </RoleBasedRoute>} />
              
              {/* Vendor management routes - accessible by procurement officers and admins */}
              <Route path="vendors" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <VendorManagement />
              </RoleBasedRoute>} />
              <Route path="vendors/:id" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <VendorDetails />
              </RoleBasedRoute>} />
              
              {/* MSE facilitation - accessible by procurement officers and admins */}
              <Route path="mse-facilitation" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <MSEFacilitation />
              </RoleBasedRoute>} />
              
              {/* Payment routes - accessible by procurement officers, vendors and admins */}
              <Route path="payments" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin', 'vendor']}>
                <Payments />
              </RoleBasedRoute>} />
              <Route path="payments/:id" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin', 'vendor']}>
                <PaymentDetails />
              </RoleBasedRoute>} />
              
              {/* Reports - accessible by procurement officers and admins */}
              <Route path="reports" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <Reports />
              </RoleBasedRoute>} />
              
              {/* Compliance - accessible by procurement officers and admins */}
              <Route path="compliance" element={<RoleBasedRoute requiredRoles={['procurement_officer', 'admin']}>
                <Compliance />
              </RoleBasedRoute>} />
              
              {/* Profile - accessible by all authenticated users */}
              <Route path="profile" element={<RoleBasedProfile />} />
              
              {/* Tender routes for vendors */}
              <Route path="tenders" element={<RoleBasedRoute requiredRoles={['vendor']}>
                <TenderList />
              </RoleBasedRoute>} />
              <Route path="tenders/:id" element={<RoleBasedRoute requiredRoles={['vendor']}>
                <VendorTenderDetails />
              </RoleBasedRoute>} />
            </Route>
          </Routes>
          <Toaster position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Component to render the appropriate profile based on user role
function RoleBasedProfile() {
  const { user, hasRole } = useAuth();
  
  if (!user) return null;

  if (hasRole('vendor')) {
    return <VendorProfile />;
  }
  
  return <ProcurementOfficerProfile />;
}

export default App;