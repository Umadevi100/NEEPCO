import mongoose from 'mongoose';

const tenderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    estimatedValue: {
      type: Number,
      required: true,
    },
    submissionDeadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'under_review', 'awarded', 'cancelled'],
      default: 'draft',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documents: [{
      name: String,
      url: String,
      uploadedAt: Date
    }],
    category: {
      type: String,
      enum: ['goods', 'services', 'works'],
      required: true
    },
    isReservedForMSE: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Add text index for search functionality
tenderSchema.index({ title: 'text', description: 'text' });

const Tender = mongoose.model('Tender', tenderSchema);

export default Tender;