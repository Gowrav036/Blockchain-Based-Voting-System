import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import VerificationLog from '../models/VerificationLog.js';

const router = express.Router();
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:5001';

/**
 * Endpoint to check if a voter is eligible and get details.
 * POST /api/auth/login-check
 */
router.post('/login-check', async (req, res) => {
  const { voterId } = req.body;
  if (!voterId) {
    return res.status(400).json({ message: 'Voter ID is required' });
  }

  try {
    const user = await User.findOne({ voterId: voterId.trim() });
    if (!user) {
      return res.status(404).json({ message: 'Invalid Voter. Access Denied.' });
    }

    if (user.hasVoted) {
      return res.status(400).json({ message: 'You have already voted.', hasVoted: true });
    }

    res.json({
      success: true,
      user: {
        voterId: user.voterId,
        name: user.name,
        walletAddress: user.walletAddress,
        hasVoted: user.hasVoted
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error check during login check', error: err.message });
  }
});

/**
 * Endpoint to register a voter's details and face biometrics.
 * POST /api/auth/register-face
 */
router.post('/register-face', async (req, res) => {
  const { voterId, name, dob, mobile, walletAddress, webcamImages } = req.body;

  if (!voterId || !name || !dob || !mobile || !walletAddress || !webcamImages) {
    return res.status(400).json({ message: 'All registration fields and webcam images are required' });
  }

  if (!Array.isArray(webcamImages) || webcamImages.length !== 10) {
    return res.status(400).json({ message: 'Precisely 10 webcam captures are required for registration' });
  }

  try {
    // Check if voter already exists
    const existingUser = await User.findOne({ voterId: voterId.trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'Voter ID is already registered' });
    }

    // Call FastAPI service to generate the averaged embedding from 10 images
    console.log(`Forwarding 10 face frames to FastAPI at ${FASTAPI_URL}/register-face`);
    const fastApiRes = await axios.post(`${FASTAPI_URL}/register-face`, {
      voter_id: voterId.trim(),
      images: webcamImages
    });

    if (!fastApiRes.data || !fastApiRes.data.embedding) {
      return res.status(500).json({ message: 'Biometric server failed to generate face embedding' });
    }

    const { embedding } = fastApiRes.data;

    // Create user in MongoDB
    const newUser = new User({
      voterId: voterId.trim(),
      name: name.trim(),
      dob,
      mobile: mobile.trim(),
      walletAddress: walletAddress.trim(),
      embedding,
      hasVoted: false,
      verified: false
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Voter biometric profile and credentials saved successfully',
      user: { voterId: newUser.voterId, name: newUser.name }
    });

  } catch (err) {
    console.error('Registration API Error:', err.message);
    const errorMsg = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({
      message: 'Failed to process face registration',
      error: errorMsg
    });
  }
});

/**
 * Endpoint to verify voter face and issue short-lived JWT.
 * POST /api/auth/verify-face
 */
router.post('/verify-face', async (req, res) => {
  const { voterId, image } = req.body;

  if (!voterId || !image) {
    return res.status(400).json({ message: 'Voter ID and live face capture are required' });
  }

  try {
    const user = await User.findOne({ voterId: voterId.trim() });
    if (!user) {
      return res.status(404).json({ message: 'Voter profile not found' });
    }

    if (user.hasVoted) {
      return res.status(400).json({ message: 'You have already voted.' });
    }

    // Forward verification to FastAPI along with the stored embedding
    console.log(`Forwarding verification for ${voterId} to FastAPI at ${FASTAPI_URL}/verify-face`);
    const fastApiRes = await axios.post(`${FASTAPI_URL}/verify-face`, {
      voter_id: voterId.trim(),
      image: image,
      stored_embedding: user.embedding
    });

    const { matched, score, message } = fastApiRes.data;

    // Log the verification attempt in MongoDB
    const log = new VerificationLog({
      voterId: user.voterId,
      success: matched,
      score: score,
      device: req.headers['user-agent'] || 'Web Browser',
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1'
    });
    await log.save();

    if (!matched) {
      return res.status(400).json({
        success: false,
        matched: false,
        score,
        message: message || 'Biometric signature mismatch. Verification rejected.'
      });
    }

    // Biometric matched! Issue a short-lived JWT session (expires in 10 minutes)
    const token = jwt.sign(
      { voterId: user.voterId, walletAddress: user.walletAddress },
      process.env.JWT_SECRET || 'voting_biometric_jwt_secret_key_12345',
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      matched: true,
      score,
      token,
      user: {
        voterId: user.voterId,
        name: user.name,
        walletAddress: user.walletAddress
      }
    });

  } catch (err) {
    console.error('Verification API Error:', err.message);
    const errorMsg = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({
      message: 'Failed to process face verification',
      error: errorMsg
    });
  }
});

/**
 * Proxy endpoint to check face liveness against Python service.
 * POST /api/auth/verify-liveness
 */
router.post('/verify-liveness', async (req, res) => {
  const { challenge, image } = req.body;
  
  if (!challenge || !image) {
    return res.status(400).json({ message: 'Challenge type and live capture are required' });
  }

  try {
    const fastApiRes = await axios.post(`${FASTAPI_URL}/verify-liveness`, {
      challenge,
      image
    });
    res.json(fastApiRes.data);
  } catch (err) {
    console.error('Liveness Proxy Error:', err.message);
    const errorMsg = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({
      message: 'Liveness challenge processing failed on biometric backend',
      error: errorMsg
    });
  }
});

/**
 * Get all registered voters.
 * GET /api/auth/voters
 */
router.get('/voters', async (req, res) => {
  try {
    const voters = await User.find({}, '-embedding'); // Exclude embeddings for security as requested
    res.json(voters);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching voters', error: err.message });
  }
});

/**
 * Remove a registered voter.
 * DELETE /api/auth/voters/:voterId
 */
router.delete('/voters/:voterId', async (req, res) => {
  const { voterId } = req.params;
  try {
    const deleted = await User.findOneAndDelete({ voterId });
    if (!deleted) {
      return res.status(404).json({ message: 'Voter not found' });
    }
    res.json({ message: 'Voter removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing voter', error: err.message });
  }
});

export default router;
