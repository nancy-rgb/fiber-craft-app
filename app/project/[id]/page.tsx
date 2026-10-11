import { ProjectWorkingView } from "@/components/ProjectWorkingView";
import { OFFLINE_SHELL_ID } from "@/lib/offlineShell";

export function generateStaticParams() {
  return [{ id: OFFLINE_SHELL_ID }];
}

export default function ProjectPage() {
  return <ProjectWorkingView />;
}
