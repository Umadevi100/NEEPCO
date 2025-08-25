import asyncHandler from 'express-async-handler';
import Bid from '../models/bidModel.js';
import Vendor from '../models/vendorModel.js';

// @desc    Create a new bid
// @route   POST /api/bids
// @access  Private
export const createBid = asyncHandler(async (req, res) => {
  const { tender, amount } = req.body;

  // Check if user has an associated vendor account
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(400);
    throw new Error('Vendor account not found');
  }

  const bid = await Bid.create({
    tender,
    vendor: vendor._id,
    amount,
  });

  res.status(201).json(bid);
});

// @desc    Get bids by tender
// @route   GET /api/bids/tender/:tenderId
// @access  Private
export const getBidsByTender = asyncHandler(async (req, res) => {
  const bids = await Bid.find({ tender: req.params.tenderId })
    .populate('vendor', 'name businessType')
    .populate('tender', 'title');
  res.json(bids);
});

// @desc    Get bids by vendor
// @route   GET /api/bids/vendor/:vendorId
// @access  Private
export const getBidsByVendor = asyncHandler(async (req, res) => {
  const bids = await Bid.find({ vendor: req.params.vendorId })
    .populate('tender', 'title description')
    .populate('vendor', 'name');
  res.json(bids);
});

// @desc    Update bid status
// @route   PUT /api/bids/:id
// @access  Private/ProcurementOfficer
export const updateBidStatus = asyncHandler(async (req, res) => {
  const bid = await Bid.findById(req.params.id);

  if (bid) {
    bid.status = req.body.status || bid.status;
    const updatedBid = await bid.save();
    res.json(updatedBid);
  } else {
    res.status(404);
    throw new Error('Bid not found');
  }
});