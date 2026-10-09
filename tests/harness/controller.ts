export type SaveMode = 'resolve' | 'reject' | 'pending' | 'throw';
export type EditorProps = Record<string, unknown>;
export interface EditorInstance {
  $destroy(): void;
  $set(props: EditorProps): void;
}
export type EditorConstructor = new (options: { target: Element; props: EditorProps }) => EditorInstance;
interface HostRecord {
  component: EditorInstance;
  host: HTMLElement;
  blobs: Blob[];
  calls: number;
  submits: number;
  mode: SaveMode;
  pending: Array<{ resolve: () => void; reject: (reason: Error) => void }>;
}
export interface EditorHarness {
  mount(id?: string, props?: EditorProps): void;
  unmount(id?: string): void;
  setProps(id: string, props: EditorProps): void;
  setSaveMode(id: string, mode: SaveMode): void;
  settleSave(id: string, success?: boolean): void;
  saved(id?: string): Blob[];
  saveCalls(id?: string): number;
  submits(id?: string): number;
  clear(): void;
}
declare global {
  interface Window { editorHarness: EditorHarness; }
}

export function installHarness(Editor: EditorConstructor): void {
  const records = new Map<string, HostRecord>();
  const container = document.querySelector('#harness');
  if (!container) throw new Error('Missing library test host.');
  const get = (id: string): HostRecord => {
    const record = records.get(id);
    if (!record) throw new Error(`Unknown editor host: ${id}`);
    return record;
  };
  window.editorHarness = {
    mount(id = 'first', props = {}) {
      this.unmount(id);
      const host = document.createElement('section');
      host.dataset.editorHost = id;
      const heading = document.createElement('h2');
      heading.textContent = `Editor ${id}`;
      const form = document.createElement('form');
      form.setAttribute('aria-label', `Host form ${id}`);
      const label = document.createElement('label');
      label.textContent = `Host text ${id}`;
      const input = document.createElement('input');
      input.name = `host-text-${id}`;
      input.dataset.hostInput = id;
      label.append(input);
      const target = document.createElement('div');
      target.dataset.editorTarget = id;
      form.append(label, target);
      host.append(heading, form);
      container.append(host);
      const record: HostRecord = {
        component: undefined as unknown as EditorInstance,
        host, blobs: [], calls: 0, submits: 0, mode: 'resolve', pending: [],
      };
      records.set(id, record);
      form.addEventListener('submit', event => { event.preventDefault(); record.submits++; });
      record.component = new Editor({ target, props: {
        ...props,
        saveCallback(blob: Blob) {
          record.calls++;
          record.blobs.push(blob);
          if (record.mode === 'throw') throw new Error('Save failed in host.');
          if (record.mode === 'reject') return Promise.reject(new Error('Save failed in host.'));
          if (record.mode === 'pending') return new Promise<void>((resolve, reject) => record.pending.push({ resolve, reject }));
          return Promise.resolve();
        },
      } });
    },
    unmount(id = 'first') {
      const record = records.get(id);
      if (!record) return;
      record.component.$destroy();
      record.host.remove();
      for (const pending of record.pending.splice(0)) pending.resolve();
      records.delete(id);
    },
    setProps(id, props) { get(id).component.$set(props); },
    setSaveMode(id, mode) { get(id).mode = mode; },
    settleSave(id, success = true) {
      const pending = get(id).pending.shift();
      if (!pending) throw new Error('No pending save callback.');
      if (success) pending.resolve(); else pending.reject(new Error('Save failed in host.'));
    },
    saved(id = 'first') { return [...get(id).blobs]; },
    saveCalls(id = 'first') { return get(id).calls; },
    submits(id = 'first') { return get(id).submits; },
    clear() { for (const id of [...records.keys()]) this.unmount(id); },
  };
}
