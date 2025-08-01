import '../styles/globals.css';
import TopNavbar from '../components/TopNavbar';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useState } from 'react';

export default function App({ Component, pageProps }) {
  const [bankroll, setBankroll] = useState(1000);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showBetSlip, setShowBetSlip] = useState(false);

  const handleShowBalance = () => setShowWalletModal(true);
  const handleShowBetSlip = () => setShowBetSlip(true);

  return (
    <ThemeProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          <Component
            {...pageProps}
            bankroll={bankroll}
            setBankroll={setBankroll}
            selectedBets={selectedBets}
            setSelectedBets={setSelectedBets}
            showWalletModal={showWalletModal}
            setShowWalletModal={setShowWalletModal}
            showBetSlip={showBetSlip}
            setShowBetSlip={setShowBetSlip}
          />
        </UserProfilesProvider>
      </BetSlipProvider>
    </ThemeProvider>
  );
}
