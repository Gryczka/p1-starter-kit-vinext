import type { ReactNode } from "react";

export default function ReleaseNotesLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
