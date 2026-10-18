import type { Metadata } from "next";
import { ReportWizard } from "./report-wizard";

export const metadata: Metadata = {
  title: "Reportar un problema",
};

export default function ReportarPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6 md:py-6">
      <ReportWizard />
    </main>
  );
}
