import mongoose from 'mongoose';

const verificationLogSchema = new mongoose.Schema({
  voterId: {
    type: String,
    required: true,
    trim: true
  },
  success: {
    type: Boolean,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  device: {
    type: String,
    default: 'Web Browser'
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  }
});

const VerificationLog = mongoose.model('VerificationLog', verificationLogSchema);
export default VerificationLog;
