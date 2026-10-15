import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
export const uncachedWorkspace = {
  cachedJsonRead: (_key: string[], read: () => Promise<Response>) => read(),
  invalidateWorkspace: () => {},
};

export function loadSource(path: string, mocks: Record<string, any> = {}, globals: Record<string, any> = {}) {
  const exports: Record<string, any> = {};
  const localRequire = createRequire(resolve(path));
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, console, URL, Request, Response, Buffer, process: { env: {} },
    require: (name: string) => {
      if (name in mocks) return mocks[name];
      if (name === '@/lib/workspace-cache') return uncachedWorkspace;
      if (name.startsWith('@/lib/')) return require(`../src/lib/${name.slice(6)}.ts`);
      return localRequire(name);
    },
    ...globals,
  });
  return exports;
}

export function isolatedCache() {
  const values = new Map<string, any>();
  const expirations: unknown[] = [];
  const workspace = loadSource('src/lib/workspace-cache.ts', { 'next/cache': {
    unstable_cache: (read: () => Promise<any>, keys: string[]) => async () => {
      const key = JSON.stringify(keys);
      if (!values.has(key)) values.set(key, JSON.parse(JSON.stringify(await read())));
      return values.get(key);
    },
    revalidateTag: (_tag: string, options: any) => { expirations.push(options); values.clear(); },
  } });
  return { workspace, values, expirations };
}

export function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
