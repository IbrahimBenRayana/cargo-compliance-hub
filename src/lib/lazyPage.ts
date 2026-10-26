import { lazy, type ComponentType } from 'react';

const FLAG = 'mcl-chunk-reload';

/**
 * Load a page chunk. After a deploy, an open tab may ask for chunk files that
 * no longer exist; reload once to fetch the new build instead of crashing
 * (the flag stops a reload loop if the chunk is truly broken).
 */
export function loadWithReload<T>(load: () => Promise<T>, reload: () => void = () => window.location.reload()): Promise<T> {
  return load().then(
    (mod) => {
      try { sessionStorage.removeItem(FLAG); } catch { /* storage unavailable */ }
      return mod;
    },
    (err) => {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem(FLAG) === '1'; } catch { /* storage unavailable */ }
      if (reloaded) throw err;
      try { sessionStorage.setItem(FLAG, '1'); } catch { /* storage unavailable */ }
      reload();
      return new Promise<T>(() => {}); // the page is reloading
    },
  );
}

/** React.lazy for a page module's named (or default) export. */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() => loadWithReload(load).then((m) => ({ default: m[name] as ComponentType<any> })));
}
