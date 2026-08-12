import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const VotingContext = createContext(null);

export const useVoting = () => {
  const context = useContext(VotingContext);
  if (!context) {
    throw new Error('useVoting must be used within VotingProvider');
  }
  return context;
};

export const VotingProvider = ({ children }) => {
  const [candidates, setCandidates] = useState([]);
  const [electionActive, setElectionActive] = useState(() => {
    const saved = localStorage.getItem('voting_election_active');
    return saved !== null ? saved === 'true' : true;
  });
  const [results, setResults] = useState([]);

  // Fetch candidates from Express backend on mount
  const fetchCandidates = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/vote/candidates');
      if (response.ok) {
        const data = await response.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error('Failed to load candidates:', err);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const addCandidate = (newCandidate) => {
    setCandidates((prev) => [...prev, newCandidate]);
  };

  const deleteCandidate = (id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  // Cast vote sends vote logs to Node.js backend using the biometric JWT session token
  const castVote = async (candidateId, transactionHash, blockNumber) => {
    const token = localStorage.getItem('voting_jwt');
    if (!token) {
      toast.error('Session expired or unauthorized. Face verification required.');
      return { success: false };
    }

    try {
      const response = await fetch('http://localhost:5000/api/vote/cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          candidateId,
          transactionHash,
          blockNumber
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Update local candidates votes state
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidateId ? { ...c, votes: (c.votes || 0) + 1 } : c))
        );
        
        // Remove short-lived JWT token after successful vote
        localStorage.removeItem('voting_jwt');
        
        return { success: true };
      } else {
        toast.error(data.message || 'Failed to submit vote record to backend');
        return { success: false };
      }
    } catch (err) {
      console.error('Vote Logging API Error:', err);
      toast.error('Network error registering vote.');
      return { success: false };
    }
  };

  const toggleElection = () => {
    const newState = !electionActive;
    setElectionActive(newState);
    localStorage.setItem('voting_election_active', String(newState));
    if (!newState) {
      fetchResults();
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/vote/results');
      if (response.ok) {
        const data = await response.json();
        setResults(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to load results:', err);
    }
    return [];
  };

  const getResults = () => {
    return [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  };

  return (
    <VotingContext.Provider
      value={{
        candidates,
        electionActive,
        results: results.length ? results : getResults(),
        addCandidate,
        deleteCandidate,
        castVote,
        toggleElection,
        getResults,
        setElectionActive,
        fetchResults
      }}
    >
      {children}
    </VotingContext.Provider>
  );
};
