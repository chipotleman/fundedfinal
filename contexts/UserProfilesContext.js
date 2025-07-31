
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
      { name: "Elite Trader", description: "Reached Elite tier", icon: "🏆" },
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
