import 'fake-indexeddb/auto';
import { resetDbForTests } from './db';

/** Fresh, empty IndexedDB for each test. */
export async function freshDb() {
  await resetDbForTests();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('simple-sequencer');
    r.onsuccess = () => res();
    r.onerror = () => res();
    r.onblocked = () => res();
  });
}
