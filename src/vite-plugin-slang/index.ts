import fs from 'fs';
import { Plugin } from 'vite';
import init from "./slang/slang-wasm";

const VITE_PLUGIN_NAME = 'vite-plugin-slang';
const fileRegex = /\.slang$/;

function detectImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+([^"';]+);/g;
  let match: RegExpExecArray | null;
  while (match = importRegex.exec(code)) {
    imports.push(match[1]);
  }
  return imports;
}

async function loadModule(Slang: any, session: any, name: string, modules: any[], root: string): Promise<any[]> {
  let data: string;
  try{
    data = await fs.promises.readFile(`${root}/${name}.slang`, 'utf8');
  } catch (e) {
    throw new Error(`Could not resolve import: ${root}/${name}.slang`);
  }
  const imports = detectImports(data);
  for (const imp of imports) {
    modules = await loadModule(Slang, session, imp, modules, root);
  }
  const module = session.loadModuleFromSource(data, name, `/${name}.slang`);
  if (!module) {
    const err = Slang.getLastError();
    throw new Error(err.message);
  }
  modules.push(module);
  return modules;
}

export default function viteSlangPlugin(): Plugin {
  return {
    name: VITE_PLUGIN_NAME,
    enforce: 'pre',

    async load(id: string) {
      if (fileRegex.test(id)) {
        const name = id.split('/').pop()?.split('.').shift();
        if (!name) {
          throw new Error(`Invalid name for slang file: ${id}`);
        }
        const root = id.split('/').slice(0, -1).join('/');
        try {
          const Slang = await init();
          const globalSession = Slang.createGlobalSession();
          const session = globalSession.createSession(28);
          if (!session) {
            const err = Slang.getLastError();
            throw new Error(err.message);
          }
          let modules: any[] = [];
          modules = await loadModule(Slang, session, name, modules, root);
          const program = session.createCompositeComponentType(modules);
          if (!program) {
            const err = Slang.getLastError();
            throw new Error(err.message);
          }
          const linkedProgram = program.link()
          if (!linkedProgram) {
            const err = Slang.getLastError();
            throw new Error(err.message);
          }
          const code = linkedProgram.getTargetCode(0);
          if (!code) {
            const err = Slang.getLastError();
            throw new Error(err.message);
          }
          
          return `export default \`${code}\``;
        } catch (exception) {
          console.error(`${id}: error during slang compilation: `, exception);
        }
      }
    },
  };
};
