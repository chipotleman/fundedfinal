// pages/_app.js
import "../styles/globals.css";
import TopNavbar from "../components/TopNavbar";
import { useState } from "react";

function MyApp({ Component, pageProps }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [showWalletModal, setShowWalletModal] = useState(false);

  return (
    <>
      <TopNavbar
        selectedBets={selectedBets}
        setSelectedBets={setSelectedBets}
        bankroll={bankroll}
        setBankroll={setBankroll}
        setShowWalletModal={setShowWalletModal}
      />

      {/* Page Content */}
      <Component
        {...pageProps}
        selectedBets={selectedBets}
        setSelectedBets={setSelectedBets}
        bankroll={bankroll}
        setBankroll={setBankroll}
      />

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-900 border border-green-600 rounded-2xl p-6 w-80 text-center text-white shadow-2xl">
            <h2 className="text-xl font-bold neon-text mb-2">Your Bankroll</h2>
            <p className="text-lg text-green-400 mb-4">${bankroll}</p>
            <button
              onClick={() => setShowWalletModal(false)}
              className="bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MyApp;
