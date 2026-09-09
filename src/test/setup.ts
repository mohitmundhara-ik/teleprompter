import 'fake-indexeddb/auto';

if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => Math.random().toString(36).slice(2) + Date.now().toString(36),
  });
}
