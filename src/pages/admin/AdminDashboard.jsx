import { useState, useEffect, useRef } from 'react';
import { useVoting } from '../../context/VotingContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { candidates, electionActive, toggleElection, addCandidate, deleteCandidate, getResults } = useVoting();
  
  // Voter state management linked to MongoDB via Express
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddVoterForm, setShowAddVoterForm] = useState(false);
  
  // Candidates Form state
  const [formData, setFormData] = useState({ name: '', party: '', manifesto: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Voter registration state (10 webcam images)
  const [voterFormData, setVoterFormData] = useState({ voterId: '', name: '', dob: '', mobile: '', walletAddress: '' });
  const [voterErrors, setVoterErrors] = useState({});
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [registerLoading, setRegisterLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Fetch registered voters from Express backend
  const fetchVoters = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/voters');
      if (response.ok) {
        const data = await response.json();
        setApprovedUsers(data);
      }
    } catch (err) {
      console.error('Failed to load voters:', err);
    }
  };

  useEffect(() => {
    fetchVoters();
  }, []);

  const validateCandidate = () => {
    const err = {};
    if (!formData.name.trim()) err.name = 'Name is required';
    if (!formData.party.trim()) err.party = 'Party is required';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!validateCandidate()) return;

    setLoading(true);
    try {
      // Create candidate on backend
      const response = await fetch('http://localhost:5000/api/vote/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const newCand = await response.json();
        addCandidate(newCand); // Sync with context
        setFormData({ name: '', party: '', manifesto: '' });
        setShowAddForm(false);
        toast.success('Candidate added successfully!');
      } else {
        toast.error('Failed to create candidate on server');
      }
    } catch {
      toast.error('Failed to add candidate');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (window.confirm('Are you sure you want to delete this candidate?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/vote/candidates/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          deleteCandidate(id); // Sync with context
          toast.success('Candidate deleted');
        }
      } catch (err) {
        toast.error('Failed to delete candidate');
      }
    }
  };

  const validateVoter = () => {
    const err = {};
    if (!voterFormData.voterId.trim()) err.voterId = 'Voter ID is required';
    if (!voterFormData.name.trim()) err.name = 'Name is required';
    if (!voterFormData.dob) err.dob = 'DOB is required';
    if (!voterFormData.mobile.trim()) err.mobile = 'Mobile number is required';
    if (!voterFormData.walletAddress.trim()) err.walletAddress = 'Wallet Address is required';
    else if (!/^0x[a-fA-F0-9]{40}$/.test(voterFormData.walletAddress.trim())) err.walletAddress = 'Invalid Ethereum wallet address format';
    
    setVoterErrors(err);
    return Object.keys(err).length === 0;
  };

  // Start webcam for biometric enrollment
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCapturedFrames([]);
      setCaptureProgress(0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to access webcam for enrollment.');
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Automated 10-frame capture workflow
  const captureBiometrics = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    const frames = [];
    let count = 0;
    
    const interval = setInterval(() => {
      if (count >= 10) {
        clearInterval(interval);
        setCapturedFrames(frames);
        stopCamera();
        toast.success('Successfully captured 10 face frames!');
        return;
      }
      
      // Capture square frame
      const size = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;
      
      canvas.width = 400;
      canvas.height = 400;
      context.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);
      
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.95);
      frames.push(frameBase64);
      
      count++;
      setCaptureProgress(count * 10);
    }, 300); // 300ms interval between captures
  };

  const handleAddVoter = async (e) => {
    e.preventDefault();
    if (!validateVoter()) return;
    if (capturedFrames.length !== 10) {
      toast.error('Face biometric capture is incomplete. Please capture 10 webcam images.');
      return;
    }

    setRegisterLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/register-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...voterFormData,
          webcamImages: capturedFrames
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Voter successfully registered with face biometrics!');
        setVoterFormData({ voterId: '', name: '', dob: '', mobile: '', walletAddress: '' });
        setCapturedFrames([]);
        setCaptureProgress(0);
        setShowAddVoterForm(false);
        fetchVoters(); // Refresh voters list
      } else {
        toast.error(data.message || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Connection to backend server failed');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRemoveVoter = async (voterId) => {
    if (window.confirm(`Remove voter ${voterId} from the database?`)) {
      try {
        const response = await fetch(`http://localhost:5000/api/auth/voters/${voterId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          toast.success('Voter biometric details removed successfully');
          fetchVoters();
        }
      } catch (err) {
        toast.error('Failed to remove voter');
      }
    }
  };

  const handleToggleElection = () => {
    toggleElection();
    toast.success(electionActive ? 'Election ended' : 'Election started');
  };

  const results = getResults();
  const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-slate-400 text-sm">Election Status</p>
          <StatusBadge status={electionActive ? 'active' : 'ended'} />
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Total Candidates</p>
          <p className="text-xl font-semibold text-white">{candidates.length}</p>
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Total Votes</p>
          <p className="text-xl font-semibold text-white">{totalVotes}</p>
        </Card>
        <Card>
          <Button
            onClick={handleToggleElection}
            variant={electionActive ? 'danger' : 'primary'}
          >
            {electionActive ? 'End Election' : 'Start Election'}
          </Button>
        </Card>
      </div>

      {/* Candidates Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-white">Candidates</h2>
        <Button onClick={() => setShowAddForm(!showAddForm)} variant="secondary">
          {showAddForm ? 'Cancel' : 'Add Candidate'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Add Candidate</h3>
          <form onSubmit={handleAddCandidate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Candidate name"
              />
              {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Party</label>
              <input
                type="text"
                value={formData.party}
                onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Party name"
              />
              {errors.party && <p className="text-red-400 text-sm mt-1">{errors.party}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Manifesto (optional)</label>
              <textarea
                value={formData.manifesto}
                onChange={(e) => setFormData({ ...formData, manifesto: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Brief manifesto"
              />
            </div>
            <Button type="submit" loading={loading}>
              Add Candidate
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 mb-8">
        {candidates.map((candidate) => (
          <Card key={candidate.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
              <p className="text-emerald-400/90 text-sm">{candidate.party}</p>
              <p className="text-slate-400 text-sm mt-1">{candidate.votes || 0} votes</p>
            </div>
            <Button
              variant="danger"
              onClick={() => handleDeleteCandidate(candidate.id)}
              className="shrink-0"
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>

      {/* Voters Management Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-white">Registered Voters (Face biometrics enrolled)</h2>
        <Button onClick={() => {
          setShowAddVoterForm(!showAddVoterForm);
          stopCamera();
        }} variant="secondary">
          {showAddVoterForm ? 'Cancel' : 'Register New Voter'}
        </Button>
      </div>

      {showAddVoterForm && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Add Voter & Capture Biometrics</h3>
          <p className="text-slate-400 text-sm mb-4">Enter voter details, enable camera, and capture face embeddings.</p>
          <form onSubmit={handleAddVoter} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Voter ID</label>
                <input
                  type="text"
                  value={voterFormData.voterId}
                  onChange={(e) => setVoterFormData({ ...voterFormData, voterId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="VOTER-12345"
                />
                {voterErrors.voterId && <p className="text-red-400 text-sm mt-1">{voterErrors.voterId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={voterFormData.name}
                  onChange={(e) => setVoterFormData({ ...voterFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="John Doe"
                />
                {voterErrors.name && <p className="text-red-400 text-sm mt-1">{voterErrors.name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={voterFormData.dob}
                  onChange={(e) => setVoterFormData({ ...voterFormData, dob: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {voterErrors.dob && <p className="text-red-400 text-sm mt-1">{voterErrors.dob}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mobile</label>
                <input
                  type="text"
                  value={voterFormData.mobile}
                  onChange={(e) => setVoterFormData({ ...voterFormData, mobile: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="9876543210"
                />
                {voterErrors.mobile && <p className="text-red-400 text-sm mt-1">{voterErrors.mobile}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Wallet Address</label>
              <input
                type="text"
                value={voterFormData.walletAddress}
                onChange={(e) => setVoterFormData({ ...voterFormData, walletAddress: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
              />
              {voterErrors.walletAddress && <p className="text-red-400 text-sm mt-1">{voterErrors.walletAddress}</p>}
            </div>

            {/* Webcam capture section */}
            <div className="border border-slate-700 bg-slate-900/60 p-4 rounded-xl flex flex-col md:flex-row items-center gap-5">
              <div className="relative w-full max-w-[200px] aspect-square rounded-lg border border-slate-600 bg-slate-950 overflow-hidden flex items-center justify-center">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-xs text-slate-500 text-center p-4">Camera inactive</div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex-1 space-y-3 w-full">
                <p className="text-xs text-slate-400">
                  Biometric Face Enrollment collects 10 face frames from the webcam to compute the voter's mathematical face vector.
                </p>
                <div className="flex flex-wrap gap-2">
                  {!cameraActive ? (
                    <Button type="button" onClick={startCamera} size="sm" variant="secondary">
                      Activate Camera
                    </Button>
                  ) : (
                    <>
                      <Button type="button" onClick={captureBiometrics} size="sm" variant="primary">
                        Capture Biometrics (10 Frames)
                      </Button>
                      <Button type="button" onClick={stopCamera} size="sm" variant="danger">
                        Deactivate
                      </Button>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                {captureProgress > 0 && (
                  <div className="space-y-1">
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className="bg-emerald-400 h-2 rounded-full transition-all duration-200" style={{ width: `${captureProgress}%` }} />
                    </div>
                    <p className="text-[10px] text-emerald-400 font-semibold">
                      {captureProgress === 100 ? 'Captured 10/10 frames' : `Capturing frames: ${captureProgress}%`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" loading={registerLoading} fullWidth>
              Register & Save Biometric Profile
            </Button>
          </form>
        </Card>
      )}

      {/* Voters List */}
      <div className="grid gap-4 mb-8">
        {approvedUsers.map((voter) => (
          <Card key={voter.voterId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{voter.name}</h3>
              <p className="text-slate-400 text-sm">Voter ID: {voter.voterId}</p>
              <p className="text-slate-400 text-sm">DOB: {voter.dob} · Mobile: {voter.mobile}</p>
              <p className="text-xs text-slate-500 mt-1 font-mono break-all">Wallet: {voter.walletAddress}</p>
            </div>
            <Button variant="danger" onClick={() => handleRemoveVoter(voter.voterId)} className="shrink-0">
              Remove
            </Button>
          </Card>
        ))}
        {approvedUsers.length === 0 && !showAddVoterForm && (
          <Card>
            <p className="text-slate-400 text-center">No voters registered. Add voters to enroll their face biometrics and permit them to vote.</p>
          </Card>
        )}
      </div>

      {/* Voting Results */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Voting Results</h2>
        <div className="space-y-3">
          {results.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <span className="text-slate-300">
                #{i + 1} {c.name} ({c.party})
              </span>
              <span className="font-semibold text-emerald-400">{c.votes || 0} votes</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
