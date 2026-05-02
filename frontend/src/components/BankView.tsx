import { useCallback, useState, type CSSProperties } from "react";

type MoneyItemType = "bill" | "coin";

interface MoneyItem {
  id: string;
  label: string;
  value: number;
  type: MoneyItemType;
  defaultPack: number;
}

interface ReceiptLineData {
  label: string;
  qty: number;
  subtotal: number;
  rollsInt: number;
  remainder: number;
  type: MoneyItemType;
}

interface ReceiptData {
  lines: ReceiptLineData[];
  total: number;
  date: string;
}

interface BankViewProps {
  onGoBack: () => void;
}

interface RowProps {
  item: MoneyItem;
  qty: number;
  raw: string;
  pack: number;
  onChange: (id: string, val: string) => void;
}

interface ReceiptLineProps {
  line: ReceiptLineData;
}

interface TicketDividerProps {
  dashed?: boolean;
}

interface SectionLabelProps {
  label: string;
}

interface SettingRowProps {
  item: MoneyItem;
  val: number;
  onChange: (value: number) => void;
}

const ITEMS_DEFAULT: MoneyItem[] = [
  { id: "50b", label: "50 €", value: 50.0, type: "bill", defaultPack: 100 },
  { id: "20b", label: "20 €", value: 20.0, type: "bill", defaultPack: 100 },
  { id: "10b", label: "10 €", value: 10.0, type: "bill", defaultPack: 100 },
  { id: "5b", label: "5 €", value: 5.0, type: "bill", defaultPack: 100 },
  { id: "2e", label: "2 €", value: 2.0, type: "coin", defaultPack: 25 },
  { id: "1e", label: "1 €", value: 1.0, type: "coin", defaultPack: 25 },
  { id: "50c", label: "50 ¢", value: 0.5, type: "coin", defaultPack: 40 },
  { id: "20c", label: "20 ¢", value: 0.2, type: "coin", defaultPack: 40 },
  { id: "10c", label: "10 ¢", value: 0.1, type: "coin", defaultPack: 40 },
  { id: "5c", label: "5 ¢", value: 0.05, type: "coin", defaultPack: 40 },
  { id: "2c", label: "2 ¢", value: 0.02, type: "coin", defaultPack: 50 },
  { id: "1c", label: "1 ¢", value: 0.01, type: "coin", defaultPack: 50 },
];

const C = {
  bg: "#080d12",
  bgRow: "#080d12",
  bgRowActive: "#07200f",
  bgSection: "#0e1520",
  bgHeader: "#0e1520",
  bgFooter: "#0e1520",
  border: "#2a3444",
  borderLight: "#1a2233",
  textPrimary: "#f0f6fc",
  textSecond: "#b0bec5",
  textMuted: "#6e8099",
  textDisabled: "#3d4f63",
  bill: "#7ec8ff",
  coin: "#ffc947",
  green: "#4ade80",
  gold: "#fbbf24",
  red: "#fc8181",
  blue: "#60aeff",
};

const GRID = "58px 1fr 1fr 1fr";

const fmt = (n: number): string =>
  `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;

const fmtDate = (): string => {
  const now = new Date();
  return (
    now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    "  " +
    now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
};

const packLabel = (type: MoneyItemType, count: number): string =>
  type === "coin"
    ? count > 1
      ? "rouleaux"
      : "rouleau"
    : count > 1
      ? "liasses"
      : "liasse";

const unitLabel = (type: MoneyItemType, count: number): string =>
  type === "coin"
    ? count > 1
      ? "pièces"
      : "pièce"
    : count > 1
      ? "billets"
      : "billet";

export default function BankView({ onGoBack }: BankViewProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(ITEMS_DEFAULT.map((i) => [i.id, ""])),
  );
  const [packs, setPacks] = useState<Record<string, number>>(
    Object.fromEntries(ITEMS_DEFAULT.map((i) => [i.id, i.defaultPack])),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [tempPacks, setTempPacks] = useState<Record<string, number>>({ ...packs });
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const handleQty = useCallback((id: string, val: string) => {
    if (val === "" || /^\d+$/.test(val)) {
      setQuantities((q) => ({ ...q, [id]: val }));
    }
  }, []);

  const getQty = (id: string): number => parseInt(quantities[id] || "0", 10);

  const total = ITEMS_DEFAULT.reduce((sum, item) => sum + getQty(item.id) * item.value, 0);

  const openSettings = (): void => {
    setTempPacks({ ...packs });
    setShowSettings(true);
  };

  const saveSettings = (): void => {
    setPacks({ ...tempPacks });
    setShowSettings(false);
  };

  const reset = (): void => {
    setQuantities(Object.fromEntries(ITEMS_DEFAULT.map((i) => [i.id, ""])));
  };

  const handleSave = (): void => {
    const lines = ITEMS_DEFAULT.filter((item) => getQty(item.id) > 0).map((item) => {
      const qty = getQty(item.id);
      const subtotal = qty * item.value;
      const pack = packs[item.id];
      const rollsInt = Math.floor(qty / pack);
      const remainder = qty % pack;
      return { label: item.label, qty, subtotal, rollsInt, remainder, type: item.type };
    });

    setReceiptData({ lines, total, date: fmtDate() });
    setShowReceipt(true);
  };

  return (
    <div
      style={{
        fontFamily: "'DM Mono', 'Courier New', monospace",
        background: C.bg,
        height: "100%",
        minHeight: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        color: C.textPrimary,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 8px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          background: C.bgHeader,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={onGoBack} style={btn(C.bgSection, C.textSecond, C.border)}>
            ←
          </button>
          <div>
            <div style={{ fontSize: "12px", color: C.textMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Comptabilité
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: C.blue, letterSpacing: "-0.02em" }}>
              Banque
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={reset} style={btn(C.bgSection, C.textSecond, C.border)}>↺ Raz</button>
          <button onClick={openSettings} style={btn("#0f1e35", C.blue, "#1e3a5f")}>⚙ Réglages</button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          padding: "5px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          background: C.bgSection,
        }}
      >
        <div style={colHead(C)}>Valeur</div>
        <div style={{ ...colHead(C), textAlign: "center" }}>Qté</div>
        <div style={{ ...colHead(C), textAlign: "center" }}>Liasses / Rouleaux</div>
        <div style={{ ...colHead(C), textAlign: "right" }}>Somme</div>
      </div>

      <div style={{ overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
        <SectionLabel label="▬ BILLETS" />
        {ITEMS_DEFAULT.filter((i) => i.type === "bill").map((item) => (
          <Row
            key={item.id}
            item={item}
            qty={getQty(item.id)}
            raw={quantities[item.id]}
            pack={packs[item.id]}
            onChange={handleQty}
          />
        ))}
        <SectionLabel label="● PIÈCES" />
        {ITEMS_DEFAULT.filter((i) => i.type === "coin").map((item) => (
          <Row
            key={item.id}
            item={item}
            qty={getQty(item.id)}
            raw={quantities[item.id]}
            pack={packs[item.id]}
            onChange={handleQty}
          />
        ))}
      </div>

      <div
        style={{
          borderTop: `2px solid ${C.border}`,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: C.bgFooter,
          gap: "10px",
        }}
      >
        <button
          onClick={handleSave}
          disabled={total === 0}
          style={{
            padding: "10px 16px",
            background: total > 0 ? "#0a2a14" : C.bgSection,
            border: `1px solid ${total > 0 ? "#2ecc71" : C.border}`,
            borderRadius: "8px",
            color: total > 0 ? C.green : C.textDisabled,
            fontFamily: "'DM Mono', monospace",
            fontSize: "13px",
            fontWeight: 700,
            cursor: total > 0 ? "pointer" : "default",
            letterSpacing: "0.04em",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          🖨 Enregistrer
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: "11px", color: C.textSecond, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Total caisse
          </span>
          <span
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: total > 0 ? C.green : C.textDisabled,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            {fmt(total)}
          </span>
        </div>
      </div>

      {showSettings && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            flexDirection: "column",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#0e1520",
              margin: "20px 12px",
              borderRadius: "12px",
              border: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100% - 40px)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px 10px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "16px", color: C.blue }}>⚙ Réglages des liasses</span>
              <button onClick={() => setShowSettings(false)} style={btn("#2a0f0f", C.red, "#5a1f1f")}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "10px 16px", flexGrow: 1, minHeight: 0 }}>
              <div style={sectionLbl(C)}>Billets — nbre / liasse</div>
              {ITEMS_DEFAULT.filter((i) => i.type === "bill").map((item) => (
                <SettingRow
                  key={item.id}
                  item={item}
                  val={tempPacks[item.id]}
                  onChange={(v) => setTempPacks((p) => ({ ...p, [item.id]: v }))}
                />
              ))}
              <div style={{ ...sectionLbl(C), marginTop: "14px" }}>Pièces — nbre / rouleau</div>
              {ITEMS_DEFAULT.filter((i) => i.type === "coin").map((item) => (
                <SettingRow
                  key={item.id}
                  item={item}
                  val={tempPacks[item.id]}
                  onChange={(v) => setTempPacks((p) => ({ ...p, [item.id]: v }))}
                />
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button
                onClick={saveSettings}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#0a2a14",
                  border: "1px solid #2ecc71",
                  borderRadius: "8px",
                  color: C.green,
                  fontFamily: "inherit",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}
              >
                ✓ Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptData && (
        <div
          onClick={() => setShowReceipt(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              color: "#000",
              fontFamily: "'DM Mono', 'Courier New', monospace",
              borderRadius: "3px",
              width: "100%",
              maxWidth: "320px",
              padding: "20px 18px 14px",
              boxShadow: "0 16px 60px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "6px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase" }}>
                Récapitulatif
              </div>
              <div style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "0.06em", color: "#000", marginTop: "1px" }}>
                CAISSE
              </div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{receiptData.date}</div>
            </div>

            <TicketDivider dashed />

            {receiptData.lines.filter((l) => l.type === "bill").length > 0 && (
              <>
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.16em", color: "#444", margin: "4px 0 1px", fontWeight: 700 }}>
                  Billets
                </div>
                {receiptData.lines
                  .filter((l) => l.type === "bill")
                  .map((line, i) => (
                    <ReceiptLine key={`${line.label}-${i}`} line={line} />
                  ))}
              </>
            )}

            {receiptData.lines.filter((l) => l.type === "coin").length > 0 && (
              <>
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.16em", color: "#444", margin: "4px 0 1px", fontWeight: 700 }}>
                  Pièces
                </div>
                {receiptData.lines
                  .filter((l) => l.type === "coin")
                  .map((line, i) => (
                    <ReceiptLine key={`${line.label}-${i}`} line={line} />
                  ))}
              </>
            )}

            {receiptData.lines.length === 0 && (
              <div style={{ textAlign: "center", color: "#888", fontSize: "13px", padding: "10px 0" }}>Aucune valeur saisie</div>
            )}

            <TicketDivider />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "2px 0 1px" }}>
              <span style={{ fontSize: "13px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                TOTAL
              </span>
              <span style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "-0.02em" }}>{fmt(receiptData.total)}</span>
            </div>

            <TicketDivider dashed />

            <button
              onClick={() => setShowReceipt(false)}
              style={{
                marginTop: "8px",
                width: "100%",
                padding: "10px",
                background: "#000",
                border: "none",
                borderRadius: "3px",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              ✕ Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ item, qty, raw, pack, onChange }: RowProps) {
  const subtotal = qty * item.value;
  const rollsInt = Math.floor(qty / pack);
  const remainder = qty % pack;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        padding: "6px 16px",
        alignItems: "center",
        borderBottom: `1px solid ${C.borderLight}`,
        background: qty > 0 ? C.bgRowActive : C.bgRow,
        transition: "background 0.15s",
      }}
    >
      <div style={{ fontSize: "16px", fontWeight: 700, color: item.type === "coin" ? C.coin : C.bill }}>{item.label}</div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          value={raw}
          placeholder="0"
          onChange={(e) => onChange(item.id, e.target.value)}
          style={{
            width: "80px",
            padding: "7px 8px",
            background: qty > 0 ? "#0a2a14" : "#0e1520",
            border: `1px solid ${qty > 0 ? "#2ecc71" : C.border}`,
            borderRadius: "6px",
            color: qty > 0 ? C.green : C.textMuted,
            fontSize: "17px",
            fontFamily: "inherit",
            textAlign: "center",
            outline: "none",
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        {qty > 0 ? (
          <>
            {rollsInt > 0 ? (
              <div style={{ fontSize: "13px", fontWeight: 700, color: C.gold, lineHeight: 1.25 }}>
                {rollsInt} {packLabel(item.type, rollsInt)}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: C.textDisabled, lineHeight: 1.25 }}>—</div>
            )}
            {remainder > 0 ? (
              <div style={{ fontSize: "12px", color: C.textSecond, lineHeight: 1.35 }}>
                {remainder} {unitLabel(item.type, remainder)}
              </div>
            ) : rollsInt > 0 ? (
              <div style={{ fontSize: "11px", color: C.textMuted, lineHeight: 1.35 }}>0 restant</div>
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: "14px", color: C.textDisabled }}>—</span>
        )}
      </div>

      <div style={{ textAlign: "right" }}>
        {qty > 0 ? (
          <div style={{ fontSize: "15px", fontWeight: 700, color: C.green }}>{fmt(subtotal)}</div>
        ) : (
          <span style={{ fontSize: "14px", color: C.textDisabled }}>—</span>
        )}
      </div>
    </div>
  );
}

function ReceiptLine({ line }: ReceiptLineProps) {
  const { label, subtotal, rollsInt, remainder, type } = line;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", alignItems: "center", padding: "2px 0", gap: "6px" }}>
      <span style={{ fontSize: "14px", fontWeight: 700, color: "#000" }}>{label}</span>
      <div style={{ lineHeight: 1.2 }}>
        {rollsInt > 0 ? (
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#000" }}>
            {rollsInt} {packLabel(type, rollsInt)}
          </div>
        ) : null}
        {remainder > 0 ? (
          <div style={{ fontSize: "11px", color: "#444" }}>
            {remainder} {unitLabel(type, remainder)}
          </div>
        ) : rollsInt > 0 ? (
          <div style={{ fontSize: "11px", color: "#aaa" }}>0 restant</div>
        ) : null}
      </div>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "#000", textAlign: "right" }}>{fmt(subtotal)}</span>
    </div>
  );
}

function TicketDivider({ dashed }: TicketDividerProps) {
  return <div style={{ borderTop: dashed ? "1px dashed #aaa" : "2px solid #000", margin: "5px 0" }} />;
}

function SectionLabel({ label }: SectionLabelProps) {
  return (
    <div
      style={{
        fontSize: "11px",
        letterSpacing: "0.14em",
        color: C.textSecond,
        fontWeight: 700,
        padding: "5px 16px 4px",
        background: C.bgSection,
        borderBottom: `1px solid ${C.border}`,
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

function SettingRow({ item, val, onChange }: SettingRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: `1px solid ${C.borderLight}`,
      }}
    >
      <span style={{ fontSize: "15px", fontWeight: 700, color: item.type === "coin" ? C.coin : C.bill }}>{item.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={val}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
        style={{
          width: "70px",
          padding: "5px 8px",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: "6px",
          color: C.textPrimary,
          fontFamily: "inherit",
          fontSize: "15px",
          textAlign: "center",
          outline: "none",
        }}
      />
    </div>
  );
}

const colHead = (c: typeof C): CSSProperties => ({
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: c.textSecond,
  fontWeight: 700,
});

const sectionLbl = (c: typeof C): CSSProperties => ({
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontWeight: 700,
  color: c.textSecond,
  marginBottom: "6px",
  paddingBottom: "4px",
  borderBottom: `1px solid ${c.border}`,
});

const btn = (bg: string, color: string, border: string): CSSProperties => ({
  padding: "8px 12px",
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: "7px",
  color,
  fontFamily: "'DM Mono', monospace",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.03em",
});
