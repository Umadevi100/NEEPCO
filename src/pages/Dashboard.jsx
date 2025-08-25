import { Link } from 'react-router-dom';
import DashboardMetrics from '../components/reports/DashboardMetrics';

function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>

      <DashboardMetrics />

      {/* Quick Links */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/procurement/create"
          className="card hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-primary-700">
            Create New Purchase Order
          </h3>
          <p className="mt-2 text-gray-600">
            Start a new procurement request quickly and easily
          </p>
        </Link>

        <Link
          to="/vendors"
          className="card hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-primary-700">
            Access Vendor Information
          </h3>
          <p className="mt-2 text-gray-600">
            View and manage vendor details and relationships
          </p>
        </Link>

        <Link
          to="/payments"
          className="card hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-primary-700">
            Track Payments
          </h3>
          <p className="mt-2 text-gray-600">
            Monitor payment status and process transactions
          </p>
        </Link>
      </section>
    </div>
  );
}

export default Dashboard;