import type { Metadata } from "next";

import { SettingsView } from "@/components/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Boundaries</p>
        <h1>Settings</h1>
        <p className="page-copy">
          Notification permission is requested only when you choose. Preferences and history remain
          local by default.
        </p>
      </header>

      <SettingsView />
    </>
  );
}
