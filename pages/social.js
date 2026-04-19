import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SocialRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { chat, name } = router.query;
    if (chat) {
      router.replace(`/battle?chat=${chat}${name ? `&name=${encodeURIComponent(name)}` : ''}`);
    } else {
      router.replace('/battle');
    }
  }, [router.isReady, router.query.chat, router.query.name]);
  return null;
}
