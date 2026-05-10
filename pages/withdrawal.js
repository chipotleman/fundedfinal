import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import Head from 'next/head';
import { formatMoney } from '../utils/formatMoney';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import ComingSoonExplainer from '../components/ComingSoonExplainer';

const withdrawalMethods = [
  {
    id: 'bank_transfer',
    name: 'Bank Transfer (ACH)',
    description: 'Direct deposit to your bank account',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    fee: 'Free',
    time: '3-5 business days',
    minAmount: 100,
  },
  {
    id: 'instant_transfer',
    name: 'Instant Transfer',
    description: 'Receive funds within minutes',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    fee: '1.5%',
    time: 'Within 30 minutes',
    minAmount: 50,
  },
  {
    id: 'venmo',
    name: 'Venmo',
    description: 'Send to your Venmo account',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3.5C20.5 5 21 6.5 21 8.5c0 5-4 11-7.5 15H6l-2.5-15 6-0.5 1 10c1.5-2.5 3-6 3-8.5 0-1.5-0.5-2.5-1-3.5l4.5-2.5z"/>
      </svg>
    ),
    fee: 'Free',
    time: '1-2 business days',
    minAmount: 25,
  },
  {
    id: 'wire',
    name: 'Wire Transfer',
    description: 'International wire transfer',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    fee: '$25',
    time: '1-3 business days',
    minAmount: 500,
  },
  {
    id: 'check',
    name: 'Check',
    description: 'Mailed check to your address',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    fee: 'Free',
    time: '7-10 business days',
    minAmount: 100,
  },
];

const statusColors = {
  under_review: 'text-yellow-400 bg-yellow-400/10',
  awaiting_processing: 'text-blue-400 bg-blue-400/10',
  finalized: 'text-green-400 bg-green-400/10',
  denied: 'text-red-400 bg-red-400/10',
  cancelled: 'text-gray-400 bg-gray-400/10',
};

const statusLabels = {
  under_review: 'Under Review',
  awaiting_processing: 'Processing',
  finalized: 'Completed',
  denied: 'Denied',
  cancelled: 'Cancelled',
};

// Thin wrapper: in beta we short-circuit to the cartoon explainer
// BEFORE the inner component (with all its hooks) ever mounts. This
// keeps the hook order stable across `betaMode` flips — a plain
// early-return inside a single component would call useSession +
// useRouter + useSiteConfig, then bail out, then on flip call all of
// the inner-component hooks too, which violates Rules of Hooks.
export default function WithdrawalPage() {
  const { betaMode } = useSiteConfig();
  if (betaMode) {
    return (
      <>
        <Head><title>Withdrawals — Coming Soon | Piks</title></Head>
        <ComingSoonExplainer kind="withdraw" />
      </>
    );
  }
  return <WithdrawalInner />;
}

function WithdrawalInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savedMethods, setSavedMethods] = useState([]);
  const [selectedSavedMethod, setSelectedSavedMethod] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [depositBonus, setDepositBonus] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewMethodForm, setShowNewMethodForm] = useState(false);
  const [saveMethod, setSaveMethod] = useState(false);
  const [methodNickname, setMethodNickname] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [successDetails, setSuccessDetails] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [expandedWithdrawal, setExpandedWithdrawal] = useState(null);
  const [step, setStep] = useState('picker');
  
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: 'checking',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    venmoUsername: '',
    swiftCode: '',
    street: '',
    city: '',
    state: '',
    zip: '',
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      try {
        const [profileRes, methodsRes, withdrawalsRes, depositRes] = await Promise.all([
          fetch(`/api/profiles/${session.user.id}`),
          fetch(`/api/payment-methods`),
          fetch(`/api/withdrawals`),
          fetch(`/api/user/has-deposited`, { credentials: 'include' }),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserProfile(profile);
        }
        if (methodsRes.ok) {
          const methods = await methodsRes.json();
          setSavedMethods(methods);
        }
        if (withdrawalsRes.ok) {
          const wds = await withdrawalsRes.json();
          setWithdrawals(wds);
        }
        if (depositRes.ok) {
          const data = await depositRes.json();
          if (data?.matchGranted) {
            const amt = parseFloat(data.matchAmount);
            if (Number.isFinite(amt) && amt > 0) {
              setDepositBonus({ amount: amt, grantedAt: data.grantedAt || null });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router]);

  const currentBalance = userProfile?.bankroll ? parseFloat(userProfile.bankroll) : 0;
  const availableToWithdraw = Math.max(0, Math.floor(currentBalance));

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getPaymentDetails = () => {
    switch (selectedMethod) {
      case 'bank_transfer':
        return {
          bankName: formData.bankName,
          accountNumberLast4: formData.accountNumber.slice(-4),
          routingNumber: formData.routingNumber,
          accountType: formData.accountType,
        };
      case 'instant_transfer':
        return {
          cardLast4: formData.cardNumber.slice(-4),
          cardBrand: detectCardBrand(formData.cardNumber),
          cardExpiry: formData.cardExpiry,
        };
      case 'venmo':
        return { venmoUsername: formData.venmoUsername };
      case 'wire':
        return {
          bankName: formData.bankName,
          accountNumberLast4: formData.accountNumber.slice(-4),
          routingNumber: formData.routingNumber,
          swiftCode: formData.swiftCode,
        };
      case 'check':
        return {
          mailingAddress: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
        };
      default:
        return {};
    }
  };

  const detectCardBrand = (number) => {
    const n = number.replace(/\s/g, '');
    if (n.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^6(?:011|5)/.test(n)) return 'Discover';
    return 'Card';
  };

  const handleWithdraw = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSuccessMessage('');

    try {
      const paymentDetails = selectedSavedMethod 
        ? savedMethods.find(m => m.id === selectedSavedMethod)
        : getPaymentDetails();

      if (saveMethod && !selectedSavedMethod) {
        const methodData = {
          methodType: selectedMethod,
          nickname: methodNickname || `My ${withdrawalMethods.find(m => m.id === selectedMethod)?.name}`,
          isDefault: savedMethods.length === 0,
          ...getPaymentMethodFields(),
        };

        await fetch('/api/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(methodData),
        });
      }

      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: selectedSavedMethod,
          methodType: selectedMethod,
          amount: parseFloat(amount),
          paymentDetails,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWithdrawals(prev => [data.withdrawal, ...prev]);
        const methodInfo = withdrawalMethods.find(m => m.id === selectedMethod);
        setSuccessDetails({
          type: 'submitted',
          amount: parseFloat(amount),
          methodName: methodInfo?.name || selectedMethod,
          estimatedTime: methodInfo?.time || 'Processing',
          fee: methodInfo?.fee || 'Free',
        });
        setSuccessMessage('submitted');
        if (data.newBankroll) {
          setUserProfile(prev => prev ? { ...prev, bankroll: data.newBankroll } : prev);
        }
        setAmount('');
        setSelectedMethod(null);
        setSelectedSavedMethod(null);
        setShowNewMethodForm(false);
        setStep('picker');
        setFormData({
          bankName: '',
          accountNumber: '',
          routingNumber: '',
          accountType: 'checking',
          cardNumber: '',
          cardExpiry: '',
          cardCvv: '',
          venmoUsername: '',
          swiftCode: '',
          street: '',
          city: '',
          state: '',
          zip: '',
        });
      } else {
        const error = await res.json();
        alert(error.message || 'Failed to submit withdrawal request');
      }
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWithdrawal = async (withdrawalId) => {
    if (cancelling) return;
    if (!confirm('Are you sure you want to cancel this withdrawal? The funds will be returned to your balance.')) return;
    
    setCancelling(withdrawalId);
    try {
      const res = await fetch(`/api/withdrawals/${withdrawalId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(prev => prev.map(w => 
          w.id === withdrawalId ? data.withdrawal : w
        ));
        if (data.newBankroll) {
          setUserProfile(prev => prev ? { ...prev, bankroll: data.newBankroll } : prev);
        }
        const cancelledMethod = withdrawals.find(w => w.id === withdrawalId);
        const methodInfo = cancelledMethod ? withdrawalMethods.find(m => m.id === cancelledMethod.methodType) : null;
        setSuccessDetails({
          type: 'cancelled',
          amount: data.refundedAmount,
          methodName: methodInfo?.name || 'Unknown',
        });
        setSuccessMessage('cancelled');
      } else {
        const error = await res.json();
        alert(error.message || 'Failed to cancel withdrawal');
      }
    } catch (error) {
      console.error('Error cancelling withdrawal:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  const getPaymentMethodFields = () => {
    switch (selectedMethod) {
      case 'bank_transfer':
        return {
          bankName: formData.bankName,
          accountNumber: formData.accountNumber.slice(-4),
          routingNumber: formData.routingNumber,
          accountType: formData.accountType,
        };
      case 'instant_transfer':
        return {
          cardLast4: formData.cardNumber.slice(-4),
          cardBrand: detectCardBrand(formData.cardNumber),
          cardExpiry: formData.cardExpiry,
        };
      case 'venmo':
        return { venmoUsername: formData.venmoUsername };
      case 'wire':
        return {
          bankName: formData.bankName,
          accountNumber: formData.accountNumber.slice(-4),
          routingNumber: formData.routingNumber,
          swiftCode: formData.swiftCode,
        };
      case 'check':
        return {
          mailingAddress: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
        };
      default:
        return {};
    }
  };

  const renderPaymentForm = () => {
    if (!selectedMethod) return null;

    const savedForMethod = savedMethods.filter(m => m.methodType === selectedMethod);

    return (
      <div className="bg-[#111111] rounded-2xl p-6 border border-[#1a1a1a]/50 mb-6">
        <h3 className="text-white font-semibold mb-4">Payment Details</h3>
        
        {savedForMethod.length > 0 && !showNewMethodForm && (
          <>
            <div className="space-y-2 mb-4">
              {savedForMethod.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedSavedMethod(method.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedSavedMethod === method.id
                      ? 'bg-green-500/10 border-green-500/50'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#1a1a1a]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{method.nickname || 'Saved Method'}</div>
                      <div className="text-gray-500 text-sm">
                        {method.methodType === 'bank_transfer' && `Bank: ****${method.accountNumber}`}
                        {method.methodType === 'instant_transfer' && `${method.cardBrand} ****${method.cardLast4}`}
                        {method.methodType === 'venmo' && `@${method.venmoUsername}`}
                        {method.methodType === 'wire' && `Bank: ****${method.accountNumber}`}
                        {method.methodType === 'check' && method.mailingAddress?.city}
                      </div>
                    </div>
                    {selectedSavedMethod === method.id && (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowNewMethodForm(true); setSelectedSavedMethod(null); }}
              className="text-green-400 hover:text-green-300 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add new payment method
            </button>
          </>
        )}

        {(savedForMethod.length === 0 || showNewMethodForm) && (
          <>
            {savedForMethod.length > 0 && (
              <button
                onClick={() => setShowNewMethodForm(false)}
                className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to saved methods
              </button>
            )}
            
            {selectedMethod === 'bank_transfer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Bank Name</label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Routing Number</label>
                    <input
                      type="text"
                      name="routingNumber"
                      value={formData.routingNumber}
                      onChange={handleFormChange}
                      maxLength={9}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="9 digits"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Account Number</label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="Account number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Account Type</label>
                  <select
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
              </div>
            )}

            {selectedMethod === 'instant_transfer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Debit Card Number</label>
                  <input
                    type="text"
                    name="cardNumber"
                    value={formData.cardNumber}
                    onChange={handleFormChange}
                    maxLength={19}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Expiry Date</label>
                    <input
                      type="text"
                      name="cardExpiry"
                      value={formData.cardExpiry}
                      onChange={handleFormChange}
                      maxLength={5}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">CVV</label>
                    <input
                      type="text"
                      name="cardCvv"
                      value={formData.cardCvv}
                      onChange={handleFormChange}
                      maxLength={4}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="123"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'venmo' && (
              <div>
                <label className="block text-gray-400 text-sm mb-1">Venmo Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                  <input
                    type="text"
                    name="venmoUsername"
                    value={formData.venmoUsername}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 pl-8 pr-4 text-white focus:outline-none focus:border-blue-500"
                    placeholder="username"
                  />
                </div>
              </div>
            )}

            {selectedMethod === 'wire' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Bank Name</label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Routing Number</label>
                    <input
                      type="text"
                      name="routingNumber"
                      value={formData.routingNumber}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="Routing number"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Account Number</label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="Account number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">SWIFT/BIC Code</label>
                  <input
                    type="text"
                    name="swiftCode"
                    value={formData.swiftCode}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                    placeholder="SWIFT code"
                  />
                </div>
              </div>
            )}

            {selectedMethod === 'check' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Street Address</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleFormChange}
                      maxLength={2}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="CA"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">ZIP Code</label>
                    <input
                      type="text"
                      name="zip"
                      value={formData.zip}
                      onChange={handleFormChange}
                      maxLength={10}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveMethod}
                  onChange={(e) => setSaveMethod(e.target.checked)}
                  className="w-5 h-5 rounded bg-[#0a0a0a] border-[#1a1a1a] text-green-500 focus:ring-blue-500"
                />
                <span className="text-gray-300">Save this payment method for future use</span>
              </label>
              {saveMethod && (
                <input
                  type="text"
                  value={methodNickname}
                  onChange={(e) => setMethodNickname(e.target.value)}
                  className="mt-3 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-2 px-4 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Nickname (e.g., My Chase Account)"
                />
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const isFormValid = () => {
    if (!selectedMethod || !amount || parseFloat(amount) <= 0) return false;
    if (selectedSavedMethod) return true;
    
    switch (selectedMethod) {
      case 'bank_transfer':
        return formData.bankName && formData.accountNumber && formData.routingNumber;
      case 'instant_transfer':
        return formData.cardNumber && formData.cardExpiry && formData.cardCvv;
      case 'venmo':
        return formData.venmoUsername;
      case 'wire':
        return formData.bankName && formData.accountNumber && formData.routingNumber && formData.swiftCode;
      case 'check':
        return formData.street && formData.city && formData.state && formData.zip;
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Withdrawal - Piks</title>
      </Head>
      <TopNavbar />
      
      <style jsx global>{`
        @keyframes withdrawalStepIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .withdrawal-step-anim { animation: withdrawalStepIn 220ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .withdrawal-step-anim { animation: none; }
        }
      `}</style>
      <div className="min-h-screen bg-black pt-4 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Withdraw Funds</h1>
            {withdrawals.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="lg:hidden text-green-400 hover:text-green-300 text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>
            )}
          </div>
          <p className="text-gray-400 mb-6">Transfer your earnings to your preferred account</p>

          {successMessage && successDetails && (
            <div className="relative bg-gradient-to-br from-[#111111] to-[#0a0a0a] rounded-2xl p-6 border border-green-500/30 mb-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {successMessage === 'cancelled' ? 'Withdrawal Cancelled' : 'Withdrawal Submitted'}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {successMessage === 'cancelled' 
                          ? 'Funds have been returned to your balance' 
                          : 'Your request is now under review'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSuccessMessage(''); setSuccessDetails(null); }}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="bg-black/30 rounded-xl p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-2xl font-bold text-green-400">${successDetails.amount?.toLocaleString()}</span>
                  </div>
                  
                  {successMessage !== 'cancelled' && (
                    <>
                      <div className="flex items-center justify-between py-2 border-t border-[#1a1a1a]">
                        <span className="text-gray-400">Method</span>
                        <span className="text-white">{successDetails.methodName}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-t border-[#1a1a1a]">
                        <span className="text-gray-400">Fee</span>
                        <span className="text-white">{successDetails.fee}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-t border-[#1a1a1a]">
                        <span className="text-gray-400">Estimated Time</span>
                        <span className="text-white">{successDetails.estimatedTime}</span>
                      </div>
                    </>
                  )}
                </div>
                
                {successMessage !== 'cancelled' && (
                  <p className="text-center text-gray-500 text-sm mt-4">
                    You'll receive an email confirmation once your withdrawal is processed.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left rail: balance */}
            <aside className="lg:col-span-3 order-1 space-y-4">
              <div className="bg-[#111111] rounded-2xl p-6 border border-[#1a1a1a]/50 lg:sticky lg:top-4">
                <div className="text-gray-500 text-sm mb-1">Available to Withdraw</div>
                <div className="text-3xl font-bold text-green-400">
                  ${availableToWithdraw.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">Your full cash balance is withdrawable.</div>

                {step === 'detail' && selectedMethod && availableToWithdraw > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#1a1a1a] space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Method</span>
                      <span className="text-white font-medium text-right">
                        {withdrawalMethods.find(m => m.id === selectedMethod)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fee</span>
                      <span className="text-white">{withdrawalMethods.find(m => m.id === selectedMethod)?.fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Estimated</span>
                      <span className="text-white text-right">{withdrawalMethods.find(m => m.id === selectedMethod)?.time}</span>
                    </div>
                    {amount && parseFloat(amount) > 0 && (
                      <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                        <span className="text-gray-500">Amount</span>
                        <span className="text-green-400 font-semibold">${parseFloat(amount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* Center: picker or detail */}
            <main className="lg:col-span-6 order-2">
            {availableToWithdraw <= 0 ? (
              <div className="bg-[#111111] rounded-2xl p-8 border border-[#1a1a1a]/50 text-center">
                <div className="w-16 h-16 bg-[#111] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Funds Available</h3>
                <p className="text-gray-400 mb-6">
                  Your cash balance is currently $0. Win some battles to build it up — your full balance is withdrawable at any time.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-all"
                >
                  Go to Battle
                </button>
              </div>
            ) : step === 'picker' ? (
              <div key="picker" className="withdrawal-step-anim">
                <h2 className="text-lg font-bold text-white mb-4">Select Withdrawal Method</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {withdrawalMethods.map((method) => {
                    const savedCount = savedMethods.filter(m => m.methodType === method.id).length;
                    return (
                      <button
                        key={method.id}
                        onClick={() => {
                          setSelectedMethod(method.id);
                          setSelectedSavedMethod(null);
                          setShowNewMethodForm(false);
                          setStep('detail');
                          if (typeof window !== 'undefined') {
                            const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                            window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
                          }
                        }}
                        className="group p-4 rounded-xl border bg-[#111111] border-[#1a1a1a]/50 hover:border-green-500/40 hover:bg-green-500/5 transition-all text-left"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-gray-400 group-hover:text-green-400 transition-colors">
                            {method.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-white font-semibold truncate">{method.name}</h3>
                              {savedCount > 0 && (
                                <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded shrink-0">
                                  {savedCount} saved
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs mt-1 line-clamp-2">{method.description}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                              <span className="text-gray-400">Fee: <span className="text-white">{method.fee}</span></span>
                              <span className="text-gray-400">Min: <span className="text-white">${method.minAmount}</span></span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1">{method.time}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div key="detail" className="withdrawal-step-anim">
                {/* Detail header with back */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setStep('picker')}
                    className="p-2 -ml-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#111] transition-colors flex items-center gap-1"
                    aria-label="Back to methods"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm font-medium">Back</span>
                  </button>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="hover:text-white cursor-pointer" onClick={() => setStep('picker')}>Methods</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-white truncate">{withdrawalMethods.find(m => m.id === selectedMethod)?.name}</span>
                  </div>
                </div>

                {/* Method summary header */}
                <div className="bg-[#111111] rounded-2xl p-4 border border-[#1a1a1a]/50 mb-4 flex items-center gap-3">
                  <div className="text-green-400 shrink-0">
                    {withdrawalMethods.find(m => m.id === selectedMethod)?.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-semibold truncate">
                      {withdrawalMethods.find(m => m.id === selectedMethod)?.name}
                    </h3>
                    <p className="text-gray-500 text-xs truncate">
                      {withdrawalMethods.find(m => m.id === selectedMethod)?.description}
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-[#111111] rounded-2xl p-5 border border-[#1a1a1a]/50 mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Withdrawal Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      max={availableToWithdraw}
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-4 text-white text-xl font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-500">Min: ${withdrawalMethods.find(m => m.id === selectedMethod)?.minAmount}</span>
                    <button
                      onClick={() => setAmount(availableToWithdraw.toString())}
                      className="text-green-400 hover:text-green-300"
                    >
                      Max: ${availableToWithdraw.toLocaleString()}
                    </button>
                  </div>
                </div>

                {/* Payment details / saved methods / new form */}
                {renderPaymentForm()}

                {/* Submit (inline on desktop, spacer + sticky on mobile) */}
                <div className="hidden lg:block">
                  <button
                    onClick={handleWithdraw}
                    disabled={!isFormValid() || submitting}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                      isFormValid() && !submitting
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        : 'bg-[#111] text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Request Withdrawal'
                    )}
                  </button>
                  <p className="text-center text-gray-500 text-sm mt-3">
                    Withdrawals are processed within 24-48 hours. You'll receive an email confirmation.
                  </p>
                </div>
                {/* Mobile: spacer keeps content above sticky bar */}
                <div className="lg:hidden h-24" aria-hidden="true" />
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/95 to-black/80 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] border-t border-[#1a1a1a]">
                  <button
                    onClick={handleWithdraw}
                    disabled={!isFormValid() || submitting}
                    className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
                      isFormValid() && !submitting
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        : 'bg-[#111] text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      amount && parseFloat(amount) > 0
                        ? `Request $${parseFloat(amount).toLocaleString()} Withdrawal`
                        : 'Request Withdrawal'
                    )}
                  </button>
                </div>
              </div>
            )}
            </main>

            {/* Right rail: recent activity */}
            <aside className={`lg:col-span-3 order-3 ${showHistory ? 'block' : 'hidden lg:block'}`}>
              {withdrawals.length === 0 && !depositBonus ? (
                <div className="bg-[#111111] rounded-2xl p-5 border border-[#1a1a1a]/50">
                  <h2 className="text-sm font-semibold text-white mb-2">Recent Activity</h2>
                  <p className="text-gray-500 text-xs">Your withdrawal history will appear here.</p>
                </div>
              ) : (
                <div className="bg-[#111111] rounded-2xl p-5 border border-[#1a1a1a]/50">
                  <h2 className="text-sm font-semibold text-white mb-3">Recent Activity</h2>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {depositBonus && (
                      <div
                        className="bg-[#0a0a0a] rounded-lg border border-emerald-500/30 p-3"
                        title="First deposit match bonus"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-emerald-400 font-semibold text-sm">
                              +${depositBonus.amount.toLocaleString('en-US', {
                                minimumFractionDigits: depositBonus.amount % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] text-emerald-400 bg-emerald-400/10">
                              Bonus
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 truncate">First Deposit Match</span>
                          <span className="text-gray-500 shrink-0 ml-2">
                            {depositBonus.grantedAt
                              ? new Date(depositBonus.grantedAt).toLocaleDateString()
                              : ''}
                          </span>
                        </div>
                      </div>
                    )}
                    {withdrawals.map((w) => {
                      const methodInfo = withdrawalMethods.find(m => m.id === w.methodType);
                      const isExpanded = expandedWithdrawal === w.id;
                      const netAmount = parseFloat(w.amount) - (parseFloat(w.fee) || 0);

                      return (
                        <div
                          key={w.id}
                          className={`bg-[#0a0a0a] rounded-lg border transition-all duration-200 ${
                            isExpanded ? 'border-green-500/30' : 'border-[#1a1a1a]'
                          }`}
                        >
                          <div
                            className="p-3 cursor-pointer"
                            onClick={() => setExpandedWithdrawal(isExpanded ? null : w.id)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-white font-semibold text-sm">${parseFloat(w.amount).toLocaleString()}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusColors[w.status] || 'text-gray-400 bg-gray-400/10'}`}>
                                  {statusLabels[w.status] || w.status}
                                </span>
                              </div>
                              <svg
                                className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-400 truncate">{methodInfo?.name || w.methodType}</span>
                              <span className="text-gray-500 shrink-0 ml-2">
                                {new Date(w.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-[#1a1a1a] pt-3 space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-gray-500">Fee</span>
                                  <div className="text-white font-medium">
                                    {w.fee && parseFloat(w.fee) > 0 ? `$${formatMoney(w.fee)}` : 'Free'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Net</span>
                                  <div className="text-green-400 font-medium">${netAmount.toLocaleString()}</div>
                                </div>
                              </div>
                              {methodInfo && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Est.</span>
                                  <span className="text-white">{methodInfo.time}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-gray-500">Requested</span>
                                <span className="text-white">
                                  {new Date(w.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {w.status === 'denied' && w.denialReason && (
                                <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                                  <span className="text-red-400">Denial: {w.denialReason}</span>
                                </div>
                              )}
                              {w.status === 'finalized' && w.updatedAt && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Completed</span>
                                  <span className="text-green-400">
                                    {new Date(w.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {w.status === 'under_review' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCancelWithdrawal(w.id); }}
                                  disabled={cancelling === w.id}
                                  className="w-full mt-1 text-red-400 hover:text-red-300 text-[11px] py-1.5 rounded border border-red-400/30 hover:border-red-400/50 transition-all disabled:opacity-50"
                                >
                                  {cancelling === w.id ? 'Cancelling...' : 'Cancel'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>
          </div>

        </div>
      </div>
    </>
  );
}
