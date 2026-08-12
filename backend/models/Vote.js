import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  voterId: {
    type: String,
    required: true,
    trim: true
  },
  candidateId: {
    type: String,
    required: true
  },
  transactionHash: {
    type: String,
    required: true,
    trim: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Vote = mongoose.model('Vote', voteSchema);
export default Vote;
