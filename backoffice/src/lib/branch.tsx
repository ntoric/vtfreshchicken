import { createContext, useContext, useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, setBranchId } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Branch } from "@/types";

// BranchCtx exposes the branch resolved from the /b/:slug URL prefix.
export const BranchCtx = createContext<{ branch: Branch | null }>({ branch: null });
export const useBranch = () => useContext(BranchCtx);

/** URL prefix for the active branch scope ("" when unscoped). */
export function useBranchPrefix(): string {
  const { slug } = useParams();
  return slug ? `/b/${slug}` : "";
}

/**
 * BranchGuard wraps every /b/:slug route. It resolves the slug to a branch,
 * verifies the signed-in user may view it (branch-bound staff are locked to
 * their own branch), and sets the tc_branch_id localStorage key so all API
 * calls carry the X-Branch-Id scope header.
 */
export function BranchGuard() {
  const { slug } = useParams();
  const { tenant, user } = useAuth();
  const q = useQuery({
    queryKey: ["branches", tenant],
    queryFn: () => api.listBranches(tenant),
  });

  const branch = q.data?.items.find((b) => b.slug === slug) ?? null;
  const userBranch = user?.branch_id ? q.data?.items.find((b) => b.id === user.branch_id) : null;

  useEffect(() => {
    if (branch) setBranchId(branch.id);
    return () => setBranchId(null);
  }, [branch?.id]);

  if (q.isLoading) {
    return <div className="p-8 text-sm text-slate-400">Loading branch…</div>;
  }
  if (!branch) {
    return <Navigate to="/" replace />;
  }
  // Branch-bound users can only view their own branch.
  if (user?.branch_id && user.branch_id !== branch.id) {
    return <Navigate to={userBranch ? `/b/${userBranch.slug}` : "/"} replace />;
  }

  return (
    <BranchCtx.Provider value={{ branch }}>
      <Outlet />
    </BranchCtx.Provider>
  );
}
