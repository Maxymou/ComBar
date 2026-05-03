import { FormEvent, useState } from 'react';
import { saveSetting } from '../services/db';

type AdminPasswordViewProps = {
  adminPin: string;
  onAdminPinChanged: (nextPin: string) => void;
  onGoBack: () => void;
};

export default function AdminPasswordView({
  adminPin,
  onAdminPinChanged,
  onGoBack,
}: AdminPasswordViewProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (currentPassword !== adminPin) {
      setError('Le mot de passe actuel est incorrect.');
      return;
    }

    if (!newPassword.trim()) {
      setError('Le nouveau mot de passe ne peut pas être vide.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    await saveSetting('adminPin', newPassword);
    onAdminPinChanged(newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess('Mot de passe admin mis à jour avec succès.');
  };

  return (
    <section className="admin-password-view" aria-label="Modifier le mot de passe admin">
      <div className="admin-password-card">
        <h2 className="admin-password-title">Modifier le MDP admin</h2>

        <form className="admin-password-form" onSubmit={handleSubmit}>
          <label className="admin-password-label" htmlFor="admin-current-password">Mot de passe actuel</label>
          <input
            id="admin-current-password"
            className="admin-password-input"
            type="password"
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />

          <label className="admin-password-label" htmlFor="admin-new-password">Nouveau mot de passe</label>
          <input
            id="admin-new-password"
            className="admin-password-input"
            type="password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />

          <label className="admin-password-label" htmlFor="admin-confirm-password">Confirmer le nouveau mot de passe</label>
          <input
            id="admin-confirm-password"
            className="admin-password-input"
            type="password"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />

          {error && <p className="admin-password-message error">{error}</p>}
          {success && <p className="admin-password-message success">{success}</p>}

          <div className="admin-password-actions">
            <button type="submit" className="admin-password-btn primary">Enregistrer</button>
            <button type="button" className="admin-password-btn secondary" onClick={onGoBack}>Retour</button>
          </div>
        </form>
      </div>
    </section>
  );
}
