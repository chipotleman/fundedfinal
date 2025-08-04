
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.ico" />
        
        {/* Open Graph / Social Media Meta Tags */}
        <meta property="og:title" content="FundMyBet - Get Funded to Bet" />
        <meta property="og:description" content="Get funded up to $25,000 to bet with and keep 80% of your profits. No risk betting with our money, not yours." />
        <meta property="og:image" content="/funder-social-banner.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fundmybet.com" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FundMyBet - Get Funded to Bet" />
        <meta name="twitter:description" content="Get funded up to $25,000 to bet with and keep 80% of your profits. No risk betting with our money, not yours." />
        <meta name="twitter:image" content="/funder-social-banner.png" />
        
        {/* General Meta Tags */}
        <meta name="description" content="Get funded up to $25,000 to bet with and keep 80% of your profits. No risk betting with our money, not yours." />
        <meta name="keywords" content="sports betting, funded betting, no risk betting, profit sharing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
