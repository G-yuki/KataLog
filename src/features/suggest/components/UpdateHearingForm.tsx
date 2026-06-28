import { useState } from "react";
import {
  GENRES, PREFECTURES,
  RANGE_OPTIONS, CHILDREN_OPTIONS, TRANSPORT_OPTIONS, BUDGET_OPTIONS, INDOOR_OPTIONS,
  OVERSEAS_REGIONS, OVERSEAS_COUNTRIES,
} from "../../../lib/constants";
import type { Hearing } from "../../../types";

interface Props {
  hearing: Partial<Hearing>;
  onChange: (h: Partial<Hearing>) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export const UpdateHearingForm = ({ hearing, onChange, onSubmit, submitting }: Props) => {
  const set = (key: keyof Hearing, value: string | string[] | undefined) =>
    onChange({ ...hearing, [key]: value } as Partial<Hearing>);

  const toggleGenre = (id: string) => {
    const genres = hearing.genres ?? [];
    set("genres", genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id]);
  };

  const isOverseas = !!hearing.overseas;

  const initRegion = (): string => {
    const o = hearing.overseas;
    if (!o) return OVERSEAS_REGIONS[0];
    if ((OVERSEAS_REGIONS as readonly string[]).includes(o)) return o;
    for (const [r, cs] of Object.entries(OVERSEAS_COUNTRIES)) {
      if (cs.includes(o)) return r;
    }
    return OVERSEAS_REGIONS[0];
  };
  const initCountry = (): string => {
    const o = hearing.overseas;
    if (!o || (OVERSEAS_REGIONS as readonly string[]).includes(o)) return "";
    for (const cs of Object.values(OVERSEAS_COUNTRIES)) {
      if (cs.includes(o)) return o;
    }
    return "その他";
  };
  const initOther = (): string => {
    const o = hearing.overseas;
    if (!o || (OVERSEAS_REGIONS as readonly string[]).includes(o)) return "";
    for (const cs of Object.values(OVERSEAS_COUNTRIES)) {
      if (cs.includes(o)) return "";
    }
    return o;
  };

  const [overseasRegion, setOverseasRegion] = useState(initRegion);
  const [overseasCountry, setOverseasCountry] = useState(initCountry);
  const [otherText, setOtherText] = useState(initOther);

  const handleRegionSelect = (r: string) => {
    setOverseasRegion(r);
    setOverseasCountry("");
    setOtherText("");
    set("overseas", r);
  };

  const handleCountrySelect = (country: string) => {
    setOverseasCountry(country);
    if (country === "その他") {
      setOtherText("");
      set("overseas", overseasRegion);
    } else {
      set("overseas", country || overseasRegion);
    }
  };

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    set("overseas", text || overseasRegion);
  };

  const canSubmit = (hearing.genres?.length ?? 0) > 0
    && !!hearing.children && !!hearing.transport
    && !!hearing.budget && !!hearing.indoor
    && (isOverseas || hearing.prefecture === "全国" || (!!hearing.prefecture && !!hearing.range));

  return (
    <div style={{ padding: "24px 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>

      <FormSection label="好きな体験タイプ">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GENRES.map((g) => {
            const selected = (hearing.genres ?? []).includes(g.id);
            return (
              <button key={g.id} onClick={() => toggleGenre(g.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                               borderRadius: 10, border: `1.5px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                               background: selected ? "var(--color-primary-light)" : "#fff",
                               cursor: "pointer", fontSize: 13, color: "var(--color-text-main)",
                               fontFamily: "var(--font-sans)", textAlign: "left" }}>
                <span>{g.emoji}</span>
                <span style={{ fontSize: 12 }}>{g.label}</span>
              </button>
            );
          })}
        </div>
      </FormSection>

      <FormSection label="活動エリア">
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <ToggleChip selected={!isOverseas} onClick={() => {
            onChange({ ...hearing, overseas: undefined, range: hearing.range ?? "neighbor" });
          }}>
            🏠 国内
          </ToggleChip>
          <ToggleChip selected={isOverseas} onClick={() => {
            if (!isOverseas) set("overseas", OVERSEAS_REGIONS[0]);
          }}>
            ✈️ 海外
          </ToggleChip>
        </div>

        {!isOverseas ? (
          <>
            <div style={{ marginBottom: 8 }}>
              <ToggleChip
                selected={hearing.prefecture === "全国"}
                onClick={() => {
                  if (hearing.prefecture === "全国") {
                    onChange({ ...hearing, prefecture: undefined, range: undefined });
                  } else {
                    onChange({ ...hearing, prefecture: "全国", range: "anywhere" });
                  }
                }}
              >
                🗾 全国
              </ToggleChip>
            </div>
            {hearing.prefecture !== "全国" && (
              <>
                <select value={hearing.prefecture ?? ""} onChange={(e) => set("prefecture", e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                                 border: "1.5px solid var(--color-border)", borderRadius: 10,
                                 background: "#fff", color: "var(--color-text-main)",
                                 fontFamily: "var(--font-sans)", marginBottom: 8 }}>
                  <option value="">都道府県を選択</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  {RANGE_OPTIONS.map((r) => (
                    <ToggleChip key={r.id} selected={hearing.range === r.id} onClick={() => set("range", r.id)}>
                      {r.label}
                    </ToggleChip>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {OVERSEAS_REGIONS.map((r) => (
                <ToggleChip key={r} selected={overseasRegion === r} onClick={() => handleRegionSelect(r)}>
                  {r}
                </ToggleChip>
              ))}
            </div>
            <select
              value={overseasCountry}
              onChange={(e) => handleCountrySelect(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                       border: "1.5px solid var(--color-border)", borderRadius: 10,
                       background: "#fff", color: overseasCountry ? "var(--color-text-main)" : "var(--color-text-soft)",
                       fontFamily: "var(--font-sans)" }}>
              <option value="">国を選択（任意）</option>
              {(OVERSEAS_COUNTRIES[overseasRegion] ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="その他">その他</option>
            </select>
            {overseasCountry === "その他" && (
              <input
                value={otherText}
                onChange={(e) => handleOtherTextChange(e.target.value)}
                placeholder="国名を入力"
                maxLength={40}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                         border: "1.5px solid var(--color-border)", borderRadius: 10,
                         background: "#fff", color: "var(--color-text-main)",
                         fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
            )}
          </>
        )}
      </FormSection>

      <FormSection label="屋内 / 屋外">
        <div style={{ display: "flex", gap: 8 }}>
          {INDOOR_OPTIONS.map((x) => (
            <ToggleChip key={x.id} selected={hearing.indoor === x.id} onClick={() => set("indoor", x.id)}>
              {x.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="予算（1回・ふたり合計）">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {BUDGET_OPTIONS.map((b) => (
            <ToggleChip key={b.id} selected={hearing.budget === b.id} onClick={() => set("budget", b.id)}>
              {b.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="お子さま">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CHILDREN_OPTIONS.map((c) => (
            <ToggleChip key={c.id} selected={hearing.children === c.id} onClick={() => set("children", c.id)}>
              {c.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="移動手段">
        <div style={{ display: "flex", gap: 8 }}>
          {TRANSPORT_OPTIONS.map((t) => (
            <ToggleChip key={t.id} selected={hearing.transport === t.id} onClick={() => set("transport", t.id)}>
              {t.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection label="その他リクエスト（任意）">
        <textarea value={hearing.freetext ?? ""} onChange={(e) => set("freetext", e.target.value)}
                  maxLength={100} rows={3} placeholder="例：ペットOKな場所が多め"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 13,
                           border: "1.5px solid var(--color-border)", borderRadius: 10,
                           background: "#fff", color: "var(--color-text-main)",
                           fontFamily: "var(--font-sans)", resize: "none",
                           lineHeight: 1.6, boxSizing: "border-box" }} />
      </FormSection>

      <button onClick={onSubmit} disabled={!canSubmit || submitting}
              style={{ width: "100%", padding: "16px", background: "var(--color-primary)",
                       color: "#fff", border: "none", borderRadius: 14, fontSize: 15,
                       fontWeight: 600, cursor: !canSubmit || submitting ? "default" : "pointer",
                       fontFamily: "var(--font-sans)",
                       opacity: !canSubmit || submitting ? 0.5 : 1 }}>
        {submitting ? "保存中..." : "プランを保存"}
      </button>
    </div>
  );
};

const FormSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-mid)" }}>{label}</p>
    {children}
  </div>
);

const ToggleChip = ({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) => (
  <button onClick={onClick}
          style={{ padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                   border: `1.5px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                   background: selected ? "var(--color-primary-light)" : "#fff",
                   color: "var(--color-text-main)", fontFamily: "var(--font-sans)" }}>
    {children}
  </button>
);
