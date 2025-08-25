import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '../../lib/api/reports';

export default function DashboardMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: getDashboardMetrics,
  });

  if (isLoading) {
    return <div>Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tender Overview</h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-600">Total Tenders</dt>
            <dd className="font-semibold">{metrics.tenders.total}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Published</dt>
            <dd className="font-semibold text-green-600">{metrics.tenders.published}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Under Review</dt>
            <dd className="font-semibold text-yellow-600">{metrics.tenders.underReview}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Awarded</dt>
            <dd className="font-semibold text-blue-600">{metrics.tenders.awarded}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Overview</h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-600">Total Vendors</dt>
            <dd className="font-semibold">{metrics.vendors.total}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">MSE Vendors</dt>
            <dd className="font-semibold text-green-600">{metrics.vendors.mse}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Active Vendors</dt>
            <dd className="font-semibold text-blue-600">{metrics.vendors.active}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Overview</h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-600">Total Amount</dt>
            <dd className="font-semibold">₹{metrics.payments.total.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Completed Payments</dt>
            <dd className="font-semibold text-green-600">{metrics.payments.completed}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Pending Payments</dt>
            <dd className="font-semibold text-yellow-600">{metrics.payments.pending}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}