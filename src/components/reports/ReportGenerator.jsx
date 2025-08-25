import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  generateProcurementReport,
  generateVendorReport,
  generatePaymentReport,
} from '../../lib/api/reports';

export default function ReportGenerator() {
  const [reportType, setReportType] = useState('procurement');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    businessType: '',
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', reportType, filters],
    queryFn: () => {
      switch (reportType) {
        case 'procurement':
          return generateProcurementReport(filters);
        case 'vendor':
          return generateVendorReport(filters);
        case 'payment':
          return generatePaymentReport(filters);
        default:
          throw new Error('Invalid report type');
      }
    },
    enabled: Boolean(reportType),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    setFilters({
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      status: formData.get('status'),
      businessType: formData.get('businessType'),
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700">
              Report Type
            </label>
            <select
              id="reportType"
              name="reportType"
              className="input mt-1"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="procurement">Procurement Report</option>
              <option value="vendor">Vendor Report</option>
              <option value="payment">Payment Report</option>
            </select>
          </div>

          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              className="input mt-1"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              className="input mt-1"
            />
          </div>

          {reportType === 'vendor' && (
            <div>
              <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
                Business Type
              </label>
              <select
                id="businessType"
                name="businessType"
                className="input mt-1"
              >
                <option value="">All</option>
                <option value="MSE">MSE</option>
                <option value="Large Enterprise">Large Enterprise</option>
              </select>
            </div>
          )}

          {(reportType === 'procurement' || reportType === 'payment') && (
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                className="input mt-1"
              >
                <option value="">All</option>
                {reportType === 'procurement' ? (
                  <>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="under_review">Under Review</option>
                    <option value="awarded">Awarded</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                ) : (
                  <>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-primary">
            Generate Report
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="text-center py-4">Generating report...</div>
      ) : report ? (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {reportType === 'procurement' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bids
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                    </>
                  )}
                  {reportType === 'vendor' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bids
                      </th>
                    </>
                  )}
                  {reportType === 'payment' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.map((item) => (
                  <tr key={item.id}>
                    {reportType === 'procurement' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">{item.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'draft'
                              ? 'bg-gray-100 text-gray-800'
                              : item.status === 'under_review'
                              ? 'bg-yellow-100 text-yellow-800'
                              : item.status === 'awarded'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.bids?.length || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {format(new Date(item.created_at), 'PPp')}
                        </td>
                      </>
                    )}
                    {reportType === 'vendor' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.business_type === 'MSE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.business_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'Pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.bids?.length || 0}
                        </td>
                      </>
                    )}
                    {reportType === 'payment' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.invoices?.invoice_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.invoices?.vendors?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : item.status === 'processing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}