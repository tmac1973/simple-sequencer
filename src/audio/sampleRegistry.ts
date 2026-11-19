/**
 * Resolves sample ids ("dev:kick", "lib:dusty-kick", "user:abc") to decoded AudioBuffers.
 * Resolvers are registered per prefix; decoded buffers are cached for the session.
 * AudioBuffers aren't tied to a context, so the same buffer works live and offline.
 */
export type SampleLoader = (id: string) => Promise<AudioBuffer>;

class SampleRegistryImpl {
  private resolvers = new Map<string, SampleLoader>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private loaded = new Map<string, AudioBuffer>();
  private listeners = new Set<(id: string) => void>();

  addResolver(prefix: string, loader: SampleLoader) {
    this.resolvers.set(prefix, loader);
  }

  register(id: string, buffer: AudioBuffer) {
    this.loaded.set(id, buffer);
    this.pending.set(id, Promise.resolve(buffer));
    this.listeners.forEach((l) => l(id));
  }

  has(id: string): boolean {
    return this.loaded.has(id);
  }

  /** Synchronous lookup for the scheduler: undefined until loaded. */
  getLoaded(id: string): AudioBuffer | undefined {
    return this.loaded.get(id);
  }

  get(id: string): Promise<AudioBuffer> {
    const existing = this.pending.get(id);
    if (existing) return existing;
    const prefix = id.slice(0, id.indexOf(':'));
    const loader = this.resolvers.get(prefix);
    if (!loader) return Promise.reject(new Error(`No sound source for "${id}"`));
    const p = loader(id).then((buf) => {
      this.loaded.set(id, buf);
      this.listeners.forEach((l) => l(id));
      return buf;
    });
    p.catch(() => this.pending.delete(id));
    this.pending.set(id, p);
    return p;
  }

  /** Load in the background, swallowing errors (callers that care use get()). */
  warm(id: string) {
    this.get(id).catch((e) => console.warn('[samples]', e));
  }

  onLoaded(fn: (id: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  forget(id: string) {
    this.loaded.delete(id);
    this.pending.delete(id);
  }
}

export const SampleRegistry = new SampleRegistryImpl();
