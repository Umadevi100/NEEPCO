import { Link } from 'react-router-dom';

function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-700 text-white">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">
              NEEPCO
            </Link>
            <div className="space-x-4">
              <Link to="/" className="text-white hover:text-primary-200">Home</Link>
              <Link to="/about" className="text-white hover:text-primary-200">About Us</Link>
              <Link to="/login" className="text-white hover:text-primary-200">Login</Link>
              <Link to="/signup" className="text-white hover:text-primary-200">Sign Up</Link>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            About NEEPCO Procurement Portal
          </h1>
          
          <div className="prose max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              The NEEPCO Procurement Portal is designed to streamline and simplify the procurement
              process for NEEPCO (North Eastern Electric Power Corporation Limited) by providing
              a user-friendly platform for managing procurement activities, vendor relationships,
              and payments. Our portal aims to ensure transparency, compliance, and efficiency
              in all procurement-related tasks.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Our Mission</h2>
            <p className="text-gray-700 mb-6">
              To create a seamless and efficient procurement system that enhances operational
              effectiveness, reduces delays, and fosters stronger partnerships with vendors,
              while ensuring compliance with governmental and organizational regulations.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              Features of the Portal
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
              <li>
                <strong>Procurement Management:</strong> Simplified purchase order creation
                and vendor selection process.
              </li>
              <li>
                <strong>Vendor Management:</strong> Centralized database to track vendor
                performance, contact details, and compliance statuses.
              </li>
              <li>
                <strong>Payment Tracking:</strong> Real-time updates on payment statuses
                and due amounts for vendors.
              </li>
              <li>
                <strong>Reports and Compliance:</strong> Generating procurement-related
                reports and ensuring adherence to regulatory requirements.
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              Why Choose Us?
            </h2>
            <p className="text-gray-700">
              Our portal is designed to provide greater transparency, increase procurement
              efficiency, and improve decision-making. We ensure that all procurement
              activities are documented, monitored, and optimized for the best possible
              outcomes.
            </p>
          </div>
        </div>
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

export default About;