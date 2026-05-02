import { useState, useCallback, useEffect } from 'react';
import { Screen, PendingOrder } from './types';
import { useProducts } from './hooks/useProducts';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useRealtimeState, initPrices } from './hooks/useRealtimeState';
import { useOrderBuilder } from './hooks/useOrderBuilder';
import { savePendingOrder, getSetting, markOrdersSynced } from './services/db';
import { submitOrder } from './services/api';
import { DENOMINATIONS } from './data/denominations';
import Header from './components/Header';
import ProductGrid from './components/ProductGrid';
import Summary from './components/Summary';
import Payment from './components/Payment';
import PriceEditor from './components/PriceEditor';
import PendingOrdersView from './components/PendingOrdersView';
import SideDrawer, { View } from './components/SideDrawer';
import { isDebugViewportEnabled } from './debug';
import './App.css';

export default function App() {
  const viewportDebug = isDebugViewportEnabled();
  const { products } = useProducts();
  const { isOnline, pendingCount, syncState, lastSyncAt, refreshPending, forceSync } = useOnlineStatus();

  const [order, setOrder] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<Screen>('select');
  const [checked, setChecked] = useState<Record<string, number>>({});
  const [given, setGiven] = useState<Record<string, number>>({});
  const [confirmFeedback, setConfirmFeedback] = useState(false);
  const [adminPin, setAdminPin] = useState('0000');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [view, setView] = useState<View>('order');

  const reset = useCallback(() => {
    setOrder({});
    setChecked({});
    setGiven({});
    setScreen('select');
  }, []);

  const {
    prices, isHH, onlineUsers, connectedDevices, recentlyActiveDevices, identity,
    setPrices, setIsHH,
    sendOrQueuePricesUpdate, sendOrQueueHappyHourUpdate, handleRenameTerminal,
  } = useRealtimeState({
    products,
    isOnline,
    lastSyncAt,
    onHappyHourChanged: reset,
  });

  const { lines, bonusShooters, total } = useOrderBuilder({ products, order, isHH, prices });

  const buildVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
  const pwaEnabled =
    import.meta.env.VITE_ENABLE_PWA === undefined
      ? import.meta.env.PROD
      : import.meta.env.VITE_ENABLE_PWA === 'true';

  useEffect(() => {
    const handleUpdateAvailable = () => setUpdateAvailable(true);
    window.addEventListener('combar:pwa-update-ready', handleUpdateAvailable as EventListener);
    return () => {
      window.removeEventListener('combar:pwa-update-ready', handleUpdateAvailable as EventListener);
    };
  }, []);

  const handleApplyUpdate = useCallback(() => {
    const apply = (window as Window & { __combarApplyUpdate?: (() => void) | null }).__combarApplyUpdate;
    if (!apply) return;
    apply();
    setUpdateAvailable(false);
  }, []);

  useEffect(() => {
    getSetting<string>('adminPin').then(pin => {
      if (pin) setAdminPin(pin);
    });
  }, []);

  const add = (id: string) => setOrder(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const remove = (id: string) => setOrder(p => {
    const n = { ...p };
    if ((n[id] || 0) > 1) n[id]--;
    else delete n[id];
    return n;
  });

  const toggleHH = () => {
    const nextHappyHour = !isHH;
    setIsHH(nextHappyHour);
    void sendOrQueueHappyHourUpdate(nextHappyHour);
    reset();
  };

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
      setPrices(prev => {
        const updated = { ...prev, [`${id}_${type}`]: num };
        void sendOrQueuePricesUpdate(updated);
        return updated;
      });
    }
  }, [sendOrQueuePricesUpdate, setPrices]);

  const resetPrices = useCallback(() => {
    const fresh = initPrices(products);
    setPrices(fresh);
    void sendOrQueuePricesUpdate(fresh);
  }, [products, sendOrQueuePricesUpdate, setPrices]);

  const handleOpenAdministration = useCallback(() => {
    const input = window.prompt('Entrez le PIN admin :');

    if (input === adminPin) {
      return true;
    }

    if (input !== null) {
      window.alert('PIN incorrect');
    }

    return false;
  }, [adminPin]);

  const handleSelectView = useCallback((nextView: View) => {
    setView(nextView);
    setScreen('select');
    setIsDrawerOpen(false);
  }, []);

  const handleConfirmPayment = useCallback(async () => {
    const totalGiven = DENOMINATIONS.reduce((s, m) => s + m.value * (given[m.id] || 0), 0);
    const change = Math.max(0, Math.round((totalGiven - total) * 100) / 100);

    const pendingOrder: PendingOrder = {
      id: crypto.randomUUID(),
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
      retries: 0,
    };

    await savePendingOrder(pendingOrder);

    if (navigator.onLine) {
      try {
        await submitOrder(pendingOrder);
        await markOrdersSynced([pendingOrder.id]);
      } catch {
        // Will sync later
      }
    }

    await refreshPending();

    setConfirmFeedback(true);
    setTimeout(() => {
      setConfirmFeedback(false);
      reset();
    }, 1500);
  }, [given, total, isHH, lines, refreshPending, reset]);

  if (confirmFeedback) {
    return (
      <div className={`app-shell${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-shell' : ''}`}>
        <div className={`app${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-app' : ''}`}>
          <div className="confirm-overlay">
            <div className="confirm-check">✓</div>
            <div className="confirm-text">Commande enregistrée</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-shell' : ''}`}>
      <SideDrawer
        isOpen={isDrawerOpen}
        activeView={view}
        onClose={() => setIsDrawerOpen(false)}
        onSelect={handleSelectView}
        onOpenAdministration={handleOpenAdministration}
      />
      <div className={`app${isHH ? ' hh' : ''}${viewportDebug ? ' viewport-debug-app' : ''}`}>
        <Header
          isHH={isHH}
          isOnline={isOnline}
          pendingCount={pendingCount}
          syncState={syncState}
          onlineUsers={onlineUsers}
          connectedDevices={connectedDevices}
          recentlyActiveDevices={recentlyActiveDevices}
          localDeviceName={identity.deviceName}
          onRenameTerminal={handleRenameTerminal}
          onToggleHH={toggleHH}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onForceSync={forceSync}
          onApplyUpdate={handleApplyUpdate}
          buildVersion={buildVersion}
          buildTimestamp={buildTimestamp}
          pwaEnabled={pwaEnabled}
          updateAvailable={updateAvailable}
        />

        <main className={`app-content${viewportDebug ? ' viewport-debug-content' : ''}`} data-screen={screen}>
          {view === 'order' && (
            <>
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
            </>
          )}

          {view === 'prices' && (
            <PriceEditor
              products={products}
              prices={prices}
              isHH={isHH}
              onSetPrice={setPrice}
              onResetPrices={resetPrices}
              onGoBack={() => {
                setView('order');
                setScreen('select');
              }}
            />
          )}

          {view === 'sync' && (
            <PendingOrdersView
              syncState={syncState}
              pendingCount={pendingCount}
              onForceSync={forceSync}
              onGoBack={() => {
                setView('order');
                setScreen('select');
              }}
            />
          )}

          {view !== 'order' && view !== 'prices' && view !== 'sync' && (
            <div className="placeholder-view">
              <div className="placeholder-title">Écran à venir</div>
              <div className="placeholder-text">Cette section sera disponible prochainement.</div>
              <button
                type="button"
                className="placeholder-back-btn"
                onClick={() => {
                  setView('order');
                  setScreen('select');
                }}
              >
                Retour à la commande
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
