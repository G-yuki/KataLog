// src/contexts/PairContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../features/auth/hooks/useAuth";
import { getUserPairId, getPair } from "../features/pair/services/pairService";

type PairContextValue = {
  pairId: string | null;
  isSolo: boolean;
  loading: boolean;
  refreshPair: () => Promise<void>;
};

const PairContext = createContext<PairContextValue>({ pairId: null, isSolo: false, loading: true, refreshPair: async () => {} });

export const usePair = () => useContext(PairContext);

export const PairProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [pairId, setPairId] = useState<string | null>(null);
  const [isSolo, setIsSolo] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshPair = useCallback(async () => {
    if (!user) return;
    const id = await getUserPairId(user.uid);
    setPairId(id);
    if (id) {
      const pair = await getPair(id);
      setIsSolo(pair?.soloMode === true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refreshPair();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PairContext.Provider value={{ pairId, isSolo, loading, refreshPair }}>
      {children}
    </PairContext.Provider>
  );
};
