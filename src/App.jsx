import { AuthProvider } from './context/AuthContext';
import { VotingProvider } from './context/VotingContext';
import { ApprovedUsersProvider } from './context/ApprovedUsersContext';
import { WalletProvider } from './context/WalletContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <AuthProvider>
      <ApprovedUsersProvider>
        <VotingProvider>
          <WalletProvider>
            <AppRoutes />
          </WalletProvider>
        </VotingProvider>
      </ApprovedUsersProvider>
    </AuthProvider>
  );
}