import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import VendorApprovalList from '../../components/vendors/VendorApprovalList';

const vendorSchema = Yup.object().shape({
  name: Yup.string().required('Vendor name is required'),
  businessType: Yup.string().oneOf(['MSE', 'Large Enterprise']).required('Business type is required'),
  contactPerson: Yup.string().required('Contact person is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone number is required'),
  address: Yup.string().required('Address is required'),
  mseCertificate: Yup.string().when('businessType', {
    is: 'MSE',
    then: (schema) => schema.required('MSE certificate number is required'),
    otherwise: (schema) => schema.optional(),
  }),
});

export default function VendorManagement() {
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select(`
            *,
            approved_by:profiles!vendors_approved_by_fkey(
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching vendors:', error);
        toast.error('Failed to load vendors');
        return [];
      }
    },
  });

  const { data: pendingVendors, isLoading: isLoadingPending } = useQuery({
    queryKey: ['pending-vendors'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('status', 'Pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching pending vendors:', error);
        return [];
      }
    },
  });

  const createVendor = useMutation({
    mutationFn: async (vendorData) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          name: vendorData.name,
          business_type: vendorData.businessType,
          contact_person: vendorData.contactPerson,
          email: vendorData.email,
          phone: vendorData.phone,
          address: vendorData.address,
          mse_certificate: vendorData.mseCertificate,
          status: 'Pending' // Explicitly set status to Pending
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vendors']);
      queryClient.invalidateQueries(['pending-vendors']);
      setShowForm(false);
      toast.success('Vendor created successfully');
    },
    onError: (error) => {
      console.error('Error creating vendor:', error);
      toast.error(error.message || 'Failed to create vendor');
    }
  });

  const updateVendorStatus = useMutation({
    mutationFn: async ({ id, status, reason = null }) => {
      if (!id) {
        throw new Error('Vendor ID is required');
      }
      
      const updateData = { 
        status,
        approved_by: user.id
      };
      
      // Add rejection reason if provided
      if (reason && status === 'Suspended') {
        updateData.rejection_reason = reason;
      }
      
      const { data, error } = await supabase
        .from('vendors')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['vendors']);
      queryClient.invalidateQueries(['pending-vendors']);
      queryClient.invalidateQueries(['vendor-approval-logs']);
      
      const statusMessage = {
        'Active': 'Vendor approved successfully',
        'Suspended': 'Vendor suspended successfully',
        'Pending': 'Vendor set to pending status'
      };
      toast.success(statusMessage[data.status] || 'Vendor status updated successfully');
      
      // Reset state
      setRejectionReason('');
      setShowReasonModal(false);
      setSelectedVendorId(null);
    },
    onError: (error) => {
      console.error('Error updating vendor status:', error);
      toast.error(error.message || 'Failed to update vendor status');
      setShowReasonModal(false);
      setSelectedVendorId(null);
    }
  });

  const handleApproveVendor = (id) => {
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    updateVendorStatus.mutate({ id, status: 'Active' });
  };

  const handleSuspendVendor = (id) => {
    if (!id) {
      toast.error('Vendor ID is missing');
      return;
    }
    // Store the vendor ID and show the reason modal
    setSelectedVendorId(id);
    setShowReasonModal(true);
  };
  
  const confirmSuspension = () => {
    if (!selectedVendorId) {
      toast.error('Vendor ID is missing');
      return;
    }
    
    updateVendorStatus.mutate({ 
      id: selectedVendorId, 
      status: 'Suspended', 
      reason: rejectionReason 
    });
  };

  // Filter vendors based on status
  const filteredVendors = vendors ? vendors.filter(vendor => {
    if (filterStatus === 'all') return true;
    return vendor.status === filterStatus;
  }) : [];

  // Count vendors by status
  const pendingCount = vendors ? vendors.filter(v => v.status === 'Pending').length : 0;
  const activeCount = vendors ? vendors.filter(v => v.status === 'Active').length : 0;
  const suspendedCount = vendors ? vendors.filter(v => v.status === 'Suspended').length : 0;

  return (
    <div className="space-y-6">
      {/* Rejection Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Suspension Reason</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for suspending this vendor. This will be recorded in the system.
            </p>
            <textarea
              className="input w-full h-32 mb-4"
              placeholder="Enter reason for suspension"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowReasonModal(false);
                  setSelectedVendorId(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmSuspension}
                disabled={!rejectionReason.trim() || updateVendorStatus.isLoading}
              >
                {updateVendorStatus.isLoading ? 'Processing...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel' : 'Add New Vendor'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Register New Vendor
          </h2>
          <Formik
            initialValues={{
              name: '',
              businessType: '',
              contactPerson: '',
              email: '',
              phone: '',
              address: '',
              mseCertificate: '',
            }}
            validationSchema={vendorSchema}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              try {
                await createVendor.mutateAsync(values);
                resetForm();
              } catch (error) {
                console.error('Form submission error:', error);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ errors, touched, values, isSubmitting }) => (
              <Form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Vendor Name
                    </label>
                    <Field
                      name="name"
                      type="text"
                      className="input"
                    />
                    {errors.name && touched.name && (
                      <div className="mt-1 text-sm text-red-600">{errors.name}</div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
                      Business Type
                    </label>
                    <Field
                      as="select"
                      name="businessType"
                      className="input"
                    >
                      <option value="">Select type</option>
                      <option value="MSE">MSE (Micro and Small Enterprise)</option>
                      <option value="Large Enterprise">Large Enterprise</option>
                    </Field>
                    {errors.businessType && touched.businessType && (
                      <div className="mt-1 text-sm text-red-600">{errors.businessType}</div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
                      Contact Person
                    </label>
                    <Field
                      name="contactPerson"
                      type="text"
                      className="input"
                    />
                    {errors.contactPerson && touched.contactPerson && (
                      <div className="mt-1 text-sm text-red-600">{errors.contactPerson}</div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <Field
                      name="email"
                      type="email"
                      className="input"
                    />
                    {errors.email && touched.email && (
                      <div className="mt-1 text-sm text-red-600">{errors.email}</div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <Field
                      name="phone"
                      type="text"
                      className="input"
                    />
                    {errors.phone && touched.phone && (
                      <div className="mt-1 text-sm text-red-600">{errors.phone}</div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <Field
                      name="address"
                      type="text"
                      className="input"
                    />
                    {errors.address && touched.address && (
                      <div className="mt-1 text-sm text-red-600">{errors.address}</div>
                    )}
                  </div>

                  {values.businessType === 'MSE' && (
                    <div>
                      <label htmlFor="mseCertificate" className="block text-sm font-medium text-gray-700">
                        MSE Certificate Number
                      </label>
                      <Field
                        name="mseCertificate"
                        type="text"
                        className="input"
                      />
                      {errors.mseCertificate && touched.mseCertificate && (
                        <div className="mt-1 text-sm text-red-600">{errors.mseCertificate}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Register Vendor'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      )}

      {/* Pending Vendor Approvals Section */}
      {pendingVendors && pendingVendors.length > 0 && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">Pending Vendor Approvals</h2>
          <p className="text-yellow-800 mb-4">
            You have {pendingVendors.length} vendor{pendingVendors.length > 1 ? 's' : ''} waiting for approval.
          </p>
          <VendorApprovalList />
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div 
          className={`card cursor-pointer ${filterStatus === 'all' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          <h3 className="text-lg font-medium text-gray-900">All Vendors</h3>
          <p className="mt-2 text-3xl font-bold text-primary-600">{vendors?.length || 0}</p>
        </div>
        
        <div 
          className={`card cursor-pointer ${filterStatus === 'Pending' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setFilterStatus('Pending')}
        >
          <h3 className="text-lg font-medium text-gray-900">Pending Approval</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        
        <div 
          className={`card cursor-pointer ${filterStatus === 'Active' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setFilterStatus('Active')}
        >
          <h3 className="text-lg font-medium text-gray-900">Active Vendors</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">{activeCount}</p>
        </div>
        
        <div 
          className={`card cursor-pointer ${filterStatus === 'Suspended' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilterStatus('Suspended')}
        >
          <h3 className="text-lg font-medium text-gray-900">Suspended</h3>
          <p className="mt-2 text-3xl font-bold text-red-600">{suspendedCount}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {filterStatus === 'all' ? 'Vendor Directory' : 
             filterStatus === 'Pending' ? 'Pending Approval' :
             filterStatus === 'Active' ? 'Active Vendors' : 'Suspended Vendors'}
          </h2>
          
          <div className="flex space-x-2">
            <button 
              className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('all')}
            >
              All
            </button>
            <button 
              className={`btn ${filterStatus === 'Pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('Pending')}
            >
              Pending ({pendingCount})
            </button>
            <button 
              className={`btn ${filterStatus === 'Active' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('Active')}
            >
              Active
            </button>
            <button 
              className={`btn ${filterStatus === 'Suspended' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('Suspended')}
            >
              Suspended
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <LoadingSpinner />
        ) : filteredVendors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approved By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        vendor.business_type === 'MSE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {vendor.business_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.contact_person}
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
                      {vendor.approved_by ? (
                        <span className="text-sm">
                          {vendor.approved_by.first_name} {vendor.approved_by.last_name}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <Link
                          to={`/vendors/${vendor.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </Link>
                        {vendor.status === 'Pending' && (
                          <button
                            onClick={() => handleApproveVendor(vendor.id)}
                            className="text-green-600 hover:text-green-900"
                            disabled={updateVendorStatus.isLoading}
                          >
                            Approve
                          </button>
                        )}
                        {vendor.status === 'Active' && (
                          <button
                            onClick={() => handleSuspendVendor(vendor.id)}
                            className="text-red-600 hover:text-red-900"
                            disabled={updateVendorStatus.isLoading}
                          >
                            Suspend
                          </button>
                        )}
                        {vendor.status === 'Suspended' && (
                          <button
                            onClick={() => handleApproveVendor(vendor.id)}
                            className="text-green-600 hover:text-green-900"
                            disabled={updateVendorStatus.isLoading}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {filterStatus === 'all' 
              ? 'No vendors found. Create a new vendor to get started.'
              : `No ${filterStatus.toLowerCase()} vendors found.`}
          </div>
        )}
      </div>
    </div>
  );
}