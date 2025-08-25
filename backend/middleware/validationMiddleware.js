import { validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export const validateUser = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  validateRequest,
];

export const validateVendor = [
  body('name').notEmpty().withMessage('Vendor name is required'),
  body('businessType')
    .isIn(['MSE', 'Large Enterprise'])
    .withMessage('Invalid business type'),
  body('contactPerson').notEmpty().withMessage('Contact person is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  validateRequest,
];

export const validateTender = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('estimatedValue')
    .isNumeric()
    .withMessage('Estimated value must be a number'),
  body('submissionDeadline')
    .isISO8601()
    .withMessage('Invalid submission deadline'),
  validateRequest,
];

export const validateBid = [
  body('tender').notEmpty().withMessage('Tender ID is required'),
  body('amount').isNumeric().withMessage('Bid amount must be a number'),
  validateRequest,
];

export const validatePayment = [
  body('vendor').notEmpty().withMessage('Vendor ID is required'),
  body('amount').isNumeric().withMessage('Payment amount must be a number'),
  body('paymentMethod')
    .isIn(['bank_transfer', 'check', 'credit_card'])
    .withMessage('Invalid payment method'),
  validateRequest,
];