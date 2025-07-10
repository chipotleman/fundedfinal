// pages/_app.js

import Head from 'next/head';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>RollrFunded Sportsbook</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Funded sports betting platform by RollrFunded" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
