import asyncHandler from 'express-async-handler';
import Vendor from '../models/vendorModel.js';

// @desc    Create a new vendor
// @route   POST /api/vendors
// @access  Private
export const createVendor = asyncHandler(async (req, res) => {
  const {
    name,
    businessType,
    contactPerson,
    email,
    phone,
    address,
    mseCertificate,
  } = req.body;

  const vendor = await Vendor.create({
    name,
    businessType,
    contactPerson,
    email,
    phone,
    address,
    mseCertificate,
    user: req.user._id,
  });

  res.status(201).json(vendor);
});

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
export const getVendors = asyncHandler(async (req, res) => {
  const vendors = await Vendor.find({}).populate('user', 'email');
  res.json(vendors);
});

// @desc    Get vendor by ID
// @route   GET /api/vendors/:id
// @access  Private
export const getVendorById = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id).populate('user', 'email');

  if (vendor) {
    res.json(vendor);
  } else {
    res.status(404);
    throw new Error('Vendor not found');
  }
});

// @desc    Update vendor
// @route   PUT /api/vendors/:id
// @access  Private
export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);

  if (vendor) {
    vendor.name = req.body.name || vendor.name;
    vendor.businessType = req.body.businessType || vendor.businessType;
    vendor.contactPerson = req.body.contactPerson || vendor.contactPerson;
    vendor.email = req.body.email || vendor.email;
    vendor.phone = req.body.phone || vendor.phone;
    vendor.address = req.body.address || vendor.address;
    vendor.mseCertificate = req.body.mseCertificate || vendor.mseCertificate;
    vendor.status = req.body.status || vendor.status;
    vendor.complianceScore = req.body.complianceScore || vendor.complianceScore;

    const updatedVendor = await vendor.save();
    res.json(updatedVendor);
  } else {
    res.status(404);
    throw new Error('Vendor not found');
  }
});

// @desc    Delete vendor
// @route   DELETE /api/vendors/:id
// @access  Private/Admin
export const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);

  if (vendor) {
    await vendor.deleteOne();
    res.json({ message: 'Vendor removed' });
  } else {
    res.status(404);
    throw new Error('Vendor not found');
  }
});

// @desc    Get MSE vendors
// @route   GET /api/vendors/mse
// @access  Private
export const getMSEVendors = asyncHandler(async (req, res) => {
  const vendors = await Vendor.find({ businessType: 'MSE' }).populate('user', 'email');
  res.json(vendors);
});