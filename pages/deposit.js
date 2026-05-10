import Head from 'next/head';
import ComingSoonExplainer from '../components/ComingSoonExplainer';

// Public-facing /deposit route. During beta this page is intentionally
// a "coming soon" explainer. After beta we can swap this for the real
// funding flow.

export default function DepositPage() {
  return (
    <>
      <Head>
        <title>Deposits — Coming Soon | Piks</title>
        <meta name="robots" content="noindex" />
      </Head>
      <ComingSoonExplainer kind="deposit" />
    </>
  );
}
