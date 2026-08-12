import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import Candidate from '../models/Candidate.js';
import Vote from '../models/Vote.js';

const router = express.Router();

// Sample candidates data to initialize DB if empty
const INITIAL_CANDIDATES = [
  { id: '1', name: 'Alice Johnson', party: 'Progressive Party', manifesto: 'Innovation and growth for all citizens.', votes: 0 },
  { id: '2', name: 'Bob Smith', party: 'Unity Party', manifesto: 'Bringing communities together.', votes: 0 },
  { id: '3', name: 'Carol Williams', party: 'Green Alliance', manifesto: 'Sustainable future for our planet.', votes: 0 },
];

/**
 * Get all candidates.
 * GET /api/vote/candidates
 */
router.get('/candidates', async (req, res) => {
  try {
    let candidates = await Candidate.find({});
    if (candidates.length === 0) {
      // Seed initial candidates
      await Candidate.insertMany(INITIAL_CANDIDATES);
      candidates = await Candidate.find({});
    }
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching candidates', error: err.message });
  }
});

/**
 * Add a new candidate (Admin only).
 * POST /api/vote/candidates
 */
router.post('/candidates', async (req, res) => {
  const { name, party, manifesto } = req.body;
  if (!name || !party) {
    return res.status(400).json({ message: 'Name and Party are required' });
  }

  try {
    const id = `cand_${Date.now()}`;
    const newCandidate = new Candidate({
      id,
      name: name.trim(),
      party: party.trim(),
      manifesto: manifesto?.trim() || '',
      votes: 0
    });
    await newCandidate.save();
    res.status(201).json(newCandidate);
  } catch (err) {
    res.status(500).json({ message: 'Error creating candidate', error: err.message });
  }
});

/**
 * Delete a candidate (Admin only).
 * DELETE /api/vote/candidates/:id
 */
router.delete('/candidates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Candidate.findOneAndDelete({ id: id });
    if (!deleted) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    res.json({ message: 'Candidate deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting candidate', error: err.message });
  }
});

/**
 * Cast a vote (requires biometric JWT session).
 * POST /api/vote/cast
 */
router.post('/cast', auth, async (req, res) => {
  const { candidateId, transactionHash, blockNumber } = req.body;
  // req.user is decoded from the JWT containing voterId
  const { voterId } = req.user;

  if (!candidateId || !transactionHash || !blockNumber) {
    return res.status(400).json({ message: 'Missing voting context details (candidate, transactionHash, or blockNumber)' });
  }

  try {
    const user = await User.findOne({ voterId });
    if (!user) {
      return res.status(404).json({ message: 'Voter not found' });
    }

    if (user.hasVoted) {
      return res.status(400).json({ message: 'Voter has already cast their ballot' });
    }

    const candidate = await Candidate.findOne({ id: candidateId });
    if (!candidate) {
      return res.status(404).json({ message: 'Selected candidate does not exist' });
    }

    // Save the vote record in MongoDB
    const voteLog = new Vote({
      voterId,
      candidateId,
      transactionHash,
      blockNumber,
      timestamp: new Date()
    });
    await voteLog.save();

    // Update user voting status
    user.hasVoted = true;
    user.verified = true;
    await user.save();

    // Increment candidate votes
    candidate.votes = (candidate.votes || 0) + 1;
    await candidate.save();

    res.json({
      success: true,
      message: 'Vote cast logged successfully in database',
      txHash: transactionHash,
      blockNumber
    });

  } catch (err) {
    res.status(500).json({ message: 'Error logging vote cast in database', error: err.message });
  }
});

/**
 * Fetch voting results.
 * GET /api/vote/results
 */
router.get('/results', async (req, res) => {
  try {
    const candidates = await Candidate.find({}).sort({ votes: -1 });
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching results', error: err.message });
  }
});

export default router;
