import { useTheme } from '../contexts/ThemeContext';
import TopNavbar from '../components/TopNavbar';
import Footer from '../components/Footer';

export default function ResponsiblePikking() {
  const { isDarkMode } = useTheme();

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDarkMode ? '#000000' : '#f5f5f5' }}>
      <TopNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
            Responsible Pikking
          </h1>
          
          <div className="space-y-6" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
            <p>
              At Piks, we are committed to promoting responsible gaming practices. We want all of our users to enjoy our platform safely and responsibly.
            </p>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Know Your Limits
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Set a budget and stick to it</li>
                <li>Never chase losses</li>
                <li>Take regular breaks</li>
                <li>Don't let pikking interfere with work, family, or other responsibilities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Warning Signs
              </h2>
              <p className="mb-3">If you experience any of the following, it may be time to seek help:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Spending more than you can afford</li>
                <li>Feeling anxious or stressed about betting</li>
                <li>Hiding your betting activity from others</li>
                <li>Borrowing money to bet</li>
                <li>Neglecting responsibilities due to betting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Self-Exclusion
              </h2>
              <p>
                If you feel you need to take a break, contact our support team at{' '}
                <a href="mailto:help@thepiks.com" className="underline" style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}>
                  help@thepiks.com
                </a>{' '}
                to request a temporary or permanent self-exclusion from the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Get Help
              </h2>
              <p className="mb-3">If you or someone you know has a gambling problem, help is available:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>National Council on Problem Gambling:</strong>{' '}
                  <a href="tel:1-800-522-4700" className="underline" style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}>
                    1-800-522-4700
                  </a>
                </li>
                <li>
                  <strong>Gamblers Anonymous:</strong>{' '}
                  <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}>
                    www.gamblersanonymous.org
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
