import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbHelpers } from '../../lib/db';

export default function MSEFacilitation() {
  const [showGuide, setShowGuide] = useState(false);

  const { data: mseVendors, isLoading } = useQuery({
    queryKey: ['mse-vendors'],
    queryFn: async () => {
      const vendors = await dbHelpers.getVendors();
      return vendors.filter(vendor => vendor.business_type === 'MSE');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">MSE Facilitation</h1>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="btn btn-primary"
        >
          {showGuide ? 'Hide Guide' : 'Show MSE Guide'}
        </button>
      </div>

      {showGuide && (
        <div className="card bg-blue-50">
          <h2 className="text-xl font-semibold text-primary-900 mb-4">
            MSE Onboarding Guide
          </h2>
          <div className="prose max-w-none text-primary-800">
            <h3 className="text-lg font-medium mb-2">Benefits for MSE Vendors</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Simplified registration process</li>
              <li>Priority in tender participation</li>
              <li>Relaxed eligibility criteria</li>
              <li>Dedicated support team</li>
              <li>Special payment terms</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Required Documents</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>MSE Registration Certificate</li>
              <li>Business PAN Card</li>
              <li>GST Registration (if applicable)</li>
              <li>Bank Account Details</li>
            </ul>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          MSE Vendor Directory
        </h2>
        
        {isLoading ? (
          <div className="text-center py-4">Loading MSE vendors...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MSE Certificate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Support Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mseVendors?.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.mse_certificate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        vendor.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : vendor.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-primary-600">Active Support</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Priority Procurement
          </h2>
          <div className="prose max-w-none">
            <p>
              MSE vendors receive priority consideration in procurement processes:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Exclusive MSE tender categories</li>
              <li>Reserved quota in general tenders</li>
              <li>Price preference policies</li>
              <li>Relaxed technical criteria</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Support Resources
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">Documentation Support</h3>
              <p className="mt-1 text-gray-600">
                Get assistance with tender documentation and compliance requirements
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Technical Guidance</h3>
              <p className="mt-1 text-gray-600">
                Access technical support for meeting tender specifications
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Financial Advisory</h3>
              <p className="mt-1 text-gray-600">
                Guidance on financial requirements and payment terms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}