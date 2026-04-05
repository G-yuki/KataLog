// src/features/auth/hooks/useAuth.ts
import { useState, useEffect } from "react";
import {
  type User,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "../../../firebase/auth";
import { saveUserProfile } from "../../pair/services/pairService";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ログイン時にユーザーレコードを初期化（displayName は NicknameSetup で設定）
        await saveUserProfile(user.uid);
      }
      setState({ user, loading: false, error: null });
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "ログインに失敗しました。もう一度お試しください。",
      }));
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      setState((prev) => ({
        ...prev,
        error: "ログアウトに失敗しました。",
      }));
    }
  };

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signOut,
  };
};
