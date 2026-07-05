// src/contexts/PairContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../features/auth/hooks/useAuth";
import { getUserPairId, getPair } from "../features/pair/services/pairService";

type PairContextValue = {
  pairId: string | null;
  isSolo: boolean;
  loading: boolean;
};

const PairContext = createContext<PairContextValue>({ pairId: null, isSolo: false, loading: true });

export const usePair = () => useContext(PairContext);

export const PairProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [pairId, setPairId] = useState<string | null>(null);
  const [isSolo, setIsSolo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const id = await getUserPairId(user.uid);
      setPairId(id);
      if (id) {
        const pair = await getPair(id);
        setIsSolo(pair?.soloMode === true);
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <PairContext.Provider value={{ pairId, isSolo, loading }}>
      {children}
    </PairContext.Provider>
  );
};
