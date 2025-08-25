import asyncHandler from 'express-async-handler';
import Tender from '../models/tenderModel.js';

// @desc    Create a new tender
// @route   POST /api/tenders
// @access  Private/ProcurementOfficer
export const createTender = asyncHandler(async (req, res) => {
  const { title, description, estimatedValue, submissionDeadline } = req.body;

  const tender = await Tender.create({
    title,
    description,
    estimatedValue,
    submissionDeadline,
    createdBy: req.user._id,
  });

  res.status(201).json(tender);
});

// @desc    Get all tenders
// @route   GET /api/tenders
// @access  Private
export const getTenders = asyncHandler(async (req, res) => {
  const tenders = await Tender.find({}).populate('createdBy', 'email');
  res.json(tenders);
});

// @desc    Get tender by ID
// @route   GET /api/tenders/:id
// @access  Private
export const getTenderById = asyncHandler(async (req, res) => {
  const tender = await Tender.findById(req.params.id)
    .populate('createdBy', 'email');

  if (tender) {
    res.json(tender);
  } else {
    res.status(404);
    throw new Error('Tender not found');
  }
});

// @desc    Update tender
// @route   PUT /api/tenders/:id
// @access  Private/ProcurementOfficer
export const updateTender = asyncHandler(async (req, res) => {
  const tender = await Tender.findById(req.params.id);

  if (tender) {
    tender.title = req.body.title || tender.title;
    tender.description = req.body.description || tender.description;
    tender.estimatedValue = req.body.estimatedValue || tender.estimatedValue;
    tender.submissionDeadline = req.body.submissionDeadline || tender.submissionDeadline;
    tender.status = req.body.status || tender.status;

    const updatedTender = await tender.save();
    res.json(updatedTender);
  } else {
    res.status(404);
    throw new Error('Tender not found');
  }
});

// @desc    Delete tender
// @route   DELETE /api/tenders/:id
// @access  Private/ProcurementOfficer
export const deleteTender = asyncHandler(async (req, res) => {
  const tender = await Tender.findById(req.params.id);

  if (tender) {
    await tender.deleteOne();
    res.json({ message: 'Tender removed' });
  } else {
    res.status(404);
    throw new Error('Tender not found');
  }
});