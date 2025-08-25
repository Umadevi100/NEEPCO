import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema(
  {
    tender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tender',
      required: true,
    },
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
      enum: ['submitted', 'under_review', 'accepted', 'rejected'],
      default: 'submitted',
    },
    technicalScore: {
      type: Number,
      min: 0,
      max: 100
    },
    documents: [{
      name: String,
      url: String,
      uploadedAt: Date
    }],
    notes: String,
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    evaluatedAt: Date
  },
  {
    timestamps: true,
  }
);

// Ensure unique bid per vendor per tender
bidSchema.index({ tender: 1, vendor: 1 }, { unique: true });

const Bid = mongoose.model('Bid', bidSchema);

export default Bid;