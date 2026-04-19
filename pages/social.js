import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SocialRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { chat } = router.query;
    if (chat) {
      router.replace(`/notifications?chat=${chat}`);
    } else {
      router.replace('/notifications');
    }
  }, [router.isReady, router.query.chat]);
  return null;
}
