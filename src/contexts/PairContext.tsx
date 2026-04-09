// src/contexts/PairContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../features/auth/hooks/useAuth";
import { getUserPairId } from "../features/pair/services/pairService";

type PairContextValue = {
  pairId: string | null;
  loading: boolean;
};

const PairContext = createContext<PairContextValue>({ pairId: null, loading: true });

export const usePair = () => useContext(PairContext);

export const PairProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [pairId, setPairId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getUserPairId(user.uid).then((id) => {
      setPairId(id);
      setLoading(false);
    });
  }, [user]);

  return (
    <PairContext.Provider value={{ pairId, loading }}>
      {children}
    </PairContext.Provider>
  );
};
