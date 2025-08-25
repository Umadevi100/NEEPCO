import asyncHandler from 'express-async-handler';
import Payment from '../models/paymentModel.js';

// @desc    Create a new payment
// @route   POST /api/payments
// @access  Private/FinanceOfficer
export const createPayment = asyncHandler(async (req, res) => {
  const { vendor, amount, paymentMethod, notes } = req.body;

  const payment = await Payment.create({
    vendor,
    amount,
    paymentMethod,
    notes,
    processedBy: req.user._id,
  });

  res.status(201).json(payment);
});

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/FinanceOfficer
export const getPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({})
    .populate('vendor', 'name businessType')
    .populate('processedBy', 'email');
  res.json(payments);
});

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private/FinanceOfficer
export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('vendor', 'name businessType email')
    .populate('processedBy', 'email');

  if (payment) {
    res.json(payment);
  } else {
    res.status(404);
    throw new Error('Payment not found');
  }
});

// @desc    Update payment status
// @route   PUT /api/payments/:id
// @access  Private/FinanceOfficer
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (payment) {
    payment.status = req.body.status || payment.status;
    if (req.body.status === 'completed') {
      payment.paymentDate = new Date();
    }
    
    const updatedPayment = await payment.save();
    res.json(updatedPayment);
  } else {
    res.status(404);
    throw new Error('Payment not found');
  }
});

// @desc    Get payments by vendor
// @route   GET /api/payments/vendor/:vendorId
// @access  Private
export const getPaymentsByVendor = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ vendor: req.params.vendorId })
    .populate('processedBy', 'email');
  res.json(payments);
});