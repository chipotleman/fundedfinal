
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Withdraw() {
  const [selectedMethod, setSelectedMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [bankroll, setBankroll] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Bank details
    accountNumber: '',
    routingNumber: '',
    accountHolderName: '',
    // Card details
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardHolderName: '',
    // Digital wallets
    venmoUsername: '',
    cashappTag: '',
    paypalEmail: ''
  });
  const router = useRouter();

  useEffect(() => {
    // Get user bankroll
    const userBankroll = localStorage.getItem('demo_bankroll');
    setBankroll(userBankroll ? parseFloat(userBankroll) : 10000);
  }, []);

  const paymentMethods = [
    {
      id: 'bank',
      name: 'Bank Transfer',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
      ),
      description: '1-3 business days'
    },
    {
      id: 'card',
      name: 'Debit Card',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm3 5a1 1 0 000 2h10a1 1 0 100-2H5z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Instant transfer'
    },
    {
      id: 'venmo',
      name: 'Venmo',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5 9.293 10.793a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Instant transfer'
    },
    {
      id: 'cashapp',
      name: 'Cash App',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Instant transfer'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Instant transfer'
    }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMethod || !amount) return;

    setLoading(true);
    
    // Simulate processing
    setTimeout(() => {
      alert(`Withdrawal request submitted! $${amount} will be sent to your ${selectedMethod} within the specified timeframe.`);
      setLoading(false);
      router.push('/dashboard');
    }, 2000);
  };

  const renderPaymentForm = () => {
    switch (selectedMethod) {
      case 'bank':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Account Holder Name</label>
              <input
                type="text"
                value={formData.accountHolderName}
                onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Full name on account"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Account Number</label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Account number"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Routing Number</label>
              <input
                type="text"
                value={formData.routingNumber}
                onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="9-digit routing number"
                required
              />
            </div>
          </div>
        );
      case 'card':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cardholder Name</label>
              <input
                type="text"
                value={formData.cardHolderName}
                onChange={(e) => handleInputChange('cardHolderName', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Name on card"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Card Number</label>
              <input
                type="text"
                value={formData.cardNumber}
                onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="1234 5678 9012 3456"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Expiry Date</label>
                <input
                  type="text"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="MM/YY"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">CVV</label>
                <input
                  type="text"
                  value={formData.cvv}
                  onChange={(e) => handleInputChange('cvv', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="123"
                  required
                />
              </div>
            </div>
          </div>
        );
      case 'venmo':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Venmo Username</label>
            <input
              type="text"
              value={formData.venmoUsername}
              onChange={(e) => handleInputChange('venmoUsername', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="@username"
              required
            />
          </div>
        );
      case 'cashapp':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cash App Tag</label>
            <input
              type="text"
              value={formData.cashappTag}
              onChange={(e) => handleInputChange('cashappTag', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="$cashtag"
              required
            />
          </div>
        );
      case 'paypal':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">PayPal Email</label>
            <input
              type="email"
              value={formData.paypalEmail}
              onChange={(e) => handleInputChange('paypalEmail', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="your@email.com"
              required
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 py-3 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                Withdraw Funds
              </h1>
              <p className="text-green-100 mt-1 text-sm sm:text-base">
                Available Balance: ${bankroll.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="bg-white/20 hover:bg-white/30 rounded-lg p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Amount Input */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Withdrawal Amount</h2>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-4 py-4 text-white text-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                min="1"
                max={bankroll}
                step="0.01"
                required
              />
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-400">Minimum: $1</span>
              <button
                type="button"
                onClick={() => setAmount(bankroll.toString())}
                className="text-green-400 hover:text-green-300"
              >
                Withdraw All
              </button>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Select Payment Method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    selectedMethod === method.id
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      selectedMethod === method.id ? 'bg-green-500 text-white' : 'bg-slate-600 text-gray-300'
                    }`}>
                      {method.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{method.name}</div>
                      <div className="text-xs text-gray-400">{method.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Details Form */}
          {selectedMethod && (
            <div className="bg-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Payment Details</h2>
              {renderPaymentForm()}
            </div>
          )}

          {/* Submit Button */}
          {selectedMethod && amount && (
            <div className="bg-slate-800 rounded-2xl p-6">
              <div className="mb-4 p-4 bg-slate-700 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300">Withdrawal Amount:</span>
                  <span className="text-white font-medium">${amount}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300">Processing Fee:</span>
                  <span className="text-white font-medium">$0.00</span>
                </div>
                <div className="border-t border-slate-600 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-white font-medium">Total to Receive:</span>
                    <span className="text-green-400 font-bold">${amount}</span>
                  </div>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:transform-none"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5 9.293 10.793a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Complete Withdrawal</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
