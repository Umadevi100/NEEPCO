import express from 'express';
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getMSEVendors,
} from '../controllers/vendorController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createVendor)
  .get(protect, getVendors);

router.get('/mse', protect, getMSEVendors);

router.route('/:id')
  .get(protect, getVendorById)
  .put(protect, updateVendor)
  .delete(protect, admin, deleteVendor);

export default router;