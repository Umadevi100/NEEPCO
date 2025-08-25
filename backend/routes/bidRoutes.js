import express from 'express';
import {
  createBid,
  getBidsByTender,
  getBidsByVendor,
  updateBidStatus,
} from '../controllers/bidController.js';
import { protect, procurementOfficer } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createBid);

router.route('/tender/:tenderId')
  .get(protect, getBidsByTender);

router.route('/vendor/:vendorId')
  .get(protect, getBidsByVendor);

router.route('/:id')
  .put(protect, procurementOfficer, updateBidStatus);

export default router;