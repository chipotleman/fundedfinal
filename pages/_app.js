// pages/_app.js
import "../styles/globals.css";
import TopNavbar from "../components/TopNavbar";
import { useState } from "react";

function MyApp({ Component, pageProps }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [bankroll, setBankroll] = useState(1000);

  return (
    <>
      <TopNavbar
        selectedBets={selectedBets}
        setSelectedBets={setSelectedBets}
        bankroll={bankroll}
      />
      <Component
        {...pageProps}
        selectedBets={selectedBets}
        setSelectedBets={setSelectedBets}
        bankroll={bankroll}
        setBankroll={setBankroll}
      />
    </>
  );
}

export default MyApp;
