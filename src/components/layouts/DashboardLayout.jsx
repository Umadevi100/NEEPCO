import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, DocumentTextIcon, UserGroupIcon, BuildingStorefrontIcon, CreditCardIcon, ChartBarIcon, ShieldCheckIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks';
import { NotificationBell } from '../ui';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, hasRole } = useAuth();

  // Define navigation items with role-based access
  const navigationItems = [
    { name: 'Dashboard', path: '/', icon: HomeIcon, roles: ['admin', 'procurement_officer', 'vendor'] },
    { name: 'Procurement', path: '/procurement', icon: DocumentTextIcon, roles: ['admin', 'procurement_officer'] },
    { name: 'Tenders', path: '/tenders', icon: DocumentTextIcon, roles: ['vendor'] },
    { name: 'Vendors', path: '/vendors', icon: UserGroupIcon, roles: ['admin', 'procurement_officer'] },
    { name: 'MSE Facilitation', path: '/mse-facilitation', icon: BuildingStorefrontIcon, roles: ['admin', 'procurement_officer'] },
    { name: 'Payments', path: '/payments', icon: CreditCardIcon, roles: ['admin', 'procurement_officer', 'vendor'] },
    { name: 'Reports', path: '/reports', icon: ChartBarIcon, roles: ['admin', 'procurement_officer'] },
    { name: 'Compliance', path: '/compliance', icon: ShieldCheckIcon, roles: ['admin', 'procurement_officer'] },
    { name: 'Profile', path: '/profile', icon: UserIcon, roles: ['admin', 'procurement_officer', 'vendor'] },
  ];

  // Filter navigation items based on user role
  const filteredNavigation = navigationItems.filter(item => {
    return item.roles.some(role => hasRole(role));
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Get user role for display
  const userRole = user?.user_metadata?.role || 'user';
  const formattedRole = userRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold">
                NEEPCO
              </Link>
            </div>
            <nav className="hidden md:flex items-center space-x-4">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-primary-800 text-white'
                        : 'text-primary-100 hover:bg-primary-600'
                    }`}
                  >
                    <item.icon className="h-5 w-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
              {user && (
                <div className="flex items-center space-x-4">
                  {/* Add notification bell */}
                  {(hasRole('admin') || hasRole('procurement_officer')) && (
                    <NotificationBell />
                  )}
                  <span className="text-sm text-primary-100">
                    {formattedRole}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-primary-100 hover:bg-primary-600"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-gray-800 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm">
            © 2024 NEEPCO |{' '}
            <Link to="/terms" className="hover:text-primary-300">
              Terms & Conditions
            </Link>{' '}
            |{' '}
            <Link to="/privacy" className="hover:text-primary-300">
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}