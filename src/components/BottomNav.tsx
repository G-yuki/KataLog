// src/components/BottomNav.tsx
import { useNavigate, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  {
    path: "/home",
    label: "List",
    icon: (
      <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
        <path d="M2 11L11 3L20 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V19H17V9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="8.5" y="14" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    path: "/suggest",
    label: "Suggest",
    icon: (
      <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
        <path d="M10 2L11.4 8.6L18 10L11.4 11.4L10 18L8.6 11.4L2 10L8.6 8.6Z" fill="currentColor" />
        <path d="M17.5 1L18.3 3.7L21 4.5L18.3 5.3L17.5 8L16.7 5.3L14 4.5L16.7 3.7Z" fill="currentColor" />
        <path d="M4.5 15L5 16.5L6.5 17L5 17.5L4.5 19L4 17.5L2.5 17L4 16.5Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    path: "/memory",
    label: "Memory",
    icon: (
      <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
        <path d="M4 15V8a7 7 0 0114 0v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="2" y="14" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="16" y="14" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    path: "/setting",
    label: "Setting",
    icon: (
      <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 19c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === "/home"
      ? pathname === "/home"
      : pathname === path || pathname.startsWith(path + "/");

  return (
    <nav style={{
      position: "fixed",
      bottom: "max(16px, env(safe-area-inset-bottom, 16px))",
      left: 16,
      right: 16,
      zIndex: 50,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: 24,
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
        padding: "6px 8px",
      }}>
        {NAV_ITEMS.map(({ path, icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 0",
                background: active ? "var(--color-primary-light)" : "transparent",
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                color: active ? "var(--color-primary)" : "var(--color-text-soft)",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              {icon}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
