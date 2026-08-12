import jwt from 'jsonwebtoken';

export default function auth(req, res, next) {
  // Check authorization header
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'No authentication token, authorization denied' });
  }

  // Token is usually in format "Bearer <token>"
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'voting_biometric_jwt_secret_key_12345');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is invalid or expired. Biometric session ended.' });
  }
}
