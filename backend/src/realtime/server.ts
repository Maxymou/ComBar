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

  broadcastState<T>(state: T): void {
    this.broadcast({ type: 'STATE_UPDATE', payload: state });
    // Backward compatibility for older frontends still listening to "state"
    for (const client of this.clients) {
      writeSse(client, 'state', state);
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
