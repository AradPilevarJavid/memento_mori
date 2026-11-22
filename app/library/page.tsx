import type { Metadata } from "next";

import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = {
  title: "Library",
};

export default function LibraryPage() {
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">The archive</p>
        <h1>Library</h1>
        <p className="page-copy">
          Quotations, paraphrases, historical notes, and original reflections. Every attributed
          entry names its source.
        </p>
      </header>

      <LibraryBrowser />
    </>
  );
}
