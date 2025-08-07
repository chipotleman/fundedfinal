
import React, { useState } from 'react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function InstagramStrategy() {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    // Cover Slide
    {
      id: 'cover',
      title: 'Cover',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="mb-8">
            <img src="/fundmybet-logo.png" alt="Funder Logo" className="h-24 mx-auto mb-6" />
          </div>
          <h1 className="text-6xl font-black text-white mb-6">
            Instagram Growth <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Strategy</span>
          </h1>
          <p className="text-xl text-gray-400">Confidential Investor Presentation</p>
          <div className="mt-12 text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )
    },
    
    // Phase 1
    {
      id: 'phase1',
      title: 'Phase 1: Foundation & Teasing',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 h-full overflow-y-auto">
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8">Phase 1: Foundation & Teasing</h2>
            <div className="space-y-4 md:space-y-6">
              <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-base md:text-lg mb-2">🎯 Goal</h3>
                <p className="text-gray-300 text-sm md:text-base">Build anticipation and establish credibility before launch</p>
              </div>
              <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-base md:text-lg mb-2">📆 Timeline</h3>
                <p className="text-gray-300 text-sm md:text-base">Week 1-2</p>
              </div>
              <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-base md:text-lg mb-2">✅ Key Actions</h3>
                <ul className="text-gray-300 space-y-1 md:space-y-2 text-sm md:text-base">
                  <li>• Post 1-2 times daily</li>
                  <li>• Story 3-5 times daily</li>
                  <li>• Behind-the-scenes content</li>
                  <li>• "Something big is coming" teasers</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-4 md:p-8 border border-gray-800 w-full max-w-md">
              <div className="text-center">
                <div className="text-4xl md:text-6xl mb-4">📱</div>
                <h4 className="text-white font-bold mb-4 text-base md:text-lg">Content Strategy</h4>
                <div className="space-y-3 text-left">
                  <div className="flex justify-between text-sm md:text-base">
                    <span className="text-gray-400">Teaser Posts</span>
                    <span className="text-green-400">Daily</span>
                  </div>
                  <div className="flex justify-between text-sm md:text-base">
                    <span className="text-gray-400">Educational</span>
                    <span className="text-blue-400">3x/week</span>
                  </div>
                  <div className="flex justify-between text-sm md:text-base">
                    <span className="text-gray-400">Social Proof</span>
                    <span className="text-purple-400">2x/week</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Phase 2
    {
      id: 'phase2',
      title: 'Phase 2: Awareness Building',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 h-full overflow-y-auto">
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8">Phase 2: Awareness Building</h2>
            <div className="space-y-4 md:space-y-6">
              <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-base md:text-lg mb-2">🎯 Goal</h3>
                <p className="text-gray-300 text-sm md:text-base">Identify pain points and position our solution</p>
              </div>
              <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-base md:text-lg mb-2">📆 Timeline</h3>
                <p className="text-gray-300 text-sm md:text-base">Week 3-4</p>
              </div>
              <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-base md:text-lg mb-2">✅ Key Actions</h3>
                <ul className="text-gray-300 space-y-1 md:space-y-2 text-sm md:text-base">
                  <li>• Problem-focused content</li>
                  <li>• Solution teasing</li>
                  <li>• Educational series launch</li>
                  <li>• Community engagement</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-4 md:p-8 border border-gray-800 w-full max-w-md">
              <div className="text-center">
                <div className="text-4xl md:text-6xl mb-4">🎯</div>
                <h4 className="text-white font-bold mb-4 text-base md:text-lg">Problem/Solution Focus</h4>
                <div className="space-y-4">
                  <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                    <span className="text-red-400 font-semibold text-sm md:text-base">Problem:</span>
                    <p className="text-gray-300 text-xs md:text-sm mt-1">"Lost your bankroll again?"</p>
                  </div>
                  <div className="bg-green-900/20 p-3 rounded-lg border border-green-500/30">
                    <span className="text-green-400 font-semibold text-sm md:text-base">Solution:</span>
                    <p className="text-gray-300 text-xs md:text-sm mt-1">"What if there was a better way?"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Phase 3
    {
      id: 'phase3',
      title: 'Phase 3: Product Reveal',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 h-full overflow-y-auto">
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8">Phase 3: Product Reveal</h2>
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-lg mb-2">🎯 Goal</h3>
                <p className="text-gray-300">Launch product with maximum impact and conversions</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-lg mb-2">📆 Timeline</h3>
                <p className="text-gray-300">Week 5-6</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-lg mb-2">✅ Key Actions</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>• Big reveal announcement</li>
                  <li>• Demo video series</li>
                  <li>• Package breakdown posts</li>
                  <li>• Live demonstrations</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 w-full max-w-md">
              <div className="text-center">
                <div className="text-6xl mb-4">🚀</div>
                <h4 className="text-white font-bold mb-4">Launch Strategy</h4>
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 p-3 rounded-lg border border-green-500/30">
                    <p className="text-white font-semibold">🚨 GAME CHANGER ALERT 🚨</p>
                    <p className="text-gray-300 text-sm mt-1">Get funded up to $25,000</p>
                  </div>
                  <div className="text-left space-y-2">
                    <div className="flex items-center text-green-400">
                      <span className="mr-2">✅</span>
                      <span className="text-sm">Keep 80% of profits</span>
                    </div>
                    <div className="flex items-center text-green-400">
                      <span className="mr-2">✅</span>
                      <span className="text-sm">Zero personal risk</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Phase 4
    {
      id: 'phase4',
      title: 'Phase 4: Social Proof & FOMO',
      content: (
        <div className="grid grid-cols-2 gap-12 h-full">
          <div>
            <h2 className="text-4xl font-bold text-white mb-8">Phase 4: Social Proof & FOMO</h2>
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-lg mb-2">🎯 Goal</h3>
                <p className="text-gray-300">Build trust through user success stories and create urgency</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-lg mb-2">📆 Timeline</h3>
                <p className="text-gray-300">Week 7-8</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-lg mb-2">✅ Key Actions</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>• User success stories</li>
                  <li>• Limited spots messaging</li>
                  <li>• Community building</li>
                  <li>• Weekly leaderboards</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 w-full max-w-md">
              <div className="text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h4 className="text-white font-bold mb-4">Social Proof Strategy</h4>
                <div className="space-y-4">
                  <div className="bg-green-900/20 p-3 rounded-lg border border-green-500/30">
                    <p className="text-green-400 font-semibold">Success Story</p>
                    <p className="text-gray-300 text-sm mt-1">"Made $2,400 in my first week"</p>
                  </div>
                  <div className="bg-orange-900/20 p-3 rounded-lg border border-orange-500/30">
                    <p className="text-orange-400 font-semibold">FOMO</p>
                    <p className="text-gray-300 text-sm mt-1">"Only 47 spots left in beta"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Phase 5
    {
      id: 'phase5',
      title: 'Phase 5: Scale & Optimize',
      content: (
        <div className="grid grid-cols-2 gap-12 h-full">
          <div>
            <h2 className="text-4xl font-bold text-white mb-8">Phase 5: Scale & Optimize</h2>
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-lg mb-2">🎯 Goal</h3>
                <p className="text-gray-300">Systematize content and scale through partnerships</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-lg mb-2">📆 Timeline</h3>
                <p className="text-gray-300">Week 9+</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-lg mb-2">✅ Key Actions</h3>
                <ul className="text-gray-300 space-y-2">
                  <li>• Content automation</li>
                  <li>• Influencer partnerships</li>
                  <li>• Paid promotion scale</li>
                  <li>• Advanced strategies</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 w-full max-w-md">
              <div className="text-center">
                <div className="text-6xl mb-4">📈</div>
                <h4 className="text-white font-bold mb-4">Daily Content Calendar</h4>
                <div className="space-y-2 text-left text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monday</span>
                    <span className="text-green-400">Success Stories</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tuesday</span>
                    <span className="text-blue-400">Tutorials</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wednesday</span>
                    <span className="text-purple-400">Big Wins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weekend</span>
                    <span className="text-orange-400">Betting Focus</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Metrics Dashboard
    {
      id: 'metrics',
      title: 'Metrics Dashboard',
      content: (
        <div className="h-full">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8 text-center">Metrics Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 h-auto md:h-4/5 overflow-y-auto">
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-lg mb-4">📈 Growth Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Follower Growth</span>
                    <span className="text-green-400 font-bold">+15% weekly</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Reach Increase</span>
                    <span className="text-blue-400 font-bold">+25% weekly</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Story Views</span>
                    <span className="text-purple-400 font-bold">+40% weekly</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-lg mb-4">💸 Cost Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">CAC (Cost per Follower)</span>
                    <span className="text-green-400 font-bold">$0.45</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">CPM (Cost per 1k)</span>
                    <span className="text-blue-400 font-bold">$3.20</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-lg mb-4">🔁 Engagement Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Avg Engagement Rate</span>
                    <span className="text-green-400 font-bold">8.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Reels Watch Rate</span>
                    <span className="text-blue-400 font-bold">65%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Save Rate</span>
                    <span className="text-purple-400 font-bold">12%</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-orange-400 font-bold text-lg mb-4">📊 Conversion Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">LTV (User Value)</span>
                    <span className="text-green-400 font-bold">$247</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">App Conversion</span>
                    <span className="text-blue-400 font-bold">4.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Traction
    {
      id: 'traction',
      title: 'Traction',
      content: (
        <div className="h-full">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8 text-center">Current Traction</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 h-auto md:h-4/5 overflow-y-auto">
            <div className="space-y-8">
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 p-8 rounded-xl border border-green-500/30">
                <div className="text-center">
                  <div className="text-4xl font-black text-green-400 mb-2">2,847</div>
                  <h3 className="text-white font-bold">👥 Waitlist Signups</h3>
                  <p className="text-gray-400 text-sm">Pre-launch interest</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-8 rounded-xl border border-purple-500/30">
                <div className="text-center">
                  <div className="text-4xl font-black text-purple-400 mb-2">15</div>
                  <h3 className="text-white font-bold">🎥 Influencer Partnerships</h3>
                  <p className="text-gray-400 text-sm">Secured collaborations</p>
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-8 rounded-xl border border-blue-500/30">
                <div className="text-center">
                  <div className="text-4xl font-black text-blue-400 mb-2">45K</div>
                  <h3 className="text-white font-bold">📦 Monthly Organic Traffic</h3>
                  <p className="text-gray-400 text-sm">From content clippers</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 p-8 rounded-xl border border-orange-500/30">
                <div className="text-center">
                  <div className="text-4xl font-black text-orange-400 mb-2">12.8%</div>
                  <h3 className="text-white font-bold">📊 Avg Engagement Rate</h3>
                  <p className="text-gray-400 text-sm">Above industry standard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Go-To-Market
    {
      id: 'gtm',
      title: 'Go-To-Market Strategy',
      content: (
        <div className="h-full">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8 text-center">Go-To-Market Strategy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 h-auto md:h-4/5 overflow-y-auto">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-green-400 mb-4">🎯 Scaling Channels</h3>
              <div className="space-y-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-gray-700">
                  <h4 className="text-blue-400 font-bold mb-2">🎯 Influencer Deals</h4>
                  <p className="text-gray-300 text-sm">Partner with sports betting influencers for authentic content</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-gray-700">
                  <h4 className="text-purple-400 font-bold mb-2">✂️ Content Clippers</h4>
                  <p className="text-gray-300 text-sm">Short-form viral content to drive organic reach</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-gray-700">
                  <h4 className="text-green-400 font-bold mb-2">🔁 Paid Amplification</h4>
                  <p className="text-gray-300 text-sm">Boost high-performing organic content</p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-blue-400 mb-4">👥 Target Demographics</h3>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-bold mb-2">Primary: Ages 18-34</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Sports betting curious</li>
                      <li>• Risk-averse but profit-motivated</li>
                      <li>• Active on social media</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-2">Secondary: Ages 35-50</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Experienced bettors</li>
                      <li>• Looking for better ROI</li>
                      <li>• Higher disposable income</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // Business Model
    {
      id: 'business-model',
      title: 'Business Model Summary',
      content: (
        <div className="h-full">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-8 text-center">Business Model Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 h-auto md:h-4/5 overflow-y-auto">
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-green-400 font-bold text-lg mb-4">🧩 Revenue Streams</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Challenge Fees</span>
                    <span className="text-green-400 font-bold">65%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Profit Share (20%)</span>
                    <span className="text-blue-400 font-bold">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Affiliate/Partnerships</span>
                    <span className="text-purple-400 font-bold">10%</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-blue-400 font-bold text-lg mb-4">🧮 Financial Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Gross Margin</span>
                    <span className="text-green-400 font-bold">78%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Recurring Revenue</span>
                    <span className="text-blue-400 font-bold">45%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-purple-400 font-bold text-lg mb-4">📉 Cost Structure</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">User Payouts</span>
                    <span className="text-red-400 font-bold">35%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Marketing/Ads</span>
                    <span className="text-orange-400 font-bold">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Development</span>
                    <span className="text-blue-400 font-bold">15%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Operations</span>
                    <span className="text-purple-400 font-bold">25%</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 p-6 rounded-xl border border-green-500/30">
                <h3 className="text-white font-bold text-lg mb-2">💰 Revenue Projection</h3>
                <div className="text-center">
                  <div className="text-3xl font-black text-green-400">$2.4M</div>
                  <p className="text-gray-400">Year 1 Target</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNavbar 
        bankroll={null}
        pnl={null}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Presentation Container */}
      <div className="pt-20 pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Slide Container */}
          <div className="relative bg-black border-2 border-gray-800 rounded-2xl overflow-hidden" style={{ aspectRatio: window.innerWidth < 768 ? '4/5' : '16/9', minHeight: window.innerWidth < 768 ? '500px' : '600px' }}>
            {/* Current Slide */}
            <div className="absolute inset-0 p-4 sm:p-8">
              {slides[currentSlide].content}
            </div>

            {/* Navigation Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black/80 backdrop-blur-lg rounded-full px-6 py-3 border border-gray-700"></div>
              <button
                onClick={prevSlide}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={currentSlide === 0}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              <span className="text-gray-400 text-sm">
                {currentSlide + 1} / {slides.length}
              </span>

              <button
                onClick={nextSlide}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={currentSlide === slides.length - 1}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Slide Navigation Dots */}
          <div className="flex justify-center mt-6 space-x-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'bg-gradient-to-r from-green-400 to-blue-500' 
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          {/* Slide Titles for Quick Navigation */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                  index === currentSlide
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-gray-700 bg-slate-800 text-gray-400 hover:border-gray-600 hover:text-white'
                }`}
              >
                <div className="text-sm font-bold mb-1">
                  {index + 1}. {slide.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
