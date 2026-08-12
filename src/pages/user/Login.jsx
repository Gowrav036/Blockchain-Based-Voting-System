import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import toast from 'react-hot-toast';

export default function Login() {
  const [voterId, setVoterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { setPendingUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const validate = () => {
    const err = {};
    if (!voterId.trim()) {
      err.voterId = 'Voter ID is required';
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/login-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: voterId.trim() })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPendingUser(data.user);
        toast.success(`Voter ${data.user.name} identified! Proceeding to face verification.`);
        navigate('/face-verification', { replace: true, state: { from } });
      } else {
        toast.error(data.message || 'Invalid Voter ID or connection failure');
        setErrors({ submit: data.message || 'Invalid Voter' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Connection to backend failed');
      setErrors({ submit: 'Could not connect to voting backend' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-white mb-6">Voter Login</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Voter ID</label>
          <input
            type="text"
            value={voterId}
            onChange={(e) => setVoterId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Enter your Voter ID"
          />
          {errors.voterId && <p className="text-red-400 text-sm mt-1">{errors.voterId}</p>}
        </div>
        {errors.submit && <p className="text-red-400 text-sm mt-1">{errors.submit}</p>}
        <Button type="submit" fullWidth loading={loading}>
          Verify Voter ID
        </Button>
      </form>
      <p className="mt-4 text-center text-slate-500 text-sm">
        Only registered and approved voters can login. Face biometric checks apply.
      </p>
    </Card>
  );
}
