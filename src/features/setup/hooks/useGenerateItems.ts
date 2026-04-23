// src/features/setup/hooks/useGenerateItems.ts
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/functions";
import type { Hearing, ItemDraft } from "../../../types";

export const useGenerateItems = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (hearing: Hearing, existingTitles?: string[]): Promise<ItemDraft[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable<{ hearing: Hearing; existingTitles?: string[] }, { items: ItemDraft[] }>(
        functions,
        "generateItems"
      );
      const result = await fn({ hearing, existingTitles });
      return result.data.items;
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "リストの生成に失敗しました。もう一度お試しください。";
      console.error("useGenerateItems:", msg);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, error };
};
