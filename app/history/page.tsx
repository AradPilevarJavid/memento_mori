import type { Metadata } from "next";

import { HistoryView } from "@/components/HistoryView";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">What has arrived</p>
        <h1>History</h1>
        <p className="page-copy">
          Reflections delivered on this device. History is stored locally in your browser.
        </p>
      </header>

      <HistoryView />
    </>
  );
}
