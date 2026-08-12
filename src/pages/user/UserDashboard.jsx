import { useState } from 'react';
import { useVoting } from '../../context/VotingContext';
import { useAuth } from '../../context/AuthContext';
import CandidateCard from '../../components/CandidateCard';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';
import { castVote as blockchainCastVote } from '../../services/blockchain';

export default function UserDashboard() {
  const { candidates, electionActive, castVote } = useVoting();
  const { user, login } = useAuth();
  const [votingId, setVotingId] = useState(null);

  const handleVote = async (candidateId) => {
    setVotingId(candidateId);
    try {
      const walletAddr = user?.walletAddress || '0x0000000000000000000000000000000000000000';
      
      // Step 1: Execute Blockchain Smart Contract (mocked in blockchain service)
      const txRes = await blockchainCastVote(candidateId, walletAddr);
      
      if (txRes.success) {
        // Simulate a block number for verification log purposes
        const mockBlockNumber = Math.floor(Math.random() * 500000) + 18000000;
        
        // Step 2: Log details to Express backend
        const logRes = await castVote(candidateId, txRes.txHash, mockBlockNumber);
        
        if (logRes.success) {
          // Step 3: Update local user state
          login({ ...user, hasVoted: true });
          toast.success('Vote successfully cast on-chain and verified!');
        }
      } else {
        toast.error('Smart contract execution failed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to cast vote');
    } finally {
      setVotingId(null);
    }
  };

  const hasVoted = user?.hasVoted;
  const canVote = electionActive && !hasVoted;
  const results = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">User Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-slate-400 text-sm">Election Status</p>
          <StatusBadge status={electionActive ? 'active' : 'ended'} />
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Your Status</p>
          <StatusBadge status={hasVoted ? 'voted' : 'not voted'} />
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Candidates</p>
          <p className="text-xl font-semibold text-white">{candidates.length}</p>
        </Card>
        <Card>
          <p className="text-slate-400 text-sm">Total Votes</p>
          <p className="text-xl font-semibold text-white">
            {candidates.reduce((s, c) => s + (c.votes || 0), 0)}
          </p>
        </Card>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Candidates</h2>
      <div className="grid gap-4 mb-8">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onVote={handleVote}
            canVote={canVote && !votingId}
            showVotes={!electionActive}
          />
        ))}
      </div>

      {!electionActive && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Final Results</h2>
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
      )}
    </div>
  );
}
