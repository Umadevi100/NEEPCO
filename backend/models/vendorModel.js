import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    businessType: {
      type: String,
      enum: ['MSE', 'Large Enterprise'],
      required: true,
    },
    contactPerson: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    mseCertificate: String,
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Suspended'],
      default: 'Pending',
    },
    complianceScore: {
      type: Number,
      default: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documents: [{
      type: {
        type: String,
        enum: ['registration', 'tax', 'mseCertificate', 'other'],
        required: true
      },
      name: String,
      url: String,
      verifiedAt: Date
    }],
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      ifscCode: String
    }
  },
  {
    timestamps: true,
  }
);

// Add text index for search functionality
vendorSchema.index({ name: 'text', email: 'text' });

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;