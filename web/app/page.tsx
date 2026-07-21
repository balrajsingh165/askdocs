import { AppShell } from "@/components/app-shell";
import { MAX_DOCUMENTS } from "@/lib/shared/config";

/**
 * The single application page — hands off to the interactive {@link AppShell},
 * which talks to the FastAPI backend.
 */
export default function Home() {
  return <AppShell maxDocuments={MAX_DOCUMENTS} />;
}
