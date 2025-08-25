import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import VendorPaymentForm from './VendorPaymentForm';

export default function Payments() {
  const [filter, setFilter] = useState('all');
  const { hasRole, user } = useAuth();
  const isProcurementOfficer = hasRole('procurement_officer') || hasRole('admin');
  const isFinanceOfficer = hasRole('finance_officer') || hasRole('procurement_officer') || hasRole('admin');
  const isVendor = hasRole('vendor');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', filter],
    queryFn: async () => {
      try {
        let query = supabase
          .from('payments')
          .select(`
            *,
            vendors (
              name,
              business_type
            ),
            related_tender (
              id,
              title
            ),
            related_bid (
              id
            )
          `)
          .order('created_at', { ascending: false });

        if (filter !== 'all') {
          query = query.eq('status', filter);
        }

        // If user is a vendor, only show their payments
        if (isVendor) {
          // First get the vendor ID
          const { data: vendorData, error: vendorError } = await supabase
            .from('vendors')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (vendorError) throw vendorError;
          
          if (vendorData) {
            query = query.eq('vendor_id', vendorData.id);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching payments:', error);
        return [];
      }
    },
  });

  const handlePaymentSubmitted = () => {
    setSelectedPayment(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        {isFinanceOfficer && (
          <Link
            to="/payments/create"
            className="btn btn-primary"
          >
            Create Payment
          </Link>
        )}
      </div>

      {/* Payment Form Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Process Payment</h3>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Payment Details</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-blue-700">Amount:</dt>
                  <dd className="text-sm font-semibold text-blue-800">₹{selectedPayment.amount.toLocaleString()}</dd>
                </div>
                {selectedPayment.related_tender && (
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-blue-700">For Tender:</dt>
                    <dd className="text-sm text-blue-800">{selectedPayment.related_tender.title}</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <VendorPaymentForm 
              payment={selectedPayment} 
              onSuccess={handlePaymentSubmitted} 
            />
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Payment History</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('processing')}
              className={`btn ${filter === 'processing' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Processing
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Completed
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <LoadingSpinner />
        ) : payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Related Tender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.vendors?.name || 'Unknown Vendor'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {payment.vendors?.business_type || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ₹{payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : payment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : payment.status === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.related_tender ? (
                        <Link 
                          to={`/procurement/${payment.related_tender.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          {payment.related_tender.title}
                        </Link>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(new Date(payment.created_at), 'PPp')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <Link
                          to={`/payments/${payment.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Details
                        </Link>
                        
                        {/* For vendors, show Pay Now button for pending payments */}
                        {isVendor && payment.status === 'pending' && (
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Pay Now
                          </button>
                        )}
                        
                        {/* For finance officers, show process button for pending payments */}
                        {isFinanceOfficer && payment.status === 'pending' && (
                          <Link
                            to={`/payments/${payment.id}`}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Process
                          </Link>
                        )}
                        
                        {/* For finance officers, show complete button for processing payments */}
                        {isFinanceOfficer && payment.status === 'processing' && (
                          <Link
                            to={`/payments/${payment.id}`}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Complete
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600">No payments found.</p>
          </div>
        )}
      </div>

      {isFinanceOfficer && (
        <div className="card bg-blue-50">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Payment Management</h2>
          <div className="prose max-w-none text-blue-800">
            <p>As a finance officer, you can manage payments through their lifecycle:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Pending:</strong> Initial state, payment has been created but not processed</li>
              <li><strong>Processing:</strong> Payment is being processed</li>
              <li><strong>Completed:</strong> Payment has been successfully processed</li>
              <li><strong>Failed:</strong> Payment processing failed</li>
            </ul>
            <p className="mt-4">
              <strong>Note:</strong> You can create payments for awarded tenders directly from the tender details page.
            </p>
          </div>
        </div>
      )}

      {isVendor && (
        <div className="card bg-blue-50">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Payment Instructions</h2>
          <div className="prose max-w-none text-blue-800">
            <p>As a vendor, you can process your pending payments:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Pending:</strong> Payments that require your action. Click "Pay Now" to process.</li>
              <li><strong>Processing:</strong> Payments that are being verified by the finance team.</li>
              <li><strong>Completed:</strong> Payments that have been successfully processed.</li>
            </ul>
            <p className="mt-4">
              <strong>Note:</strong> Make sure to provide accurate transaction details when processing payments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}