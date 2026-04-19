import TopNavbar from '../components/TopNavbar';
import Footer from '../components/Footer';

export default function TermsOfUse() {

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8" style={{ color: '#ffffff' }}>
            Terms of Use
          </h1>
          
          <div className="space-y-6" style={{ color: '#d1d5db' }}>
            <p>
              <strong>Last Updated:</strong> January 2026
            </p>

            <p>
              By accessing or using Piks, you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our services.
            </p>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                1. Eligibility
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You must be at least 21 years old to use Piks</li>
                <li>You must be located in a jurisdiction where our services are legal</li>
                <li>You may only maintain one account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                2. Account Responsibilities
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must provide accurate and complete information</li>
                <li>You are responsible for all activity under your account</li>
                <li>You must notify us immediately of any unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                3. Prohibited Conduct
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Using the platform for illegal purposes</li>
                <li>Attempting to manipulate or cheat the system</li>
                <li>Creating multiple accounts</li>
                <li>Sharing account credentials</li>
                <li>Using automated systems or bots</li>
                <li>Harassing other users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                4. Challenge Rules
              </h2>
              <p>
                All challenges are subject to the House Rules. Violation of challenge rules may result in disqualification and forfeiture of any winnings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                5. Intellectual Property
              </h2>
              <p>
                All content on Piks, including logos, text, graphics, and software, is the property of Piks and protected by intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                6. Limitation of Liability
              </h2>
              <p>
                Piks is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                7. Termination
              </h2>
              <p>
                We reserve the right to suspend or terminate your account at any time for violation of these terms or for any other reason at our discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                8. Contact
              </h2>
              <p>
                For questions about these Terms of Use, contact us at{' '}
                <a href="mailto:help@thepiks.com" className="underline" style={{ color: '#60a5fa' }}>
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
