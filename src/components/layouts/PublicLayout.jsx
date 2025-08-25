import { Outlet, Link } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-700 text-white">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">
              NEEPCO
            </Link>
            <div className="space-x-4">
              <Link to="/about" className="text-white hover:text-primary-200">About Us</Link>
              <Link to="/login" className="text-white hover:text-primary-200">Login</Link>
              <Link to="/signup" className="text-white hover:text-primary-200">Sign Up</Link>
            </div>
          </div>
        </nav>
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