import { AppShell } from "@/components/app-shell";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/**
 * The single application page. A thin server component that reads the document
 * limit from config and hands off to the interactive {@link AppShell}.
 */
export default function Home() {
  return <AppShell maxDocuments={config.maxDocuments} />;
}
