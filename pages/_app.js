import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          <Component {...pageProps} />
        </UserProfilesProvider>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default MyApp;