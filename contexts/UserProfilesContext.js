
import { createContext, useContext, useState } from 'react';

const UserProfilesContext = createContext();

export const useUserProfiles = () => {
  const context = useContext(UserProfilesContext);
  if (!context) {
    throw new Error('useUserProfiles must be used within a UserProfilesProvider');
  }
  return context;
};

// Mock user profiles data that will be consistent across the site
const mockUserProfiles = {
  "BetMaster2024": {
    username: "BetMaster2024",
    email: "betmaster@fundmybet.com",
    joinDate: "2023-12-15",
    tier: "Elite",
    avatar: null,
    stats: {
      totalBets: 127,
      winRate: 70.1,
      totalProfit: 15420,
      currentStreak: 8,
      longestStreak: 15,
      avgOdds: -108,
      challengesCompleted: 3,
      currentChallenge: 4,
      roi: 154.2
    },
    achievements: [
      { name: "Elite Bettor", description: "Reached Elite tier", icon: "🏆" },
      { name: "Win Streak Master", description: "15+ win streak", icon: "🔥" },
      { name: "Challenge King", description: "Completed 3 challenges", icon: "👑" }
    ],
    recentBets: [
      { game: "Lakers vs Warriors", bet: "Lakers -5.5", odds: "-110", result: "won", amount: 500 },
      { game: "Chiefs vs Bills", bet: "Over 47.5", odds: "-105", result: "won", amount: 750 },
      { game: "Celtics vs Heat", bet: "Celtics ML", odds: "+120", result: "won", amount: 300 }
    ]
  },
  "SharpShooter": {
    username: "SharpShooter",
    email: "sharp@fundmybet.com",
    joinDate: "2024-01-03",
    tier: "Pro",
    avatar: null,
    stats: {
      totalBets: 115,
      winRate: 66.1,
      totalProfit: 12890,
      currentStreak: 5,
      longestStreak: 12,
      avgOdds: -112,
      challengesCompleted: 2,
      currentChallenge: 3,
      roi: 128.9
    },
    achievements: [
      { name: "Sharp Bettor", description: "High win rate", icon: "🎯" },
      { name: "Consistent Winner", description: "Steady profits", icon: "📈" }
    ],
    recentBets: [
      { game: "Cowboys vs Eagles", bet: "Under 45.5", odds: "-115", result: "won", amount: 400 },
      { game: "Knicks vs Nets", bet: "Knicks +3.5", odds: "-108", result: "lost", amount: 250 }
    ]
  },
  "SportsSage": {
    username: "SportsSage",
    email: "sage@fundmybet.com",
    joinDate: "2023-11-20",
    tier: "Elite",
    avatar: null,
    stats: {
      totalBets: 134,
      winRate: 61.2,
      totalProfit: 11250,
      currentStreak: 3,
      longestStreak: 10,
      avgOdds: -115,
      challengesCompleted: 2,
      currentChallenge: 3,
      roi: 112.5
    },
    achievements: [
      { name: "Volume Bettor", description: "High bet count", icon: "🔢" },
      { name: "Elite Bettor", description: "Reached Elite tier", icon: "🏆" }
    ],
    recentBets: [
      { game: "Dodgers vs Padres", bet: "Dodgers ML", odds: "-140", result: "won", amount: 600 },
      { game: "Rangers vs Bruins", bet: "Over 6.5", odds: "-110", result: "won", amount: 350 }
    ]
  },
  "OddsWhisperer": {
    username: "OddsWhisperer",
    email: "odds@fundmybet.com",
    joinDate: "2024-01-15",
    tier: "Pro",
    avatar: null,
    stats: {
      totalBets: 98,
      winRate: 69.4,
      totalProfit: 9875,
      currentStreak: 6,
      longestStreak: 9,
      avgOdds: -110,
      challengesCompleted: 1,
      currentChallenge: 2,
      roi: 98.8
    },
    achievements: [
      { name: "Sharp Bettor", description: "High win rate", icon: "🎯" },
      { name: "Profit Maker", description: "Consistent profits", icon: "💰" }
    ],
    recentBets: [
      { game: "Bucks vs 76ers", bet: "Bucks -3.5", odds: "-108", result: "won", amount: 450 },
      { game: "Patriots vs Dolphins", bet: "Under 42.5", odds: "-112", result: "won", amount: 300 }
    ]
  },
  "LineHunter": {
    username: "LineHunter",
    email: "line@fundmybet.com",
    joinDate: "2023-12-01",
    tier: "Starter",
    avatar: null,
    stats: {
      totalBets: 109,
      winRate: 65.1,
      totalProfit: 8640,
      currentStreak: 4,
      longestStreak: 8,
      avgOdds: -108,
      challengesCompleted: 1,
      currentChallenge: 2,
      roi: 86.4
    },
    achievements: [
      { name: "Value Hunter", description: "Finding the best lines", icon: "🔍" },
      { name: "Rising Star", description: "Strong start", icon: "⭐" }
    ],
    recentBets: [
      { game: "Yankees vs Red Sox", bet: "Yankees ML", odds: "+105", result: "won", amount: 350 },
      { game: "Warriors vs Suns", bet: "Over 225.5", odds: "-110", result: "lost", amount: 200 }
    ]
  },
  "ValueFinder": {
    username: "ValueFinder",
    email: "value@fundmybet.com",
    joinDate: "2024-02-10",
    tier: "Pro",
    avatar: null,
    stats: {
      totalBets: 94,
      winRate: 67.0,
      totalProfit: 7920,
      currentStreak: 5,
      longestStreak: 11,
      avgOdds: -107,
      challengesCompleted: 1,
      currentChallenge: 2,
      roi: 79.2
    },
    achievements: [
      { name: "Value Bettor", description: "Finding +EV bets", icon: "💎" },
      { name: "Consistent Winner", description: "Steady profits", icon: "📈" }
    ],
    recentBets: [
      { game: "Clippers vs Mavericks", bet: "Clippers +2.5", odds: "-105", result: "won", amount: 400 },
      { game: "Packers vs Bears", bet: "Packers -6.5", odds: "-112", result: "won", amount: 500 }
    ]
  },
  "BankrollBeast": {
    username: "BankrollBeast",
    email: "bankroll@fundmybet.com",
    joinDate: "2024-01-20",
    tier: "Starter",
    avatar: null,
    stats: {
      totalBets: 87,
      winRate: 66.7,
      totalProfit: 7435,
      currentStreak: 3,
      longestStreak: 7,
      avgOdds: -110,
      challengesCompleted: 1,
      currentChallenge: 2,
      roi: 74.4
    },
    achievements: [
      { name: "Smart Bankroll", description: "Great money management", icon: "🏦" },
      { name: "Starter Success", description: "Strong foundation", icon: "✅" }
    ],
    recentBets: [
      { game: "Astros vs Angels", bet: "Under 8.5", odds: "-115", result: "won", amount: 300 },
      { game: "Nets vs Wizards", bet: "Nets ML", odds: "-145", result: "won", amount: 450 }
    ]
  },
  "EdgeSeeker": {
    username: "EdgeSeeker",
    email: "edge@fundmybet.com",
    joinDate: "2023-11-05",
    tier: "Pro",
    avatar: null,
    stats: {
      totalBets: 92,
      winRate: 59.8,
      totalProfit: 6890,
      currentStreak: 2,
      longestStreak: 9,
      avgOdds: -112,
      challengesCompleted: 1,
      currentChallenge: 2,
      roi: 68.9
    },
    achievements: [
      { name: "Edge Finder", description: "Finding profitable spots", icon: "🔪" },
      { name: "Pro Bettor", description: "Reached Pro tier", icon: "🎖️" }
    ],
    recentBets: [
      { game: "Rams vs Seahawks", bet: "Over 48.5", odds: "-108", result: "won", amount: 350 },
      { game: "Thunder vs Nuggets", bet: "Thunder +5.5", odds: "-110", result: "lost", amount: 250 }
    ]
  },
  "ProfitPro": {
    username: "ProfitPro",
    email: "profit@fundmybet.com",
    joinDate: "2024-02-01",
    tier: "Starter",
    avatar: null,
    stats: {
      totalBets: 81,
      winRate: 60.5,
      totalProfit: 6210,
      currentStreak: 4,
      longestStreak: 6,
      avgOdds: -110,
      challengesCompleted: 0,
      currentChallenge: 1,
      roi: 62.1
    },
    achievements: [
      { name: "New Bettor", description: "Just getting started", icon: "🌱" },
      { name: "Quick Learner", description: "Fast improvement", icon: "📚" }
    ],
    recentBets: [
      { game: "Vikings vs Lions", bet: "Vikings ML", odds: "+120", result: "won", amount: 200 },
      { game: "Jazz vs Pelicans", bet: "Under 230.5", odds: "-112", result: "won", amount: 300 }
    ]
  },
  "WinStreaker": {
    username: "WinStreaker",
    email: "streak@fundmybet.com",
    joinDate: "2024-01-10",
    tier: "Starter",
    avatar: null,
    stats: {
      totalBets: 76,
      winRate: 61.8,
      totalProfit: 5875,
      currentStreak: 7,
      longestStreak: 7,
      avgOdds: -108,
      challengesCompleted: 0,
      currentChallenge: 1,
      roi: 58.8
    },
    achievements: [
      { name: "Hot Streak", description: "On fire!", icon: "🔥" },
      { name: "Beginner's Luck", description: "Strong start", icon: "🍀" }
    ],
    recentBets: [
      { game: "Brewers vs Cubs", bet: "Brewers -1.5", odds: "+115", result: "won", amount: 250 },
      { game: "Rockets vs Spurs", bet: "Over 215.5", odds: "-110", result: "won", amount: 350 }
    ]
  }
};

export const UserProfilesProvider = ({ children }) => {
  const [userProfiles] = useState(mockUserProfiles);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const getUserProfile = (username) => {
    return userProfiles[username] || null;
  };

  const openProfile = (username) => {
    const profile = getUserProfile(username);
    if (profile) {
      setSelectedProfile(profile);
      setShowProfileModal(true);
    }
  };

  return (
    <UserProfilesContext.Provider value={{
      userProfiles,
      selectedProfile,
      showProfileModal,
      setShowProfileModal,
      getUserProfile,
      openProfile
    }}>
      {children}
    </UserProfilesContext.Provider>
  );
};
