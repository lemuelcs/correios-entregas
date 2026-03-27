import { Response } from 'express';

class SseManager {
  private clients: Map<string, Response[]> = new Map();

  addClient(unidadeId: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial comment as keep-alive
    res.write(':connected\n\n');

    // Add to map
    const existing = this.clients.get(unidadeId) ?? [];
    existing.push(res);
    this.clients.set(unidadeId, existing);

    // On close, remove
    res.on('close', () => this.removeClient(unidadeId, res));
  }

  removeClient(unidadeId: string, res: Response): void {
    const existing = this.clients.get(unidadeId);
    if (!existing) return;

    const filtered = existing.filter((c) => c !== res);
    if (filtered.length === 0) {
      this.clients.delete(unidadeId);
    } else {
      this.clients.set(unidadeId, filtered);
    }
  }

  broadcast(unidadeId: string, event: string, data: object): void {
    const clients = this.clients.get(unidadeId);
    if (!clients) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  }

  broadcastAll(event: string, data: object): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        client.write(payload);
      }
    }
  }

  getClientCount(): number {
    let count = 0;
    for (const clients of this.clients.values()) {
      count += clients.length;
    }
    return count;
  }
}

export const sseManager = new SseManager();
