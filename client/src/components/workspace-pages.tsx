import { CorrespondencePage } from "./correspondence-page";
import { ActionsPage } from "./actions-page";
import { ArchivePage } from "./archive-page";
import { ReportsPage } from "./reports-page";

export type WorkspacePageName =
  "correspondence" | "actions" | "archive" | "reports";

export function WorkspacePage({
  page,
  token,
}: {
  page: WorkspacePageName;
  token: string;
}) {
  if (page === "correspondence") return <CorrespondencePage token={token} />;
  if (page === "actions") return <ActionsPage token={token} />;
  if (page === "archive") return <ArchivePage token={token} />;
  return <ReportsPage token={token} />;
}
