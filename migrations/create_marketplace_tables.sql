
-- Create cappers table
CREATE TABLE IF NOT EXISTS cappers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  bio TEXT,
  avatar_url TEXT,
  type VARCHAR(50) DEFAULT 'human', -- 'human' or 'ai'
  verified BOOLEAN DEFAULT false,
  monthly_price DECIMAL(10,2) NOT NULL,
  categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create capper_stats table
CREATE TABLE IF NOT EXISTS capper_stats (
  id SERIAL PRIMARY KEY,
  capper_id INTEGER REFERENCES cappers(id),
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_picks INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  roi DECIMAL(5,2) DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create capper_subscriptions table
CREATE TABLE IF NOT EXISTS capper_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  capper_id INTEGER REFERENCES cappers(id),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'expired'
  monthly_price DECIMAL(10,2) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  referrer_user_id UUID REFERENCES auth.users(id), -- for referral tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create capper_picks table
CREATE TABLE IF NOT EXISTS capper_picks (
  id SERIAL PRIMARY KEY,
  capper_id INTEGER REFERENCES cappers(id),
  game_description TEXT NOT NULL,
  pick_description TEXT NOT NULL,
  odds VARCHAR(20),
  confidence VARCHAR(20), -- 'High', 'Medium', 'Low'
  reasoning TEXT,
  sport VARCHAR(50),
  result VARCHAR(20) DEFAULT 'pending', -- 'pending', 'won', 'lost', 'push'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE
);

-- Create capper_referrals table
CREATE TABLE IF NOT EXISTS capper_referrals (
  id SERIAL PRIMARY KEY,
  referrer_user_id UUID REFERENCES auth.users(id),
  capper_id INTEGER REFERENCES cappers(id),
  total_earnings DECIMAL(10,2) DEFAULT 0,
  referral_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  referral_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create capper_payments table for tracking earnings
CREATE TABLE IF NOT EXISTS capper_payments (
  id SERIAL PRIMARY KEY,
  capper_id INTEGER REFERENCES cappers(id),
  subscription_id INTEGER REFERENCES capper_subscriptions(id),
  amount DECIMAL(10,2) NOT NULL,
  referral_amount DECIMAL(10,2) DEFAULT 0, -- 10% referral fee
  referrer_user_id UUID REFERENCES auth.users(id),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'completed'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cappers_type ON cappers(type);
CREATE INDEX IF NOT EXISTS idx_cappers_verified ON cappers(verified);
CREATE INDEX IF NOT EXISTS idx_capper_subscriptions_user_id ON capper_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_capper_subscriptions_capper_id ON capper_subscriptions(capper_id);
CREATE INDEX IF NOT EXISTS idx_capper_subscriptions_status ON capper_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_capper_picks_capper_id ON capper_picks(capper_id);
CREATE INDEX IF NOT EXISTS idx_capper_picks_result ON capper_picks(result);

-- Enable Row Level Security
ALTER TABLE cappers ENABLE ROW LEVEL SECURITY;
ALTER TABLE capper_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE capper_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capper_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE capper_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE capper_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for cappers table
CREATE POLICY "Cappers are viewable by everyone" ON cappers FOR SELECT USING (true);
CREATE POLICY "Users can insert their own capper profile" ON cappers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own capper profile" ON cappers FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for capper_stats table
CREATE POLICY "Capper stats are viewable by everyone" ON capper_stats FOR SELECT USING (true);

-- Create policies for capper_subscriptions table
CREATE POLICY "Users can view their own subscriptions" ON capper_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscriptions" ON capper_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscriptions" ON capper_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for capper_picks table
CREATE POLICY "Capper picks viewable by subscribers or capper" ON capper_picks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM capper_subscriptions cs 
    WHERE cs.capper_id = capper_picks.capper_id 
    AND cs.user_id = auth.uid() 
    AND cs.status = 'active'
    AND cs.end_date > NOW()
  ) OR 
  EXISTS (
    SELECT 1 FROM cappers c 
    WHERE c.id = capper_picks.capper_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Cappers can insert their own picks" ON capper_picks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM cappers c 
    WHERE c.id = capper_picks.capper_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Cappers can update their own picks" ON capper_picks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM cappers c 
    WHERE c.id = capper_picks.capper_id 
    AND c.user_id = auth.uid()
  )
);

-- Create policies for capper_referrals table
CREATE POLICY "Users can view their own referrals" ON capper_referrals FOR SELECT USING (auth.uid() = referrer_user_id);

-- Create policies for capper_payments table
CREATE POLICY "Cappers can view their own payments" ON capper_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM cappers c 
    WHERE c.id = capper_payments.capper_id 
    AND c.user_id = auth.uid()
  )
);
