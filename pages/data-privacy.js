import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';
import Footer from '../components/Footer';

export default function DataPrivacyRequest() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    requestType: '',
    details: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8" style={{ color: '#ffffff' }}>
            Data Privacy Request
          </h1>
          
          <div className="space-y-6" style={{ color: '#d1d5db' }}>
            <p>
              You have the right to request access to, correction of, or deletion of your personal data. Use the form below to submit your request.
            </p>

            {submitted ? (
              <div 
                className="p-6 rounded-lg text-center"
                style={{ backgroundColor: '#1f2937' }}
              >
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#ffffff' }}>
                  Request Submitted
                </h2>
                <p>
                  Thank you for your request. We will review it and respond within 30 days. You will receive a confirmation email at {formData.email}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      color: '#ffffff'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      color: '#ffffff'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    Request Type
                  </label>
                  <select
                    name="requestType"
                    value={formData.requestType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Select a request type</option>
                    <option value="access">Access my data</option>
                    <option value="correction">Correct my data</option>
                    <option value="deletion">Delete my data</option>
                    <option value="portability">Export my data</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    Additional Details
                  </label>
                  <textarea
                    name="details"
                    value={formData.details}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      color: '#ffffff'
                    }}
                    placeholder="Please provide any additional information about your request..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-lg font-semibold transition-colors"
                  style={{
                    backgroundColor: '#22c55e',
                    color: '#ffffff'
                  }}
                >
                  Submit Request
                </button>
              </form>
            )}

            <p className="text-sm" style={{ color: '#9ca3af' }}>
              You can also submit requests by emailing{' '}
              <a href="mailto:help@thepiks.com" className="underline" style={{ color: '#60a5fa' }}>
                help@thepiks.com
              </a>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
