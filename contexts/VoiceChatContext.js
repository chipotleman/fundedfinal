import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const VoiceChatContext = createContext({
  oppSpeaking: false,
  setOppSpeaking: () => {},
});

export function VoiceChatProvider({ children }) {
  const [oppSpeaking, setOppSpeakingState] = useState(false);

  const setOppSpeaking = useCallback((v) => {
    setOppSpeakingState(prev => (prev === v ? prev : v));
  }, []);

  const value = useMemo(() => ({ oppSpeaking, setOppSpeaking }), [oppSpeaking, setOppSpeaking]);

  return (
    <VoiceChatContext.Provider value={value}>
      {children}
    </VoiceChatContext.Provider>
  );
}

export function useVoiceChat() {
  return useContext(VoiceChatContext);
}
