import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import toast from 'react-hot-toast';

export default function FaceVerification() {
  const { pendingUser, login, setPendingUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const [hasCamera, setHasCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Liveness Check States
  // Steps: 0 = Init/Idle, 1 = Blink Challenge, 2 = Smile Challenge, 3 = Face Verification, 4 = Success
  const [step, setStep] = useState(0);
  const [challengeStatus, setChallengeStatus] = useState('Verify your face to continue');
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(-1);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Check pending user or redirect back to login
  useEffect(() => {
    if (!pendingUser) {
      toast.error('Session expired. Please log in again.');
      navigate('/login', { replace: true });
    }
  }, [pendingUser, navigate]);

  // Start webcam
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCamera(true);
      setCameraActive(true);
      setStep(1); // Set to Blink Challenge step
      setChallengeStatus('Challenge 1: Please blink your eyes.');
    } catch (err) {
      console.error('Camera access denied:', err);
      toast.error('Unable to access camera. Please check permissions.');
      setHasCamera(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setStep(0);
    setChallengeStatus('Verify your face to continue');
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Capture frame as Base64 string
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    canvas.width = 400;
    canvas.height = 400;
    context.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Trigger countdown then execute step action
  const triggerChallenge = (challengeName, nextStepAction) => {
    if (!cameraActive) {
      toast.error('Please turn on the camera first.');
      return;
    }

    setProcessing(true);
    setCountdown(3);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          nextStepAction();
          return -1;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: Eye Blink Liveness
  const runBlinkChallenge = () => {
    triggerChallenge('blink', async () => {
      const imageBase64 = captureFrame();
      if (!imageBase64) {
        toast.error('Failed to capture frame.');
        setProcessing(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/verify-liveness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challenge: 'blink', image: imageBase64 }),
        });

        const data = await response.json();
        setProcessing(false);

        if (response.ok && data.success) {
          toast.success('Blink detected! Liveness Challenge 1 passed.');
          setStep(2);
          setChallengeStatus('Challenge 2: Please smile broadly.');
        } else {
          toast.error(data.message || 'Liveness check failed. Please blink your eyes.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed connection to liveness service.');
        setProcessing(false);
      }
    });
  };

  // Step 2: Smile Liveness
  const runSmileChallenge = () => {
    triggerChallenge('smile', async () => {
      const imageBase64 = captureFrame();
      if (!imageBase64) {
        toast.error('Failed to capture frame.');
        setProcessing(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/verify-liveness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challenge: 'smile', image: imageBase64 }),
        });

        const data = await response.json();
        setProcessing(false);

        if (response.ok && data.success) {
          toast.success('Smile detected! Liveness Challenge 2 passed.');
          setStep(3);
          setChallengeStatus('Liveness passed! Finalizing face match...');
        } else {
          toast.error(data.message || 'Liveness check failed. Please smile broadly.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed connection to liveness service.');
        setProcessing(false);
      }
    });
  };

  // Step 3: Face Verification Match Check
  const runFaceMatch = () => {
    triggerChallenge('verify', async () => {
      const imageBase64 = captureFrame();
      if (!imageBase64) {
        toast.error('Failed to capture frame.');
        setProcessing(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/verify-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voterId: pendingUser.voterId, image: imageBase64 }),
        });

        const data = await response.json();
        setProcessing(false);

        if (response.ok && data.success) {
          setStep(4);
          setChallengeStatus('Verification successful! Access granted.');
          toast.success(`Face matched successfully! Similarity score: ${data.score.toFixed(2)}`);
          
          setTimeout(() => {
            stopCamera();
            login(data.user, data.token); // Store logged-in user details and the short-lived JWT token
            setPendingUser(null);
            navigate(from, { replace: true });
          }, 1500);
        } else {
          toast.error(data.message || 'Face match failed.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Biometric verification failed.');
        setProcessing(false);
      }
    });
  };

  const handleCancel = () => {
    stopCamera();
    setPendingUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <Card>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Biometric Scan</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Liveness Challenge Active
          </span>
        </div>

        {/* Challenge Instructions */}
        <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-center">
          <p className="text-sm font-semibold text-slate-200">{challengeStatus}</p>
          {step > 0 && step < 4 && (
            <p className="text-[11px] text-slate-400 mt-1">
              Step {step} of 3 • Align your face inside the HUD box
            </p>
          )}
        </div>

        {/* Camera HUD Box */}
        <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shadow-inner">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
              {/* Target HUD Box */}
              <div className="absolute inset-0 border-[3px] border-emerald-500/30 m-6 rounded-full pointer-events-none flex items-center justify-center">
                <div className="absolute w-[90%] h-[90%] border border-dashed border-emerald-400/40 rounded-full" />
              </div>
              
              {/* Scanning visual sweep effect */}
              {processing && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,1)] animate-[bounce_2s_infinite]" />
              )}

              {/* Countdown overlay */}
              {countdown > -1 && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-6xl font-black text-emerald-400 animate-ping">
                    {countdown}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-6 space-y-3">
              <span className="text-4xl">📸</span>
              <p className="text-sm text-slate-400">Webcam stream is inactive</p>
              <Button onClick={startCamera} size="sm">
                Enable Camera
              </Button>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Buttons / Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {cameraActive && (
            <>
              {step === 1 && (
                <Button onClick={runBlinkChallenge} loading={processing} fullWidth>
                  {processing ? 'Processing Blink...' : 'Trigger Blink Check'}
                </Button>
              )}
              {step === 2 && (
                <Button onClick={runSmileChallenge} loading={processing} fullWidth>
                  {processing ? 'Processing Smile...' : 'Trigger Smile Check'}
                </Button>
              )}
              {step === 3 && (
                <Button onClick={runFaceMatch} loading={processing} fullWidth>
                  {processing ? 'Verifying Profile...' : 'Trigger Face Verification'}
                </Button>
              )}
              {step === 4 && (
                <Button disabled fullWidth>
                  Access Authorized
                </Button>
              )}
            </>
          )}
          
          <button
            onClick={handleCancel}
            className="w-full text-slate-500 hover:text-slate-300 text-sm font-semibold py-2.5 transition-colors"
          >
            Cancel Login
          </button>
        </div>
      </div>
    </Card>
  );
}
