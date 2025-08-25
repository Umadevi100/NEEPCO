import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Link } from 'react-router-dom';

function Compliance() {
  // Fetch compliance metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['compliance-metrics'],
    queryFn: async () => {
      try {
        // Get procurement compliance
        const { data: tenders } = await supabase
          .from('tenders')
          .select('status')
          .order('created_at', { ascending: false })
          .limit(100);

        // Get vendor compliance
        const { data: vendors } = await supabase
          .from('vendors')
          .select('status, compliance_score')
          .order('created_at', { ascending: false })
          .limit(100);

        // Get MSE vendor engagement
        const { data: mseVendors } = await supabase
          .from('vendors')
          .select('id')
          .eq('business_type', 'MSE')
          .eq('status', 'Active');

        // Get payment compliance
        const { data: payments } = await supabase
          .from('payments')
          .select('status')
          .order('created_at', { ascending: false })
          .limit(100);

        return {
          procurement: {
            total: tenders?.length || 0,
            compliant: tenders?.filter(t => ['published', 'under_review', 'awarded'].includes(t.status)).length || 0
          },
          vendor: {
            total: vendors?.length || 0,
            compliant: vendors?.filter(v => v.compliance_score >= 70).length || 0,
            pending: vendors?.filter(v => v.status === 'Pending').length || 0
          },
          mse: {
            total: mseVendors?.length || 0,
            active: mseVendors?.filter(v => v.status === 'Active').length || 0
          },
          payments: {
            total: payments?.length || 0,
            completed: payments?.filter(p => p.status === 'completed').length || 0,
            pending: payments?.filter(p => p.status === 'pending').length || 0
          }
        };
      } catch (error) {
        console.error('Error fetching compliance metrics:', error);
        return null;
      }
    }
  });

  // Fetch action logs
  const { data: actionLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['action-logs'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('action_logs')
          .select(`
            *,
            profiles:user_id (
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching action logs:', error);
        return [];
      }
    }
  });

  if (isLoadingMetrics || isLoadingLogs) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Compliance & Audit</h1>

      <section className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Compliance Dashboard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Procurement Compliance</h3>
            <p className="mt-2 text-lg font-semibold text-green-600">
              {metrics?.procurement ? (
                `${Math.round((metrics.procurement.compliant / metrics.procurement.total) * 100)}%`
              ) : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {metrics?.procurement?.compliant || 0} out of {metrics?.procurement?.total || 0} compliant
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Vendor Payment Compliance</h3>
            <p className="mt-2 text-lg font-semibold text-yellow-600">
              {metrics?.payments ? (
                `${Math.round((metrics.payments.completed / metrics.payments.total) * 100)}%`
              ) : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {metrics?.payments?.pending || 0} payments pending
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">MSE Vendor Engagement</h3>
            <p className="mt-2 text-lg font-semibold text-green-600">
              {metrics?.mse ? (
                `${Math.round((metrics.mse.active / metrics.mse.total) * 100)}%`
              ) : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {metrics?.mse?.active || 0} active MSE vendors
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Vendor Compliance</h3>
            <p className="mt-2 text-lg font-semibold text-green-600">
              {metrics?.vendor ? (
                `${Math.round((metrics.vendor.compliant / metrics.vendor.total) * 100)}%`
              ) : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {metrics?.vendor?.compliant || 0} vendors above 70% score
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Audit Log
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {actionLogs?.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(log.created_at), 'PPp')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.profiles ? (
                      `${log.profiles.first_name} ${log.profiles.last_name}`
                    ) : (
                      'System'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.action_type === 'status_change'
                        ? 'bg-blue-100 text-blue-800'
                        : log.action_type === 'technical_score_update'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {log.action_type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {log.action_type === 'status_change' && (
                      <div>
                        {log.entity_type === 'tender' && (
                          <>
                            Tender "{log.details.tender_title}" status changed from{' '}
                            <span className="font-medium">{log.details.previous_status.replace('_', ' ')}</span> to{' '}
                            <span className="font-medium">{log.details.new_status.replace('_', ' ')}</span>
                          </>
                        )}
                        {log.entity_type === 'bid' && (
                          <>
                            Bid for "{log.details.tender_title}" status changed from{' '}
                            <span className="font-medium">{log.details.previous_status.replace('_', ' ')}</span> to{' '}
                            <span className="font-medium">{log.details.new_status.replace('_', ' ')}</span>
                          </>
                        )}
                      </div>
                    )}
                    {log.action_type === 'technical_score_update' && (
                      <div>
                        Technical score for bid on "{log.details.tender_title}" updated to{' '}
                        <span className="font-medium">{log.details.new_score}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Compliance Documents
        </h2>
        <ul className="space-y-2">
          <li>
            <Link
              to="/docs/procurement-policy"
              className="text-primary-600 hover:text-primary-900"
            >
              Procurement Policy Document
            </Link>
          </li>
          <li>
            <Link
              to="/docs/vendor-compliance"
              className="text-primary-600 hover:text-primary-900"
            >
              Vendor Compliance Guide
            </Link>
          </li>
          <li>
            <Link
              to="/docs/audit-guidelines"
              className="text-primary-600 hover:text-primary-900"
            >
              Audit Guidelines
            </Link>
          </li>
          <li>
            <Link
              to="/docs/mse-policy"
              className="text-primary-600 hover:text-primary-900"
            >
              MSE Participation Policy
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Compliance;