import { useTheme } from '../contexts/ThemeContext';
import TopNavbar from '../components/TopNavbar';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  const { isDarkMode } = useTheme();

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDarkMode ? '#000000' : '#f5f5f5' }}>
      <TopNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
            Privacy Policy
          </h1>
          
          <div className="space-y-6" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
            <p>
              <strong>Last Updated:</strong> January 2026
            </p>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Information We Collect
              </h2>
              <p className="mb-3">We collect information you provide directly to us, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account information (name, email, username)</li>
                <li>Profile information (avatar, bio)</li>
                <li>Transaction and betting history</li>
                <li>Communications with our support team</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To provide and maintain our services</li>
                <li>To process transactions and send related information</li>
                <li>To send promotional communications (with your consent)</li>
                <li>To detect and prevent fraud</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Information Sharing
              </h2>
              <p>
                We do not sell your personal information. We may share your information with third parties only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>With service providers who assist in our operations</li>
                <li>To protect our rights and prevent fraud</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Data Security
              </h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your information</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>
                Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:help@thepiks.com" className="underline" style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}>
                  help@thepiks.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
