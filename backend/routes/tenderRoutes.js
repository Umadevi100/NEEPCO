import express from 'express';
import {
  createTender,
  getTenders,
  getTenderById,
  updateTender,
  deleteTender,
} from '../controllers/tenderController.js';
import { protect, procurementOfficer } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, procurementOfficer, createTender)
  .get(protect, getTenders);

router.route('/:id')
  .get(protect, getTenderById)
  .put(protect, procurementOfficer, updateTender)
  .delete(protect, procurementOfficer, deleteTender);

export default router;