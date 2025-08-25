import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'check', 'credit_card'],
      required: true,
    },
    notes: String,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentDate: Date,
    transactionId: String,
    relatedTender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tender'
    },
    relatedBid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bid'
    },
    documents: [{
      type: {
        type: String,
        enum: ['invoice', 'receipt', 'other'],
        required: true
      },
      name: String,
      url: String,
      uploadedAt: Date
    }]
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;