// The old "Battle Replay" route has been superseded by the richer, public
// "Battle Summary" page at /battle/summary/[id]. We keep this route alive as a
// permanent server-side redirect so every existing replay link (social feed,
// notifications, shared URLs, etc.) auto-forwards to the new page. The moment
// (`m` / `moment`) query param is preserved.
export async function getServerSideProps(context) {
  const { id } = context.params || {};
  if (!id || typeof id !== 'string') {
    return { redirect: { destination: '/battle', permanent: false } };
  }
  const rawMoment = context.query?.m ?? context.query?.moment;
  const momentId = typeof rawMoment === 'string' && rawMoment
    ? rawMoment
    : (Array.isArray(rawMoment) ? rawMoment[0] : null);
  const momentQS = momentId ? `?m=${encodeURIComponent(momentId)}` : '';
  return {
    redirect: {
      destination: `/battle/summary/${encodeURIComponent(id)}${momentQS}`,
      permanent: false,
    },
  };
}

export default function BattleReplayRedirect() {
  return null;
}
