import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DebugHealthResponse,
  DebugUpdateMode,
  DebugUpdateResponse,
  getDebugHealth,
  runDebugUpdate,
} from '../services/api';
import { SyncState } from '../hooks/useOnlineStatus';
import { PresenceDevice } from '../types';

interface DebugViewProps {
  isOnline: boolean;
  pendingCount: number;
  syncState: SyncState;
  onlineUsers: number;
  connectedDevices: PresenceDevice[];
  buildVersion: string;
  buildTimestamp: string;
  pwaEnabled: boolean;
  onForceSync: () => void;
  onGoBack: () => void;
}

function formatBoolean(value: boolean): string {
  return value ? 'Oui' : 'Non';
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${Math.round(value)} s`;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  if (navStandalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export default function DebugView({
  isOnline,
  pendingCount,
  syncState,
  onlineUsers,
  connectedDevices,
  buildVersion,
  buildTimestamp,
  pwaEnabled,
  onForceSync,
  onGoBack,
}: DebugViewProps) {
  const [health, setHealth] = useState<DebugHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const [updateResult, setUpdateResult] = useState<DebugUpdateResponse | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState<DebugUpdateMode | null>(null);

  const [copyMessage, setCopyMessage] = useState<string>('');

  const standalone = useMemo(() => detectStandalone(), []);
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const viewport =
    typeof window !== 'undefined'
      ? `${window.innerWidth} × ${window.innerHeight}`
      : '—';

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await getDebugHealth();
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setHealthError(err instanceof Error ? err.message : String(err));
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  const handleUpdate = useCallback(async (mode: DebugUpdateMode) => {
    if (updateLoading) return;
    const confirmMessage =
      mode === 'force-pwa'
        ? 'Lancer la mise à jour avec rebuild forcé de la PWA ? Cela va relancer les conteneurs.'
        : 'Lancer la mise à jour serveur ? Cela va relancer les conteneurs.';
    if (!window.confirm(confirmMessage)) return;

    setUpdateLoading(mode);
    setUpdateError(null);
    setUpdateResult(null);
    try {
      const result = await runDebugUpdate(mode);
      setUpdateResult(result);
      if (!result.ok) {
        setUpdateError(result.error || 'Une étape a échoué');
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdateLoading(null);
      void fetchHealth();
    }
  }, [updateLoading, fetchHealth]);

  const copyToClipboard = useCallback(async (label: string, value: unknown) => {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyMessage(`${label} copié`);
      setTimeout(() => setCopyMessage(''), 2000);
    } catch (err) {
      setCopyMessage(`Échec copie: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setCopyMessage(''), 3000);
    }
  }, []);

  const buildSnapshot = useMemo(
    () => ({
      buildVersion,
      buildTimestamp,
      pwaEnabled,
      isOnline,
      standalone,
      userAgent,
      viewport,
      pendingCount,
      syncState,
      onlineUsers,
      connectedDevices,
    }),
    [
      buildVersion,
      buildTimestamp,
      pwaEnabled,
      isOnline,
      standalone,
      userAgent,
      viewport,
      pendingCount,
      syncState,
      onlineUsers,
      connectedDevices,
    ],
  );

  return (
    <div className="debug-view">
      <div className="debug-header">
        <button type="button" className="placeholder-back-btn" onClick={onGoBack}>
          ← Retour
        </button>
        <div className="debug-title">Débug ComBar</div>
        <div className="debug-subtitle">Diagnostic et maintenance serveur</div>
      </div>

      {copyMessage && <div className="debug-toast">{copyMessage}</div>}

      <section className="debug-card">
        <div className="debug-card-title">Frontend</div>
        <ul className="debug-list">
          <li><span>Version build</span><strong>{buildVersion}</strong></li>
          <li><span>Timestamp build</span><strong>{buildTimestamp}</strong></li>
          <li><span>PWA</span><strong>{pwaEnabled ? 'ON' : 'OFF'}</strong></li>
          <li><span>Réseau navigateur</span><strong>{isOnline ? 'En ligne' : 'Hors ligne'}</strong></li>
          <li><span>Mode standalone</span><strong>{formatBoolean(standalone)}</strong></li>
          <li><span>Viewport</span><strong>{viewport}</strong></li>
          <li className="debug-list-multiline">
            <span>User-agent</span>
            <code>{userAgent}</code>
          </li>
        </ul>
        <div className="debug-actions">
          <button
            type="button"
            className="debug-btn"
            onClick={() => void copyToClipboard('Snapshot', buildSnapshot)}
          >
            📋 Copier snapshot
          </button>
        </div>
      </section>

      <section className="debug-card">
        <div className="debug-card-title">Backend</div>
        <div className="debug-actions">
          <button
            type="button"
            className="debug-btn"
            onClick={() => void fetchHealth()}
            disabled={healthLoading}
          >
            {healthLoading ? 'En cours…' : '🔄 Tester /health'}
          </button>
          {health && (
            <button
              type="button"
              className="debug-btn"
              onClick={() => void copyToClipboard('Santé', health)}
            >
              📋 Copier
            </button>
          )}
        </div>
        {healthError && (
          <div className="debug-error">Erreur : {healthError}</div>
        )}
        {health ? (
          <>
            <ul className="debug-list">
              <li><span>OK</span><strong>{formatBoolean(health.ok)}</strong></li>
              <li><span>Timestamp</span><strong>{health.timestamp}</strong></li>
              <li><span>Uptime</span><strong>{formatBytes(health.uptime)}</strong></li>
              <li><span>Node</span><strong>{health.nodeVersion}</strong></li>
              <li><span>Env</span><strong>{health.env}</strong></li>
              <li><span>cwd</span><strong>{health.cwd}</strong></li>
              <li><span>DB</span><strong>{health.db}</strong></li>
              {health.dbError && (
                <li className="debug-list-multiline"><span>DB erreur</span><code>{health.dbError}</code></li>
              )}
            </ul>
            <details className="debug-details">
              <summary>JSON brut</summary>
              <pre className="debug-pre">{JSON.stringify(health, null, 2)}</pre>
            </details>
            {health.dockerPs && (
              <details className="debug-details">
                <summary>docker compose ps</summary>
                <pre className="debug-pre">{health.dockerPs.stdout || health.dockerPs.stderr || health.dockerPs.error || '—'}</pre>
              </details>
            )}
          </>
        ) : (
          !healthError && <div className="debug-muted">Aucune réponse pour l’instant.</div>
        )}
      </section>

      <section className="debug-card">
        <div className="debug-card-title">Synchronisation</div>
        <ul className="debug-list">
          <li><span>État</span><strong>{syncState}</strong></li>
          <li><span>Commandes en attente</span><strong>{pendingCount}</strong></li>
        </ul>
        <div className="debug-actions">
          <button type="button" className="debug-btn" onClick={onForceSync} disabled={!isOnline}>
            🔁 Forcer synchro
          </button>
        </div>
      </section>

      <section className="debug-card">
        <div className="debug-card-title">Terminaux</div>
        <ul className="debug-list">
          <li><span>Connectés</span><strong>{onlineUsers}</strong></li>
        </ul>
        {connectedDevices.length > 0 ? (
          <ul className="debug-device-list">
            {connectedDevices.map(device => (
              <li key={device.deviceId} className="debug-device-row">
                <span className="debug-device-name">{device.deviceName || 'Terminal'}</span>
                <span className="debug-device-id">{device.deviceId.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="debug-muted">Aucun terminal connecté.</div>
        )}
      </section>

      <section className="debug-card">
        <div className="debug-card-title">Mise à jour serveur</div>
        <div className="debug-muted">
          Exécute des commandes Docker sur l’hôte. À utiliser avec précaution.
        </div>
        <div className="debug-actions">
          <button
            type="button"
            className="debug-btn primary"
            disabled={updateLoading !== null}
            onClick={() => void handleUpdate('normal')}
          >
            {updateLoading === 'normal' ? 'Mise à jour…' : '⬆️ Mettre à jour l’app'}
          </button>
          <button
            type="button"
            className="debug-btn warning"
            disabled={updateLoading !== null}
            onClick={() => void handleUpdate('force-pwa')}
          >
            {updateLoading === 'force-pwa' ? 'Mise à jour…' : '🚀 Mettre à jour + forcer PWA'}
          </button>
        </div>
        {updateLoading && (
          <div className="debug-muted">Exécution en cours, peut prendre plusieurs minutes…</div>
        )}
        {updateError && (
          <div className="debug-error">Erreur : {updateError}</div>
        )}
        {updateResult && (
          <>
            <ul className="debug-list">
              <li><span>OK</span><strong>{formatBoolean(updateResult.ok)}</strong></li>
              <li><span>Mode</span><strong>{updateResult.mode}</strong></li>
              <li><span>Démarré</span><strong>{updateResult.startedAt}</strong></li>
              <li><span>Terminé</span><strong>{updateResult.finishedAt}</strong></li>
              <li><span>Code sortie</span><strong>{String(updateResult.exitCode ?? '—')}</strong></li>
            </ul>
            <details className="debug-details" open>
              <summary>stdout</summary>
              <pre className="debug-pre">{updateResult.stdout || '—'}</pre>
            </details>
            {updateResult.stderr && (
              <details className="debug-details">
                <summary>stderr</summary>
                <pre className="debug-pre">{updateResult.stderr}</pre>
              </details>
            )}
            <div className="debug-actions">
              <button
                type="button"
                className="debug-btn"
                onClick={() => void copyToClipboard('Logs', updateResult)}
              >
                📋 Copier logs
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
