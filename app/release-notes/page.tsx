import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

type ReleaseNotes = { title: string; summary: string };

export default async function ReleaseNotesPage() {
  const documentPath = join(process.cwd(), "content", "release-notes.json");
  const notes: ReleaseNotes = JSON.parse(await readFile(documentPath, "utf8"));

  return (
    <main>
      <h1>{notes.title}</h1>
      <p>{notes.summary}</p>
    </main>
  );
}
