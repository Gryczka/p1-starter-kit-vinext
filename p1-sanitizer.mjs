import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// jsdom reads its packaged user-agent CSS at module initialization. Bundle the
// installed file so the Worker can initialize the same DOMPurify implementation.
export default function p1Sanitizer() {
  return {
    name: "p1-jsdom-stylesheet",
    enforce: "pre",
    applyToEnvironment: environment => environment.name !== "client",
    async resolveId(source, importer, options) {
      if (source === "@tiptap/html") {
        return this.resolve("@tiptap/html/server", importer, { ...options, skipSelf: true });
      }
      if (source !== "isomorphic-dompurify") return;
      const entry = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (entry?.id.endsWith("/isomorphic-dompurify/dist/browser.mjs")) {
        return resolve(dirname(entry.id), "index.mjs");
      }
      return entry;
    },
    async transform(code, id) {
      if (id.endsWith("/@tiptap/html/dist/server/index.js")) {
        // Tiptap disables script execution and resource loading. Use happy-dom's
        // window for shared JS intrinsics to avoid creating a Node VM context.
        const windowImport = 'import { Window } from "happy-dom";';
        if (!code.includes(windowImport)) return;
        if (!code.includes("disableJavaScriptEvaluation: true")) this.error("Review Tiptap's DOM settings before bundling.");
        return { code: code.replace(windowImport, 'import { GlobalWindow as Window } from "happy-dom";'), map: null };
      }
      // css-tree ships these prepacked modules for environments without a
      // Node module loader. Its standard ESM modules require JSON at runtime.
      if (id.endsWith("/css-tree/lib/data.js")) return { code: "export { default } from '../dist/data.js';", map: null };
      if (id.endsWith("/css-tree/lib/version.js")) return { code: "export { version } from '../dist/version.js';", map: null };
      if (id.endsWith("/jsdom/lib/jsdom/living/xhr/XMLHttpRequest-impl.js")) {
        // The sanitizer uses a non-executing DOM and does not make synchronous
        // XHRs. Defer Node's background-thread lookup until an XHR needs it.
        const lookup = 'require.resolve("./xhr-sync-worker.js")';
        const eager = `const syncWorkerFile = ${lookup};`;
        if (!code.includes(eager)) return;
        if (!code.includes("new Worker(syncWorkerFile)")) this.error("Review jsdom's synchronous XHR worker path.");
        return { code: code.replace(eager, "").replace("new Worker(syncWorkerFile)", `new Worker(${lookup})`), map: null };
      }
      if (!id.endsWith("/jsdom/lib/jsdom/living/css/helpers/computed-style.js")) return;
      if (!code.includes("../../../browser/default-stylesheet.css")) return;
      const read = /fs\.readFileSync\(\s*path\.resolve\(__dirname, "\.\.\/\.\.\/\.\.\/browser\/default-stylesheet\.css"\),\s*\{ encoding: "utf-8" \}\s*\)/;
      if (!read.test(code)) this.error("Review the installed jsdom stylesheet reader before bundling for Workers.");
      const file = resolve(dirname(id), "../../../browser/default-stylesheet.css");
      this.addWatchFile(file);
      const css = await readFile(file, "utf8");
      return { code: code.replace(read, () => JSON.stringify(css)), map: null };
    },
  };
}
