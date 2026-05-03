import { useCallback, useState } from "react";

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
    <section className="bank-view screen-wrapper">
      <header className="bank-header">
        <button type="button" className="btn-back bank-back" onClick={onGoBack}>← Retour</button>
        <div className="bank-title-block">
          <span className="bank-eyebrow">Comptabilité</span>
          <h2 className="bank-title">Banque</h2>
        </div>
        <div className="bank-header-actions">
          <button type="button" className="bank-tool-btn" onClick={reset}>↺ Raz</button>
          <button type="button" className="bank-tool-btn primary" onClick={openSettings}>⚙ Réglages</button>
        </div>
      </header>

      <div className="bank-list-head">
        <span>Valeur</span>
        <span>Qté</span>
        <span>Liasses / Rouleaux</span>
        <span>Somme</span>
      </div>

      <div className="bank-list">
        <div className="bank-section-label">Billets</div>
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
        <div className="bank-section-label">Pièces</div>
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

      <div className="bank-footer">
        <div className="bank-total-block">
          <span className="bank-total-label">Total caisse</span>
          <span className={`bank-total-amount${total > 0 ? ' positive' : ''}`}>{fmt(total)}</span>
        </div>
        <button
          type="button"
          className={`bank-save-btn${total > 0 ? ' ready' : ''}`}
          onClick={handleSave}
          disabled={total === 0}
        >
          Enregistrer
        </button>
      </div>

      {showSettings && (
        <div className="bank-overlay" onClick={() => setShowSettings(false)}>
          <article className="bank-settings-card" onClick={(e) => e.stopPropagation()}>
            <header className="bank-settings-header">
              <span>Réglages des liasses</span>
              <button type="button" className="bank-tool-btn" onClick={() => setShowSettings(false)}>✕</button>
            </header>
            <div className="bank-settings-body">
              <div className="bank-settings-section-title">Billets — nbre / liasse</div>
              {ITEMS_DEFAULT.filter((i) => i.type === "bill").map((item) => (
                <SettingRow
                  key={item.id}
                  item={item}
                  val={tempPacks[item.id]}
                  onChange={(v) => setTempPacks((p) => ({ ...p, [item.id]: v }))}
                />
              ))}
              <div className="bank-settings-section-title">Pièces — nbre / rouleau</div>
              {ITEMS_DEFAULT.filter((i) => i.type === "coin").map((item) => (
                <SettingRow
                  key={item.id}
                  item={item}
                  val={tempPacks[item.id]}
                  onChange={(v) => setTempPacks((p) => ({ ...p, [item.id]: v }))}
                />
              ))}
            </div>
            <button type="button" className="bank-save-btn ready" onClick={saveSettings}>
              ✓ Enregistrer
            </button>
          </article>
        </div>
      )}

      {showReceipt && receiptData && (
        <div className="bank-receipt-overlay" onClick={() => setShowReceipt(false)}>
          <div className="bank-receipt-paper" onClick={(e) => e.stopPropagation()}>
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
    </section>
  );
}

function Row({ item, qty, raw, pack, onChange }: RowProps) {
  const subtotal = qty * item.value;
  const rollsInt = Math.floor(qty / pack);
  const remainder = qty % pack;

  return (
    <div className={`bank-row${qty > 0 ? ' active' : ''}`}>
      <div className={`bank-row-value bank-row-value-${item.type}`}>{item.label}</div>
      <div className="bank-row-qty">
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          value={raw}
          placeholder="0"
          onChange={(e) => onChange(item.id, e.target.value)}
          className={`bank-row-input${qty > 0 ? ' active' : ''}`}
        />
      </div>
      <div className="bank-row-pack">
        {qty > 0 ? (
          <>
            {rollsInt > 0 ? (
              <div className="bank-row-pack-main">
                {rollsInt} {packLabel(item.type, rollsInt)}
              </div>
            ) : (
              <div className="bank-row-pack-empty">—</div>
            )}
            {remainder > 0 ? (
              <div className="bank-row-pack-sub">
                {remainder} {unitLabel(item.type, remainder)}
              </div>
            ) : rollsInt > 0 ? (
              <div className="bank-row-pack-sub muted">0 restant</div>
            ) : null}
          </>
        ) : (
          <span className="bank-row-pack-empty">—</span>
        )}
      </div>
      <div className="bank-row-sum">
        {qty > 0 ? (
          <span className="bank-row-sum-amount">{fmt(subtotal)}</span>
        ) : (
          <span className="bank-row-pack-empty">—</span>
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

function SettingRow({ item, val, onChange }: SettingRowProps) {
  return (
    <div className="bank-setting-row">
      <span className={`bank-row-value-${item.type} bank-setting-label`}>{item.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={val}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
        className="bank-setting-input"
      />
    </div>
  );
}

