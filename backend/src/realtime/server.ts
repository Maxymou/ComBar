import { Response } from 'express';

export interface RealtimeEnvelope<T = unknown> {
  type: 'STATE_UPDATE' | 'PRESENCE_UPDATE';
  payload: T;
}

function writeSse<T>(res: Response, event: string, data: T): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export class RealtimeServer {
  private clients = new Set<Response>();

  connect(response: Response): void {
    this.clients.add(response);
  }

  disconnect(response: Response): void {
    this.clients.delete(response);
  }

  broadcast<T>(envelope: RealtimeEnvelope<T>): void {
    for (const client of this.clients) {
      writeSse(client, envelope.type, envelope.payload);
    }
  }

  broadcastState(state: {
    prices?: Record<string, number>;
    happyHour?: boolean;
    version?: number;
    updatedAt?: string;
  }): void {
    // Send only the meaningful state fields. Presence is broadcast separately
    // via PRESENCE_UPDATE to avoid sending the full device list on every change.
    const delta = {
      prices: state.prices,
      happyHour: state.happyHour,
      version: state.version,
      updatedAt: state.updatedAt,
    };
    this.broadcast({ type: 'STATE_UPDATE', payload: delta });
    // Backward compatibility for older frontends still listening to "state"
    for (const client of this.clients) {
      writeSse(client, 'state', delta);
    }
  }

  broadcastPresence<T>(presence: T): void {
    this.broadcast({ type: 'PRESENCE_UPDATE', payload: presence });
    // Backward compatibility for older frontends still listening to "clients"
    const count = Array.isArray(presence) ? presence.length : 0;
    for (const client of this.clients) {
      writeSse(client, 'clients', count);
    }
  }

  sendInitialState<T>(response: Response, state: T): void {
    writeSse(response, 'STATE_UPDATE', state);
    writeSse(response, 'state', state);
  }
}
