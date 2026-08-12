import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import voteRoutes from './routes/vote.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/blockchain_voting';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 image uploading limits
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// DB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connection established successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vote', voteRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'Blockchain Voting Backend API is running' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
