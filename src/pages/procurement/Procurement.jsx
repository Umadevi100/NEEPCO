import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import TenderForm from './TenderForm';

export default function Procurement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const isProcurementOfficer = hasRole('procurement_officer') || hasRole('admin');
  const isVendor = hasRole('vendor');

  const { data: tenders, isLoading } = useQuery({
    queryKey: ['tenders', filterStatus],
    queryFn: async () => {
      try {
        let query = supabase
          .from('tenders')
          .select(`
            *,
            bids!bids_tender_id_fkey (
              id,
              status
            )
          `);
          
        // Filter by status if needed
        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
          
        if (error) throw error;
        
        return data || [];
      } catch (error) {
        console.error('Error fetching tenders:', error);
        toast.error('Failed to load tenders');
        return [];
      }
    },
  });

  const updateTenderStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      if (!id) {
        throw new Error('Tender ID is required');
      }
      
      const { data, error } = await supabase
        .from('tenders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenders']);
      toast.success('Tender status updated successfully');
    },
    onError: (error) => {
      console.error('Error updating tender status:', error);
      toast.error(error.message || 'Failed to update tender status');
    }
  });

  const handleTenderCreated = () => {
    setShowCreateForm(false);
    queryClient.invalidateQueries(['tenders']);
  };

  const handleStatusChange = (id, newStatus) => {
    updateTenderStatus.mutate({ id, status: newStatus });
  };

  const handleViewDetails = (id) => {
    navigate(`/procurement/${id}`);
  };

  // Count tenders by status
  const draftCount = tenders?.filter(t => t.status === 'draft').length || 0;
  const publishedCount = tenders?.filter(t => t.status === 'published').length || 0;
  const underReviewCount = tenders?.filter(t => t.status === 'under_review').length || 0;
  const awardedCount = tenders?.filter(t => t.status === 'awarded').length || 0;
  const cancelledCount = tenders?.filter(t => t.status === 'cancelled').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Procurement Management</h1>
        {isProcurementOfficer && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary"
          >
            {showCreateForm ? 'Cancel' : 'Create New Tender'}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Tender</h2>
          <TenderForm onSuccess={handleTenderCreated} />
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div 
          className={`card cursor-pointer ${filterStatus === 'all' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          <h3 className="text-lg font-medium text-gray-900">All Tenders</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{tenders?.length || 0}</p>
        </div>
        
        {isProcurementOfficer && (
          <div 
            className={`card cursor-pointer ${filterStatus === 'draft' ? 'ring-2 ring-gray-500' : ''}`}
            onClick={() => setFilterStatus('draft')}
          >
            <h3 className="text-lg font-medium text-gray-900">Draft</h3>
            <p className="mt-2 text-3xl font-bold text-gray-600">{draftCount}</p>
          </div>
        )}
        
        <div 
          className={`card cursor-pointer ${filterStatus === 'published' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setFilterStatus('published')}
        >
          <h3 className="text-lg font-medium text-gray-900">Published</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">{publishedCount}</p>
        </div>
        
        <div 
          className={`card cursor-pointer ${filterStatus === 'under_review' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setFilterStatus('under_review')}
        >
          <h3 className="text-lg font-medium text-gray-900">Under Review</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600">{underReviewCount}</p>
        </div>
        
        <div 
          className={`card cursor-pointer ${filterStatus === 'awarded' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilterStatus('awarded')}
        >
          <h3 className="text-lg font-medium text-gray-900">Awarded</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">{awardedCount}</p>
        </div>

        <div 
          className={`card cursor-pointer ${filterStatus === 'cancelled' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilterStatus('cancelled')}
        >
          <h3 className="text-lg font-medium text-gray-900">Cancelled</h3>
          <p className="mt-2 text-3xl font-bold text-red-600">{cancelledCount}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {filterStatus === 'all' ? 'All Tenders' : 
           filterStatus === 'draft' ? 'Draft Tenders' :
           filterStatus === 'published' ? 'Published Tenders' :
           filterStatus === 'under_review' ? 'Tenders Under Review' :
           filterStatus === 'awarded' ? 'Awarded Tenders' :
           'Cancelled Tenders'}
        </h2>
        
        {isLoading ? (
          <LoadingSpinner />
        ) : tenders && tenders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estimated Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission Deadline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bids
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenders.map((tender) => {
                  // Check if deadline has passed
                  const isDeadlinePassed = new Date(tender.submission_deadline) < new Date();
                  
                  // Only show published, under_review, and awarded tenders to vendors
                  if (isVendor && tender.status === 'draft') {
                    return null;
                  }
                  
                  // For MSE reserved tenders, add a special indicator
                  const isMSEReserved = tender.is_reserved_for_mse;
                  
                  return (
                    <tr key={tender.id}>
                      <td className="px-6 py-4">
                        <div>
                          {tender.title}
                          {isMSEReserved && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                              MSE Only
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {tender.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="capitalize">{tender.category || 'Goods'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{tender.estimated_value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(tender.submission_deadline), 'PPp')}
                        {isDeadlinePassed && (
                          <span className="ml-2 text-xs text-red-600">(Passed)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tender.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : tender.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : tender.status === 'under_review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : tender.status === 'awarded'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tender.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tender.bids?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewDetails(tender.id)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View Details
                          </button>
                          
                          {isProcurementOfficer && tender.status === 'draft' && (
                            <button
                              onClick={() => handleStatusChange(tender.id, 'published')}
                              className="text-green-600 hover:text-green-900"
                            >
                              Publish
                            </button>
                          )}
                          
                          {isProcurementOfficer && tender.status === 'published' && !isDeadlinePassed && (
                            <button
                              onClick={() => handleStatusChange(tender.id, 'draft')}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Unpublish
                            </button>
                          )}
                          
                          {isProcurementOfficer && tender.status === 'published' && (
                            <button
                              onClick={() => handleStatusChange(tender.id, 'under_review')}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              Review
                            </button>
                          )}
                          
                          {isProcurementOfficer && tender.status !== 'cancelled' && tender.status !== 'awarded' && (
                            <button
                              onClick={() => handleStatusChange(tender.id, 'cancelled')}
                              className="text-red-600 hover:text-red-900"
                            >
                              Cancel
                            </button>
                          )}
                          
                          {isProcurementOfficer && tender.status === 'cancelled' && (
                            <button
                              onClick={() => handleStatusChange(tender.id, 'draft')}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {filterStatus === 'all' 
              ? 'No tenders found.'
              : `No ${filterStatus.replace('_', ' ')} tenders found.`}
          </div>
        )}
      </div>

      {isProcurementOfficer && (
        <div className="card bg-blue-50">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Tender Status Management</h2>
          <div className="prose max-w-none text-blue-800">
            <p>As a procurement officer, you can manage tenders through their lifecycle:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Draft:</strong> Initial state, only visible to procurement officers</li>
              <li><strong>Published:</strong> Visible to vendors who can submit bids</li>
              <li><strong>Under Review:</strong> Bidding closed, procurement team evaluating bids</li>
              <li><strong>Awarded:</strong> Tender has been awarded to a vendor</li>
              <li><strong>Cancelled:</strong> Tender has been cancelled</li>
            </ul>
            <p className="mt-4">
              <strong>Note:</strong> Changing the status to "Published" will make a tender visible to all vendors who can then submit bids until the submission deadline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}