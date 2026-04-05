// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../features/auth/components/AuthGuard";
import { PairSetupPage } from "../features/pair/pages/PairSetupPage";
import { HearingPage } from "../features/setup/pages/HearingPage";
import { SwipePage } from "../features/setup/pages/SwipePage";
import { HomePage } from "../features/items/pages/HomePage";
import { ItemDetailPage } from "../features/items/pages/ItemDetailPage";

// Phase 4, 5, 6, 7 で実装するページのプレースホルダー
const Placeholder = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center min-h-screen">
    <p style={{ color: "var(--color-text-soft)" }}>{label}（準備中）</p>
  </div>
);

export const AppRoutes = () => {
  return (
    <Routes>
      {/* 認証不要 */}
      <Route path="/privacy" element={<Placeholder label="プライバシーポリシー" />} />
      <Route path="/terms" element={<Placeholder label="利用規約" />} />

      {/* 認証必要 */}
      <Route
        path="/*"
        element={
          <AuthGuard>
            <Routes>
              <Route path="/" element={<PairSetupPage />} />
              <Route path="/setup" element={<HearingPage />} />
              <Route path="/setup/swipe" element={<SwipePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/home/:itemId" element={<ItemDetailPage />} />
              <Route path="/suggest" element={<Placeholder label="提案" />} />
              <Route path="/memory" element={<Placeholder label="思い出生成" />} />
              <Route path="/settings" element={<Placeholder label="設定" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthGuard>
        }
      />
    </Routes>
  );
};
