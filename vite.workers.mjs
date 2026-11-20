import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import p1Sanitizer from "./p1-sanitizer.mjs";

export default defineConfig({
  plugins: [
    p1Sanitizer(),
    vinext({
      rscOutDir: ".p1-output/server",
      ssrOutDir: ".p1-output/server/ssr",
      clientOutDir: ".p1-output/client",
    }),
    {
      name: "p1-react-runtime",
      enforce: "post",
      config(config) {
        // P1's TypeScript aliases point React imports at declaration files.
        // Leave runtime selection (including react-server) to the resolver.
        const aliases = config.resolve?.alias;
        const isDeclaration = value => /\/node_modules\/@types\/react(?:-dom)?(?:\/|$)/.test(value);
        if (Array.isArray(aliases)) {
          config.resolve.alias = aliases.filter(entry => !isDeclaration(entry.replacement));
        } else if (aliases) {
          for (const [key, value] of Object.entries(aliases)) {
            if (isDeclaration(value)) delete aliases[key];
          }
        }
      },
    },
    {
      name: "p1-exclude-preview-secrets",
      enforce: "post",
      generateBundle: {
        order: "post",
        handler(_, bundle) {
          // The Cloudflare Vite plugin copies local bindings here for vite
          // preview. Runtime verification supplies its own explicit env file.
          if (this.environment.name === "rsc") delete bundle[".dev.vars"];
        },
      },
    },
    cloudflare({
      configPath: "./wrangler.p1.json",
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
