import { Navigate } from "react-router-dom";
import { useModules } from "@/lib/modules";

/**
 * Redirects to the dashboard when the given store module is disabled in
 * Developer → Modules & Features. Fail-open while the module list is loading.
 */
export function ModuleGate({ module, children }: { module: string; children: React.ReactNode }) {
  const { isEnabled } = useModules();
  if (!isEnabled(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
