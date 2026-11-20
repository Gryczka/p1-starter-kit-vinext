import { createServer } from "node:http";
import { once } from "node:events";
import { pathToFileURL } from "node:url";

// Synthetic published snapshots in the format consumed by P1ContentClient 0.28.
// P1WelcomeBlock is part of the generated app even without the optional block pack.
const siteId = "fixture-site";
const apiKey = "fixture-only-key";
const branch = { branchId: "main", branchName: "main", isMainBranch: true };
const timestamp = "2026-01-01T00:00:00Z";
const examplePages = new Map([
  ["/", "P1 fixture home"],
  ["/guides/workers", "P1 fixture nested page"],
]);

function documentPath(path) {
  return path.slice(1) || "/";
}

function documentId(path) {
  return path === "/" ? "fixture-home" : "fixture-workers";
}

function snapshot(path, heading) {
  const content = [{
    type: "P1WelcomeBlock",
    props: { id: documentId(path), heading, ctaLabel: "Open editor", ctaHref: "/p1", showLogo: false },
  }];
  if (path === "/guides/workers") {
    content.push(
      {
        type: "Heading",
        props: { id: "guide-heading", text: "Rendered from the P1 block library", level: "H2", align: "left" },
      },
      {
        type: "Accordion",
        props: {
          id: "guide-accordion", heading: "Guide details", align: "left",
          items: [
            { title: "Overview", body: "<p>The first item opens by default.</p>" },
            { title: "Runtime", body: "<p>The P1 accordion hydrated</p>" },
          ],
        },
      },
    );
  }
  return {
    ...branch,
    path: documentPath(path),
    documentId: documentId(path),
    versionNumber: 1,
    versionCreatedAt: timestamp,
    etag: documentId(path),
    data: {
      root: { props: { title: path === "/" ? "Fixture site" : "Workers guide" } },
      content,
      zones: {},
    },
  };
}

function serve(req, res, pages) {
  const { pathname, searchParams } = new URL(req.url, "http://localhost");
  function json(status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });
  if (req.headers["x-api-key"] !== apiKey) return json(401, { error: "Invalid fixture key" });
  const prefix = `/api/sites/${siteId}/`;
  if (!pathname.startsWith(prefix)) return json(404, { error: "Site not found" });
  if (searchParams.has("branch") && searchParams.get("branch") !== branch.branchId) {
    return json(404, { error: "Branch not found" });
  }

  const route = pathname.slice(prefix.length);
  if (route === "content" || route.startsWith("content/")) {
    const path = route.slice("content".length) || "/";
    const heading = pages.get(path);
    if (!heading) return json(404, { error: "Page not found" });
    return json(200, snapshot(path, heading));
  }
  if (route === "content-redirects/old-guide") {
    return json(200, { fromPath: "/old-guide", destination: "/guides/workers",
      redirectType: "permanent", parenting: false, statusCode: 308 });
  }
  if (route === "branches/main/queries") return json(200, { queries: [] });
  if (route === "branches/main/documents") {
    const documents = Array.from(pages.keys(), path => ({ id: documentId(path), path: documentPath(path) }));
    return json(200, { documents });
  }
  if (route === "content-pages") {
    const entries = Array.from(pages.keys(), path => ({
      path: documentPath(path), documentId: documentId(path), lastModifiedAt: timestamp,
    }));
    return json(200, { ...branch, pages: entries });
  }
  return json(404, { error: "Not found" });
}

export async function startFixture(port = 0, { empty = false } = {}) {
  const pages = empty ? new Map() : examplePages;
  const server = createServer((req, res) => serve(req, res, pages));
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    env: {
      NEXT_PUBLIC_CSS_BASE_URL: url,
      NEXT_PUBLIC_CSS_SITE_ID: siteId,
      NEXT_PUBLIC_CSS_BRANCH_ID: branch.branchId,
      CSS_API_KEY: apiKey,
    },
    close: () => new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startFixture(Number(process.argv[2] ?? 4179), { empty: process.argv.includes("--empty") });
  console.log(`P1 content fixture listening at ${url}`);
}
