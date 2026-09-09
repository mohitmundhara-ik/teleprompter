/** Wire protocol shared by the main window and the teleprompter popout. */

export type Payload =
  | { t: 'nav'; index: number }
  | { t: 'meta'; title: string; pageCount: number; kind: string; pageTitles: string[] }
  | { t: 'script'; text: string; rev: number }
  | { t: 'note'; index: number; text: string; rev: number }
  | { t: 'display'; value: unknown }
  | { t: 'media'; action: 'play' | 'pause' | 'seek' | 'rate'; value?: number }
  | { t: 'toast'; text: string; tone: 'info' | 'error' | 'warn' }
  | { t: 'hello'; role: Role }
  | { t: 'state-request' }
  | { t: 'heartbeat'; role: Role }
  | { t: 'bye'; role: Role };

export type Role = 'main' | 'prompter';

export interface Envelope {
  id: string;
  src: string;
  role: Role;
  sid: string;
  ts: number;
  payload: Payload;
}

export interface Transport {
  post(e: Envelope): void;
  onMessage(cb: (e: Envelope) => void): void;
  close(): void;
}
