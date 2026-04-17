import { PresenceDevice } from '../types';

interface OnlineDevicesProps {
  devices: PresenceDevice[];
}

export default function OnlineDevices({ devices }: OnlineDevicesProps) {
  if (devices.length === 0) {
    return <div className="connected-devices-fallback">Aucun terminal connecté</div>;
  }

  return (
    <ul className="connected-devices-list" aria-label="Terminaux en ligne">
      {devices.map((device, index) => (
        <li className="connected-device-row" key={device.deviceId}>
          <span className="connected-device-main">
            <span className="connected-device-name">En ligne {index + 1}</span>
            <span className="connected-device-status">{device.deviceName || 'Terminal'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
