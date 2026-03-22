import { useState } from “react”;

const ITEMS = [
{ id: “biere25”,        name: “Bière 25cl”,  icon: “🍺”, normalPrice: 2,  hhPrice: 2,  hhBonus: true,  category: “drink” },
{ id: “biere50”,        name: “Bière 50cl”,  icon: “🍺”, normalPrice: 4,  hhPrice: 2,  hhBonus: true,  category: “drink” },
{ id: “pichet”,         name: “Pichet 1,5L”, icon: “🍻”, normalPrice: 10, hhPrice: 10, hhBonus: true,  category: “drink” },
{ id: “shooter”,        name: “Shooter”,     icon: “🥃”, normalPrice: 1,  hhPrice: 1,  hhBonus: false, category: “drink” },
{ id: “vinRouge”,       name: “Vin Rouge”,   icon: “🍷”, normalPrice: 2,  hhPrice: 2,  hhBonus: false, category: “drink” },
{ id: “vinBlanc”,       name: “Vin Blanc”,   icon: “🥂”, normalPrice: 2,  hhPrice: 2,  hhBonus: false, category: “drink” },
{ id: “consigne25”,     name: “Csg. 25cl”,   icon: “🫙”, normalPrice: 1,  hhPrice: 1,  hhBonus: false, category: “consigne” },
{ id: “consigne50”,     name: “Csg. 50cl”,   icon: “🫙”, normalPrice: 2,  hhPrice: 2,  hhBonus: false, category: “consigne” },
{ id: “consignePichet”, name: “Csg. Pichet”, icon: “🪣”, normalPrice: 5,  hhPrice: 5,  hhBonus: false, category: “consigne” },
{ id: “kebab”,          name: “Kebab”,        icon: “🥙”, normalPrice: 5,  hhPrice: 5,  hhBonus: false, category: “food” },
{ id: “vege”,           name: “Végé”,         icon: “🥗”, normalPrice: 5,  hhPrice: 5,  hhBonus: false, category: “food” },
];

export default function Bar() {
const [isHH, setIsHH]       = useState(false);
const [order, setOrder]     = useState({});
const [screen, setScreen]   = useState(“select”);
const [checked, setChecked] = useState({});
const [given, setGiven]     = useState({});

// Prix éditables — initialisés depuis ITEMS
const initPrices = () => {
const p = {};
ITEMS.forEach(i => {
p[`${i.id}_normal`] = i.normalPrice;
p[`${i.id}_hh`]     = i.hhPrice;
});
return p;
};
const [prices, setPrices] = useState(initPrices);

const getPrice = (item, hh) => prices[`${item.id}_${hh ? "hh" : "normal"}`] ?? (hh ? item.hhPrice : item.normalPrice);
const setPrice = (id, type, val) => {
const num = parseFloat(val);
if (!isNaN(num) && num >= 0) setPrices(p => ({ …p, [`${id}_${type}`]: num }));
};

const getQty = (id) => order[id] || 0;

const add    = (id) => setOrder(p => ({ …p, [id]: (p[id] || 0) + 1 }));
const remove = (id) => setOrder(p => {
const n = { …p };
if ((n[id] || 0) > 1) n[id]–;
else delete n[id];
return n;
});

const toggleHH = () => { setIsHH(v => !v); setOrder({}); setChecked({}); setScreen(“select”); };
const reset    = () => { setOrder({}); setChecked({}); setGiven({}); setScreen(“select”); };

const checkItem   = (id, max) => setChecked(p => { const cur = p[id]||0; return cur>=max ? p : {…p,[id]:cur+1}; });
const uncheckItem = (id)      => setChecked(p => { const cur = p[id]||0; return cur<=0  ? p : {…p,[id]:cur-1}; });

const totalItems = Object.values(order).reduce((s, v) => s + v, 0);

const bonusShooters = Object.entries(order)
.filter(([id]) => isHH && ITEMS.find(i => i.id === id)?.hhBonus)
.reduce((s, [, q]) => s + q, 0);

const lines = ITEMS
.filter(i => (order[i.id] || 0) > 0)
.map(i => {
const price = isHH ? getPrice(i, true) : getPrice(i, false);
const qty   = order[i.id];
return { …i, qty, price, sub: price * qty };
});
if (bonusShooters > 0)
lines.push({ id: “_b”, name: “Shooters offerts 🎁”, qty: bonusShooters, price: 0, sub: 0, free: true });

const total        = lines.reduce((s, l) => s + l.sub, 0);
const totalChecked = lines.filter(l => !l.free).reduce((s, l) => s + (checked[l.id] || 0), 0);
const totalToCheck = lines.filter(l => !l.free).reduce((s, l) => s + l.qty, 0);
const allChecked   = totalToCheck > 0 && totalChecked === totalToCheck;

const drinks    = ITEMS.filter(i => i.category === “drink”);
const consignes = ITEMS.filter(i => i.category === “consigne”);
const food      = ITEMS.filter(i => i.category === “food”);

const MONNAIES = [
{ id: “50”, label: “50€”,  value: 50,  type: “billet” },
{ id: “20”, label: “20€”,  value: 20,  type: “billet” },
{ id: “10”, label: “10€”,  value: 10,  type: “billet” },
{ id: “5”,  label: “5€”,   value: 5,   type: “billet” },
{ id: “2”,  label: “2€”,   value: 2,   type: “piece”  },
{ id: “1”,  label: “1€”,   value: 1,   type: “piece”  },
{ id: “05”, label: “0,5€”, value: 0.5, type: “piece”  },
];

const addGiven    = (id) => setGiven(p => ({ …p, [id]: (p[id] || 0) + 1 }));
const removeGiven = (id) => setGiven(p => {
const n = { …p };
if ((n[id] || 0) > 1) n[id]–;
else delete n[id];
return n;
});
const totalGiven    = MONNAIES.reduce((s, m) => s + m.value * (given[m.id] || 0), 0);
const monnaieRendue = Math.max(0, Math.round((totalGiven - total) * 100) / 100);

return (
<div className={`app${isHH ? " hh" : ""}`}>
<style>{`
@import url(‘https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap’);
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;overflow:hidden;}

```
    .app {
      height: 100dvh;
      background: #000;
      color: #fff;
      font-family: 'Barlow', sans-serif;
      display: flex;
      flex-direction: column;
      padding: 10px 10px 12px;
      max-width: 480px;
      margin: 0 auto;
      overflow: hidden;
    }
    .app.hh { background: #07000f; }

    /* ── HEADER ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      margin-bottom: 10px;
    }

    .title {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 2rem;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #FFE000;
      line-height: 1;
    }
    .app.hh .title { color: #FF2079; }

    .btn-hh {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 0.85rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 7px 14px;
      border-radius: 20px;
      cursor: pointer;
      border: 2px solid #FFE000;
      background: transparent;
      color: #FFE000;
      transition: all 0.2s;
    }
    .btn-hh:active { transform: scale(0.95); }
    .app.hh .btn-hh {
      border-color: #FF2079;
      color: #FF2079;
      background: rgba(255,32,121,0.12);
      animation: hhPulse 1.8s ease-in-out infinite;
    }
    @keyframes hhPulse {
      0%,100%{box-shadow:0 0 0 0 rgba(255,32,121,0.5)}
      50%{box-shadow:0 0 0 6px rgba(255,32,121,0)}
    }

    /* ── SECTION LABEL ── */
    .sec {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #555;
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
      margin-bottom: 6px;
    }
    .sec::after { content:''; flex:1; height:1px; background:#222; }

    /* ── GRID ── */
    .grid {
      display: grid;
      grid-template-columns: repeat(3,1fr);
      gap: 7px;
      flex-shrink: 0;
    }
    .grid.drinks    { margin-bottom: 8px; }
    .grid.consignes { margin-bottom: 8px; }
    .grid.food      { grid-template-columns: repeat(2,1fr); margin-bottom: 10px; }

    .card.food-card { }

    /* ── CARD ── */
    .card {
      border-radius: 12px;
      border: 2px solid #222;
      background: #111;
      position: relative;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 4px 12px;
      gap: 3px;
      transition: border-color 0.15s, background 0.15s;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .card:active { transform: scale(0.95); }
    .card.on-drink { border-color: #FFE000; background: #161200; }
    .card.on-csg   { border-color: #29B6F6; background: #001520; }
    .app.hh .card.on-drink { border-color: #FF2079; background: #160010; }
    .card.on-food  { border-color: #FF9800; background: #181000; }

    .card-icon { font-size: 1.9rem; line-height: 1; }
    .card-name {
      font-size: 0.64rem;
      font-weight: 600;
      color: #ccc;
      text-align: center;
      line-height: 1.2;
    }

    /* Prix normal centré en bas */
    .card-price {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 0.9rem;
      color: #FFE000;
    }
    .app.hh .card-price  { color: #00FFCC; }
    .csg .card-price     { color: #29B6F6; }

    /* Prix flottant en haut à droite quand actif */
    .card-price-top {
      position: absolute;
      top: 5px; right: 6px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 0.82rem;
      color: #FFE000;
      line-height: 1;
    }
    .app.hh .card-price-top { color: #00FFCC; }
    .csg .card-price-top    { color: #29B6F6; }
    .food-card .card-price-top { color: #FF9800; }

    .hh-tag {
      position: absolute;
      top: 4px; left: 4px;
      background: #FF2079;
      color: #fff;
      font-size: 0.52rem;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 5px;
      line-height: 1.4;
    }

    /* BADGE QUANTITE */
    .qty-badge {
      position: absolute;
      top: -10px; left: -10px;
      min-width: 34px;
      height: 34px;
      background: #FFE000;
      color: #000;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 1.5rem;
      border-radius: 17px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid #000;
      line-height: 1;
      padding: 0 6px;
      z-index: 2;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
    }
    .app.hh .qty-badge { background: #00FFCC; }
    .csg .qty-badge    { background: #29B6F6; }
    .food-card .qty-badge { background: #FF9800; }

    /* BOUTON MOINS */
    .minus-btn {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 32px;
      background: #FF3B30;
      color: #fff;
      border: none;
      border-top: 2px solid #000;
      border-radius: 0 0 10px 10px;
      font-size: 1.4rem;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2;
      line-height: 1;
      font-family: 'Barlow Condensed', sans-serif;
      -webkit-tap-highlight-color: transparent;
      letter-spacing: 0;
      padding-bottom: 2px;
    }
    .minus-btn:active { background: #ff6b6b; }

    /* ── VALIDATE BTN ── */
    .btn-validate {
      flex-shrink: 0;
      width: 100%;
      padding: 15px;
      background: #FFE000;
      color: #000;
      border: none;
      border-radius: 14px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.3rem;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .btn-validate:disabled { opacity: 0.2; cursor: not-allowed; }
    .btn-validate:not(:disabled):active { transform: scale(0.98); }
    .app.hh .btn-validate { background: #FF2079; color: #fff; }

    .btn-cancel-order {
      flex-shrink: 0;
      width: 100%;
      padding: 11px;
      background: transparent;
      color: #888;
      border: 2px solid #333;
      border-radius: 14px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 6px;
    }
    .btn-cancel-order:disabled { opacity: 0.15; cursor: not-allowed; }
    .btn-cancel-order:not(:disabled):hover { border-color: #FF3B30; color: #FF3B30; }
    .btn-cancel-order:not(:disabled):active { transform: scale(0.98); }

    .validate-count {
      background: #000;
      color: #FFE000;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 1rem;
      border-radius: 20px;
      padding: 2px 10px;
      line-height: 1.4;
    }
    .app.hh .validate-count { color: #FF2079; }

    /* ── SUMMARY SCREEN ── */
    .summary {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    }

    .total-card {
      background: #FFE000;
      border-radius: 14px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      transition: background 0.4s;
    }
    .app.hh .total-card { background: #FF2079; }
    .total-card.total-done { background: #00E676; }

    .total-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 0.9rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #000;
    }
    .total-progress {
      font-size: 0.75rem;
      font-weight: 600;
      color: rgba(0,0,0,0.55);
      margin-top: 1px;
    }
    .total-amount {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 3.2rem;
      line-height: 1;
      color: #000;
      letter-spacing: -1px;
    }

    .lines-box {
      flex: 1;
      background: #111;
      border: 2px solid #222;
      border-radius: 14px;
      padding: 8px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .app.hh .lines-box { background: #100018; border-color: #4400aa; }
    .lines-box::-webkit-scrollbar { width: 3px; }
    .lines-box::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    .cat-group { margin-bottom: 6px; }
    .cat-group:last-child { margin-bottom: 0; }

    .cat-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #555;
      padding: 4px 0 5px;
      border-bottom: 1px solid #1e1e1e;
      margin-bottom: 2px;
    }
    .app.hh .cat-label { border-color: #1e0030; }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #1a1a1a;
      gap: 8px;
      transition: opacity 0.2s;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .line:active { opacity: 0.6; }
    .app.hh .line { border-color: #18002a; }
    .line:last-child { border-bottom: none; }
    .line.line-done { opacity: 0.45; }
    .line.line-free { opacity: 0.7; }

    .line-left {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 1;
      min-width: 0;
    }
    .line-icon { font-size: 1.2rem; flex-shrink: 0; }
    .line-name { font-size: 0.85rem; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .line.line-done .line-name { text-decoration: line-through; color: #666; }

    .line-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* DOTS */
    .dots { display: flex; gap: 5px; align-items: center; }

    .dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid #444;
      background: transparent;
      display: inline-block;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s;
      pointer-events: none;
    }
    .dot.dot-on {
      background: #FFE000;
      border-color: #FFE000;
    }
    .app.hh .dot.dot-on { background: #00FFCC; border-color: #00FFCC; }

    .bottom-row {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-back {
      flex: 1;
      padding: 11px;
      background: transparent;
      color: #fff;
      border: 2px solid #444;
      border-radius: 14px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .btn-back:hover { border-color: #888; background: rgba(255,255,255,0.05); }
    .btn-back:active { transform: scale(0.97); }

    /* ── BTN MONNAIES ── */
    .btn-monnaies {
      flex-shrink: 0;
      width: 100%;
      padding: 13px;
      background: #1a1400;
      border: 2.5px solid #FFE000;
      border-radius: 14px;
      color: #FFE000;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.15rem;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-monnaies:hover { background: rgba(255,224,0,0.1); }
    .btn-monnaies:active { transform: scale(0.98); }
    .app.hh .btn-monnaies { border-color: #00FFCC; color: #00FFCC; background: #001a16; }

    /* ── ÉCRAN MONNAIE ── */
    .monnaie-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 7px;
      overflow: hidden;
    }

    .money-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      border-radius: 12px;
      flex-shrink: 0;
    }
    .money-row-total   { background: #1a1a1a; border: 2px solid #333; }
    .money-row-given   { background: #1a1a1a; border: 2px solid #333; }
    .money-row-change  { background: #1a1a1a; border: 2px solid #333; }
    .money-row-change.change-positive { background: #001a0a; border-color: #00E676; }
    .money-row-change.change-negative { background: #1a0000; border-color: #FF3B30; }

    .money-row-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #666;
    }
    .money-row-amount {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 1.9rem;
      color: #fff;
      line-height: 1;
    }
    .given-amount  { color: #FFE000; }
    .app.hh .given-amount { color: #00FFCC; }
    .change-positive .change-amount { color: #00E676; }
    .change-negative .change-amount { color: #FF3B30; }

    .money-sec {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #555;
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
    }
    .money-sec::after { content:''; flex:1; height:1px; background:#222; }

    .money-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
      flex-shrink: 0;
    }

    .money-card {
      border-radius: 12px;
      border: 2px solid #222;
      background: #111;
      position: relative;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 4px 9px;
      gap: 3px;
      transition: border-color 0.15s, background 0.15s;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .money-card:active { transform: scale(0.95); }
    .money-card.billet.money-on { border-color: #FFE000; background: #161200; }
    .money-card.piece.money-on  { border-color: #C0C0C0; background: #141414; }
    .app.hh .money-card.billet.money-on { border-color: #00FFCC; background: #001a16; }

    .money-icon  { font-size: 1.6rem; line-height: 1; }
    .money-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 1rem;
      color: #fff;
    }
    .billet.money-on .money-label { color: #FFE000; }
    .piece.money-on  .money-label { color: #C0C0C0; }
    .app.hh .billet.money-on .money-label { color: #00FFCC; }

    .money-badge {
      position: absolute;
      top: -9px; left: -9px;
      min-width: 28px;
      height: 28px;
      background: #FFE000;
      color: #000;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 1.1rem;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid #000;
      padding: 0 5px;
      z-index: 2;
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
    }
    .piece .money-badge { background: #C0C0C0; }
    .app.hh .money-badge { background: #00FFCC; }

    .money-minus {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 26px;
      background: #FF3B30;
      color: #fff;
      border: none;
      border-top: 2px solid #000;
      border-radius: 0 0 10px 10px;
      font-size: 1.2rem;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2;
      font-family: 'Barlow Condensed', sans-serif;
      -webkit-tap-highlight-color: transparent;
      padding-bottom: 1px;
    }
    .money-minus:active { background: #ff6b6b; }

    .line-price {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 1rem;
      color: #FFE000;
      min-width: 52px;
      text-align: right;
      padding: 6px 4px;
      margin: -6px -4px;
      border-radius: 8px;
      cursor: pointer;
      -webkit-tap-highlight-color: rgba(255,59,48,0.3);
      transition: background 0.15s;
    }
    .line-price:active { background: rgba(255,59,48,0.3); }
    .app.hh .line-price { color: #00FFCC; }

    .line-qty-free {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 1rem;
      color: #00E676;
    }
    .line-price-free {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 1rem;
      color: #00E676;
      min-width: 46px;
      text-align: right;
    }

    /* BTN CONFIRM */
    .btn-confirm {
      flex-shrink: 0;
      width: 100%;
      padding: 14px;
      background: #1a1a1a;
      border: 2.5px solid #333;
      border-radius: 14px;
      color: #555;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.1rem;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: not-allowed;
      transition: all 0.3s;
    }
    .btn-confirm.btn-confirm-ready {
      background: #00E676;
      border-color: #00E676;
      color: #000;
      cursor: pointer;
      animation: confirmPulse 1.5s ease-in-out infinite;
    }
    .btn-confirm.btn-confirm-ready:active { transform: scale(0.98); }
    @keyframes confirmPulse {
      0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,0.5)}
      50%{box-shadow:0 0 0 8px rgba(0,230,118,0)}
    }

    .btn-reset {
      flex: 1;
      padding: 11px;
      background: transparent;
      color: #555;
      border: 1.5px solid #2a2a2a;
      border-radius: 14px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }
    .btn-reset:hover { border-color: #666; color: #aaa; }
    .btn-reset:active { transform: scale(0.98); }

    /* ── TITLE CLICKABLE ── */
    .title-btn {
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      transition: opacity 0.15s;
    }
    .title-btn:active { opacity: 0.6; }

    /* ── ÉCRAN PRIX ── */
    .prices-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: hidden;
    }
    .prices-scroll {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .prices-scroll::-webkit-scrollbar { width: 3px; }
    .prices-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    .price-group { margin-bottom: 6px; }

    .price-cat-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #555;
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 6px;
    }
    .price-cat-label::after { content:''; flex:1; height:1px; background:#222; }

    .price-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #111;
      border: 1.5px solid #222;
      border-radius: 12px;
      margin-bottom: 6px;
    }

    .price-row-icon { font-size: 1.4rem; flex-shrink: 0; }
    .price-row-name {
      flex: 1;
      font-size: 0.88rem;
      font-weight: 600;
      color: #fff;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .price-inputs {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .price-input-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .price-input-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #555;
    }
    .price-input-label.hh-col { color: #FF2079; }

    .price-input-row {
      display: flex;
      align-items: center;
      background: #1a1a1a;
      border: 2px solid #333;
      border-radius: 8px;
      overflow: hidden;
      height: 36px;
    }

    .price-input {
      width: 52px;
      background: transparent;
      border: none;
      outline: none;
      color: #FFE000;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 1.1rem;
      text-align: right;
      padding: 0 4px;
      -moz-appearance: textfield;
    }
    .price-input::-webkit-outer-spin-button,
    .price-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .price-input.hh-input { color: #FF2079; }
    .app.hh .price-input { color: #00FFCC; }

    .price-euro {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 1rem;
      color: #555;
      padding-right: 6px;
    }
    .price-euro.hh-col { color: #FF2079; }
  `}</style>

  {/* HEADER */}
  <div className="header">
    <div className="title title-btn" onClick={() => setScreen("prices")}>BAR {isHH && "⚡"}</div>
    <button className="btn-hh" onClick={toggleHH}>
      {isHH ? "⚡ HH ON" : "Happy Hour"}
    </button>
  </div>

  {screen === "select" && (
    <>
      {/* BOISSONS */}
      <div className="sec">Boissons</div>
      <div className="grid drinks">
        {drinks.map(item => {
          const qty   = getQty(item.id);
          const price = getPrice(item, isHH);
          const showB = isHH && item.hhBonus;
          return (
            <div
              key={item.id}
              className={`card${qty > 0 ? " on-drink" : ""}`}
              onClick={() => add(item.id)}
            >
              {showB && <span className="hh-tag">+🥃</span>}
              {qty > 0 && <span className="qty-badge">{qty}</span>}
              {qty > 0 && <span className="card-price-top">{showB ? `${price}€+🥃` : `${price} €`}</span>}
              {qty > 0 && (
                <button className="minus-btn" onClick={e => { e.stopPropagation(); remove(item.id); }}>−</button>
              )}
              <span className="card-icon">{item.icon}</span>
              <span className="card-name">{item.name}</span>
              <span className="card-price" style={{visibility: qty > 0 ? "hidden" : "visible"}}>{showB ? `${price}€+🥃` : `${price} €`}</span>
            </div>
          );
        })}
      </div>

      {/* CONSIGNES */}
      <div className="sec">Consignes</div>
      <div className="grid consignes">
        {consignes.map(item => {
          const qty = getQty(item.id);
          const price = getPrice(item, false);
          return (
            <div
              key={item.id}
              className={`card csg${qty > 0 ? " on-csg" : ""}`}
              onClick={() => add(item.id)}
            >
              {qty > 0 && <span className="qty-badge">{qty}</span>}
              {qty > 0 && <span className="card-price-top">{price} €</span>}
              {qty > 0 && (
                <button className="minus-btn" onClick={e => { e.stopPropagation(); remove(item.id); }}>−</button>
              )}
              <span className="card-icon">{item.icon}</span>
              <span className="card-name">{item.name}</span>
              <span className="card-price" style={{visibility: qty > 0 ? "hidden" : "visible"}}>{price} €</span>
            </div>
          );
        })}
      </div>

      {/* SANDWICHES */}
      <div className="sec">Sandwiches</div>
      <div className="grid food">
        {food.map(item => {
          const qty = getQty(item.id);
          const price = getPrice(item, false);
          return (
            <div
              key={item.id}
              className={`card food-card${qty > 0 ? " on-food" : ""}`}
              onClick={() => add(item.id)}
            >
              {qty > 0 && <span className="qty-badge qty-badge-food">{qty}</span>}
              {qty > 0 && <span className="card-price-top">{price} €</span>}
              {qty > 0 && (
                <button className="minus-btn" onClick={e => { e.stopPropagation(); remove(item.id); }}>−</button>
              )}
              <span className="card-icon">{item.icon}</span>
              <span className="card-name">{item.name}</span>
              <span className="card-price food-price" style={{visibility: qty > 0 ? "hidden" : "visible"}}>{price} €</span>
            </div>
          );
        })}
      </div>

      {/* VALIDER */}
      <button
        className="btn-validate"
        disabled={totalItems === 0}
        onClick={() => setScreen("summary")}
      >
        Valider
        {totalItems > 0 && <span className="validate-count">{totalItems} article{totalItems > 1 ? "s" : ""}</span>}
      </button>
      <button
        className="btn-cancel-order"
        disabled={totalItems === 0}
        onClick={() => setOrder({})}
      >
        Annuler la sélection
      </button>
    </>
  )}

  {screen === "summary" && (
    <div className="summary">

      {/* TOTAL */}
      <div className={`total-card${allChecked ? " total-done" : ""}`}>
        <div>
          <div className="total-label">Total à payer</div>
          <div className="total-progress">{totalChecked}/{totalToCheck} préparé{totalChecked > 1 ? "s" : ""}</div>
        </div>
        <span className="total-amount">{total.toFixed(2)} €</span>
      </div>

      {/* LIGNES PAR CATÉGORIE */}
      <div className="lines-box">
        {["drink","consigne","food"].map(cat => {
          const catLines = lines.filter(l => l.category === cat);
          if (catLines.length === 0) return null;
          const catLabel = cat === "drink" ? "🍺 Boissons" : cat === "consigne" ? "🫙 Consignes" : "🥙 Sandwiches";
          return (
            <div key={cat} className="cat-group">
              <div className="cat-label">{catLabel}</div>
              {catLines.map(l => {
                const chk = checked[l.id] || 0;
                const done = chk >= l.qty;
                return (
                  <div key={l.id} className={`line${done ? " line-done" : ""}`}
                    onClick={() => checkItem(l.id, l.qty)}
                  >
                    <div className="line-left">
                      <span className="line-icon">{l.icon}</span>
                      <span className="line-name">{l.name}</span>
                    </div>
                    <div className="line-right">
                      <div className="dots">
                        {Array.from({ length: l.qty }).map((_, i) => (
                          <span key={i} className={`dot${i < chk ? " dot-on" : ""}`} />
                        ))}
                      </div>
                      <span className="line-price"
                        onClick={e => { e.stopPropagation(); uncheckItem(l.id); }}
                      >{l.sub.toFixed(2)} €</span>
                    </div>
                  </div>
                );
              })}
              {cat === "drink" && bonusShooters > 0 && (
                <div className="line line-free">
                  <div className="line-left">
                    <span className="line-icon">🥃</span>
                    <span className="line-name">Shooters offerts</span>
                  </div>
                  <div className="line-right">
                    <span className="line-qty-free">×{bonusShooters}</span>
                    <span className="line-price-free">Offert</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BOUTONS */}
      <button className="btn-monnaies" onClick={() => { setGiven({}); setScreen("monnaie"); }}>
        💰 Monnaie
      </button>
      <div className="bottom-row">
        <button className="btn-back" onClick={() => setScreen("select")}>← Retour</button>
        <button className="btn-reset" onClick={reset}>🗑 Réinitialiser</button>
      </div>
    </div>
  )}

  {screen === "monnaie" && (
    <div className="monnaie-screen">

      {/* RÉCAP MONTANTS */}
      <div className="money-row money-row-total">
        <span className="money-row-label">À payer</span>
        <span className="money-row-amount">{total.toFixed(2)} €</span>
      </div>
      <div className="money-row money-row-given">
        <span className="money-row-label">Reçu</span>
        <span className="money-row-amount given-amount">{totalGiven.toFixed(2)} €</span>
      </div>
      <div className={`money-row money-row-change${monnaieRendue > 0 ? " change-positive" : totalGiven > 0 && totalGiven < total ? " change-negative" : ""}`}>
        <span className="money-row-label">{totalGiven > 0 && totalGiven < total ? "Manque" : "À rendre"}</span>
        <span className="money-row-amount change-amount">
          {totalGiven > 0 && totalGiven < total
            ? `−${(total - totalGiven).toFixed(2)} €`
            : `${monnaieRendue.toFixed(2)} €`}
        </span>
      </div>

      {/* BILLETS */}
      <div className="money-sec">Billets</div>
      <div className="money-grid">
        {MONNAIES.filter(m => m.type === "billet").map(m => {
          const qty = given[m.id] || 0;
          return (
            <div key={m.id} className={`money-card billet${qty > 0 ? " money-on" : ""}`} onClick={() => addGiven(m.id)}>
              {qty > 0 && <span className="money-badge">{qty}</span>}
              {qty > 0 && <button className="money-minus" onClick={e => { e.stopPropagation(); removeGiven(m.id); }}>−</button>}
              <span className="money-icon">💶</span>
              <span className="money-label">{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* PIÈCES */}
      <div className="money-sec">Pièces</div>
      <div className="money-grid">
        {MONNAIES.filter(m => m.type === "piece").map(m => {
          const qty = given[m.id] || 0;
          return (
            <div key={m.id} className={`money-card piece${qty > 0 ? " money-on" : ""}`} onClick={() => addGiven(m.id)}>
              {qty > 0 && <span className="money-badge">{qty}</span>}
              {qty > 0 && <button className="money-minus" onClick={e => { e.stopPropagation(); removeGiven(m.id); }}>−</button>}
              <span className="money-icon">🪙</span>
              <span className="money-label">{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* BOUTONS */}
      <div className="bottom-row">
        <button className="btn-back" onClick={() => setScreen("summary")}>← Retour</button>
        <button className="btn-reset" onClick={reset}>🗑 Annuler</button>
      </div>
    </div>
  )}

  {screen === "prices" && (
    <div className="prices-screen">
      <div className="prices-scroll">

        {["drink","consigne","food"].map(cat => {
          const catItems = ITEMS.filter(i => i.category === cat);
          const catLabel = cat === "drink" ? "🍺 Boissons" : cat === "consigne" ? "🫙 Consignes" : "🥙 Sandwiches";
          return (
            <div key={cat} className="price-group">
              <div className="price-cat-label">{catLabel}</div>
              {catItems.map(item => (
                <div key={item.id} className="price-row">
                  <span className="price-row-icon">{item.icon}</span>
                  <span className="price-row-name">{item.name}</span>
                  <div className="price-inputs">
                    <div className="price-input-wrap">
                      <span className="price-input-label">Normal</span>
                      <div className="price-input-row">
                        <input
                          className="price-input"
                          type="number"
                          min="0"
                          step="0.5"
                          value={getPrice(item, false)}
                          onChange={e => setPrice(item.id, "normal", e.target.value)}
                        />
                        <span className="price-euro">€</span>
                      </div>
                    </div>
                    <div className="price-input-wrap">
                      <span className="price-input-label hh-col">HH</span>
                      <div className="price-input-row">
                        <input
                          className="price-input hh-input"
                          type="number"
                          min="0"
                          step="0.5"
                          value={getPrice(item, true)}
                          onChange={e => setPrice(item.id, "hh", e.target.value)}
                        />
                        <span className="price-euro hh-col">€</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="bottom-row">
        <button className="btn-back" onClick={() => setScreen("select")}>← Retour</button>
        <button className="btn-reset" onClick={() => { setPrices(initPrices()); }}>↺ Réinitialiser</button>
      </div>
    </div>
  )}
</div>
```

);
}