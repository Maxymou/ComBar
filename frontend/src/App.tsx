import { useState, useCallback } from 'react';
import { Screen, OrderLine, PendingOrder, Product } from './types';
import { useProducts } from './hooks/useProducts';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { savePendingOrder, saveSetting, getSetting, markOrdersSynced } from './services/db';
import { submitOrder } from './services/api';
import { DENOMINATIONS } from './data/denominations';
import Header from './components/Header';
import ProductGrid from './components/ProductGrid';
import Summary from './components/Summary';
import Payment from './components/Payment';
import PriceEditor from './components/PriceEditor';
import './App.css';
import { useEffect } from 'react';

function initPrices(products: Product[]): Record<string, number> {
  const p: Record<string, number> = {};
  products.forEach(i => {
    p[`${i.id}_normal`] = i.normalPrice;
    p[`${i.id}_hh`] = i.hhPrice;
  });
  return p;
}

function getPrice(item: Product, isHH: boolean, prices: Record<string, number>): number {
  const key = `${item.id}_${isHH ? 'hh' : 'normal'}`;
  return prices[key] ?? (isHH ? item.hhPrice : item.normalPrice);
}

export default function App() {
  const { products } = useProducts();
  const { isOnline, pendingCount, refreshPending } = useOnlineStatus();

  const [isHH, setIsHH] = useState(false);
  const [order, setOrder] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<Screen>('select');
  const [checked, setChecked] = useState<Record<string, number>>({});
  const [given, setGiven] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>(() => initPrices(products));
  const [confirmFeedback, setConfirmFeedback] = useState(false);

  // Re-init prices when products change (e.g., loaded from API)
  useEffect(() => {
    getSetting<Record<string, number>>('customPrices').then(saved => {
      if (saved) {
        setPrices(prev => ({ ...initPrices(products), ...saved }));
      } else {
        setPrices(initPrices(products));
      }
    });
  }, [products]);

  const add = (id: string) => setOrder(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const remove = (id: string) => setOrder(p => {
    const n = { ...p };
    if ((n[id] || 0) > 1) n[id]--;
    else delete n[id];
    return n;
  });

  const toggleHH = () => { setIsHH(v => !v); setOrder({}); setChecked({}); setScreen('select'); };
  const reset = () => { setOrder({}); setChecked({}); setGiven({}); setScreen('select'); };

  const checkItem = (id: string, max: number) =>
    setChecked(p => { const cur = p[id] || 0; return cur >= max ? p : { ...p, [id]: cur + 1 }; });
  const uncheckItem = (id: string) =>
    setChecked(p => { const cur = p[id] || 0; return cur <= 0 ? p : { ...p, [id]: cur - 1 }; });

  const addGiven = (id: string) => setGiven(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const removeGiven = (id: string) => setGiven(p => {
    const n = { ...p };
    if ((n[id] || 0) > 1) n[id]--;
    else delete n[id];
    return n;
  });

  const setPrice = useCallback((id: string, type: string, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setPrices(p => {
        const updated = { ...p, [`${id}_${type}`]: num };
        saveSetting('customPrices', updated);
        return updated;
      });
    }
  }, []);

  const resetPrices = useCallback(() => {
    const fresh = initPrices(products);
    setPrices(fresh);
    saveSetting('customPrices', fresh);
  }, [products]);

  // Build order lines
  const bonusShooters = Object.entries(order)
    .filter(([id]) => isHH && products.find(i => i.id === id)?.hhBonus)
    .reduce((s, [, q]) => s + q, 0);

  const lines: OrderLine[] = products
    .filter(i => (order[i.id] || 0) > 0)
    .map(i => {
      const price = getPrice(i, isHH && i.category === 'drink', prices);
      const qty = order[i.id];
      return {
        productId: i.id,
        productName: i.name,
        icon: i.icon,
        quantity: qty,
        unitPrice: price,
        subtotal: price * qty,
        isBonus: false,
        category: i.category,
      };
    });

  if (bonusShooters > 0) {
    lines.push({
      productId: '_bonus',
      productName: 'Shooters offerts',
      icon: '🥃',
      quantity: bonusShooters,
      unitPrice: 0,
      subtotal: 0,
      isBonus: true,
      category: 'drink',
    });
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);

  const handleConfirmPayment = useCallback(async () => {
    const totalGiven = DENOMINATIONS.reduce((s, m) => s + m.value * (given[m.id] || 0), 0);
    const change = Math.max(0, Math.round((totalGiven - total) * 100) / 100);

    const pendingOrder: PendingOrder = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      total,
      isHappyHour: isHH,
      paymentGiven: totalGiven,
      paymentChange: change,
      lines: lines.map(l => ({
        productId: l.productId,
        productName: l.productName,
        icon: l.icon,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotal: l.subtotal,
        isBonus: l.isBonus,
        category: l.category,
      })),
      createdAt: new Date().toISOString(),
      synced: false,
    };

    // Save locally first (always)
    await savePendingOrder(pendingOrder);

    // Try to send to server if online
    if (navigator.onLine) {
      try {
        await submitOrder(pendingOrder);
        await markOrdersSynced([pendingOrder.id]);
      } catch {
        // Will sync later
      }
    }

    await refreshPending();

    // Show feedback then reset
    setConfirmFeedback(true);
    setTimeout(() => {
      setConfirmFeedback(false);
      reset();
    }, 1500);
  }, [given, total, isHH, lines, refreshPending]);

  if (confirmFeedback) {
    return (
      <div className={`app${isHH ? ' hh' : ''}`}>
        <div className="confirm-overlay">
          <div className="confirm-check">✓</div>
          <div className="confirm-text">Commande enregistrée</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app${isHH ? ' hh' : ''}`}>
      <Header
        isHH={isHH}
        isOnline={isOnline}
        pendingCount={pendingCount}
        onToggleHH={toggleHH}
        onNavigate={setScreen}
      />

      {screen === 'select' && (
        <ProductGrid
          products={products}
          order={order}
          isHH={isHH}
          prices={prices}
          onAdd={add}
          onRemove={remove}
          onValidate={() => setScreen('summary')}
          onCancel={() => setOrder({})}
        />
      )}

      {screen === 'summary' && (
        <Summary
          lines={lines}
          bonusShooters={bonusShooters}
          total={total}
          checked={checked}
          isHH={isHH}
          onCheckItem={checkItem}
          onUncheckItem={uncheckItem}
          onGoPayment={() => { setGiven({}); setScreen('monnaie'); }}
          onGoBack={() => setScreen('select')}
          onReset={reset}
        />
      )}

      {screen === 'monnaie' && (
        <Payment
          total={total}
          given={given}
          isHH={isHH}
          onAddGiven={addGiven}
          onRemoveGiven={removeGiven}
          onGoBack={() => setScreen('summary')}
          onConfirm={handleConfirmPayment}
        />
      )}

      {screen === 'prices' && (
        <PriceEditor
          products={products}
          prices={prices}
          isHH={isHH}
          onSetPrice={setPrice}
          onResetPrices={resetPrices}
          onGoBack={() => setScreen('select')}
        />
      )}
    </div>
  );
}
