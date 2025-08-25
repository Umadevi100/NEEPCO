import express from 'express';
import {
  createPayment,
  getPayments,
  getPaymentById,
  updatePaymentStatus,
  getPaymentsByVendor,
} from '../controllers/paymentController.js';
import { protect, financeOfficer } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, financeOfficer, createPayment)
  .get(protect, financeOfficer, getPayments);

router.route('/vendor/:vendorId')
  .get(protect, getPaymentsByVendor);

router.route('/:id')
  .get(protect, financeOfficer, getPaymentById)
  .put(protect, financeOfficer, updatePaymentStatus);

export default router;