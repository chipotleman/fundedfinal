import '../styles/globals.css';
import TopNavbar from '../components/TopNavbar';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { useState } from 'react';

export default function App({ Component, pageProps }) {
  const [bankroll, setBankroll] = useState(1000);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showBetSlip, setShowBetSlip] = useState(false);

  const handleShowBalance = () => setShowWalletModal(true);
  const handleShowBetSlip = () => setShowBetSlip(true);

  return (
    <BetSlipProvider>
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
    </BetSlipProvider>
  );
}
