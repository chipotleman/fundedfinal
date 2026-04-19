import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="px-4 sm:px-6 lg:px-8 py-8 mt-8 border-t"
      style={{ 
        backgroundColor: '#000000',
        borderColor: '#1f2937'
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/rules" className="text-sm underline" style={{ color: '#9ca3af' }}>
            House Rules
          </Link>
          <span style={{ color: '#4b5563' }}>·</span>
          <Link href="/responsible-pikking" className="text-sm underline" style={{ color: '#9ca3af' }}>
            Responsible Pikking
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/privacy" className="text-sm underline" style={{ color: '#9ca3af' }}>
            Privacy Policy
          </Link>
          <span style={{ color: '#4b5563' }}>·</span>
          <Link href="/terms" className="text-sm underline" style={{ color: '#9ca3af' }}>
            Terms of Use
          </Link>
          <span style={{ color: '#4b5563' }}>·</span>
          <Link href="/data-privacy" className="text-sm underline" style={{ color: '#9ca3af' }}>
            Data Privacy Request
          </Link>
        </div>

        <div className="mb-6">
          <Link href="/pikking-101" className="text-sm underline" style={{ color: '#9ca3af' }}>
            Pikking 101
          </Link>
        </div>

        <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>
          © Piks, {currentYear}
        </p>

        <p className="text-sm" style={{ color: '#9ca3af' }}>
          For customer support, please contact us at{' '}
          <a href="mailto:help@thepiks.com" className="underline" style={{ color: '#9ca3af' }}>
            help@thepiks.com
          </a>
        </p>
      </div>
    </footer>
  );
}
