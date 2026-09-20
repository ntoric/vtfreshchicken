import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { Permission, RolePermission, UserRole } from "@/types";

const MANAGEABLE_ROLES: { role: UserRole; label: string; color: string }[] = [
  { role: "business_admin", label: "Business Admin", color: "bg-blue-100 text-blue-700" },
  { role: "staff", label: "Staff", color: "bg-slate-100 text-slate-600" },
  { role: "customer", label: "Customer", color: "bg-emerald-50 text-emerald-600" },
];

export function Permissions() {
  const { tenant, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [activeRole, setActiveRole] = useState<UserRole>("staff");

  const canManage = currentUser?.role === "superadmin" || currentUser?.role === "business_admin";

  const permsQ = useQuery({
    queryKey: ["permissions", tenant],
    queryFn: () => api.listPermissions(tenant),
  });
  const rolePermsQ = useQuery({
    queryKey: ["role-permissions", tenant],
    queryFn: () => api.listRolePermissions(tenant),
  });

  // Build a map: permission_id -> granted, for the active role
  const grantedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const rp of rolePermsQ.data?.items ?? []) {
      if (rp.role === activeRole) {
        map.set(rp.permission_id, rp.granted);
      }
    }
    return map;
  }, [rolePermsQ.data, activeRole]);

  // Group permissions by module
  const moduleGroups = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of permsQ.data?.items ?? []) {
      const arr = groups.get(p.module) ?? [];
      arr.push(p);
      groups.set(p.module, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permsQ.data]);

  const toggle = useMutation({
    mutationFn: ({ permId, granted }: { permId: string; granted: boolean }) =>
      api.togglePermission(tenant, activeRole, permId, granted),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions", tenant] }),
    onError: (e) => toast.error("Permission update failed", (e as Error).message),
  });

  const saveAll = useMutation({
    mutationFn: (permissionIds: string[]) => api.setRolePermissions(tenant, activeRole, permissionIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions", tenant] });
      toast.success("Permissions updated", "Role permissions have been saved.");
    },
    onError: (e) => toast.error("Update failed", (e as Error).message),
  });

  const seed = useMutation({
    mutationFn: () => api.seedDefaultPermissions(tenant),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions", tenant] });
      toast.success("Permissions reset", "Default permissions have been restored.");
    },
    onError: (e) => toast.error("Reset failed", (e as Error).message),
  });

  // Count granted for each role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { business_admin: 0, staff: 0, customer: 0 };
    for (const rp of rolePermsQ.data?.items ?? []) {
      if (rp.granted) counts[rp.role] = (counts[rp.role] ?? 0) + 1;
    }
    return counts;
  }, [rolePermsQ.data]);

  const totalPerms = permsQ.data?.items.length ?? 0;

  function handleToggle(permId: string, currentlyGranted: boolean, permCode: string) {
    confirmDlg.open({
      message: currentlyGranted
        ? `Revoke permission "${permCode}" from ${activeRole} role?`
        : `Grant permission "${permCode}" to ${activeRole} role?`,
      variant: currentlyGranted ? "warning" : "info",
      confirmLabel: currentlyGranted ? "Revoke" : "Grant",
      onConfirm: () => toggle.mutate({ permId, granted: !currentlyGranted }),
    });
  }

  function handleSelectAll() {
    const allIds = (permsQ.data?.items ?? []).map((p) => p.id);
    saveAll.mutate(allIds);
  }

  function handleClearAll() {
    confirmDlg.open({
      message: `Remove ALL permissions from ${activeRole} role? This will revoke every permission for this role.`,
      variant: "danger",
      confirmLabel: "Clear All",
      onConfirm: () => saveAll.mutate([]),
    });
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Permissions" />
        <div className="bg-white rounded-2xl border p-8 text-center text-slate-500">
          Only business admins and superadmins can manage permissions.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Role Permissions"
        subtitle={`${totalPerms} permissions across ${moduleGroups.length} modules`}
        action={
          <button
            onClick={() => confirmDlg.open({
              message: "Reset all permissions to their default values? This will overwrite any custom permission assignments.",
              variant: "warning",
              confirmLabel: "Reset to Defaults",
              onConfirm: () => seed.mutate(),
            })}
            disabled={seed.isPending}
            className="border px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {seed.isPending ? "Seeding…" : "Reset to Defaults"}
          </button>
        }
      />

      {/* Role selector tabs */}
      <div className="flex gap-2 mb-6">
        {MANAGEABLE_ROLES.map((r) => (
          <button
            key={r.role}
            onClick={() => setActiveRole(r.role)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              activeRole === r.role
                ? "bg-brand text-white"
                : "bg-white border text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.label}
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${activeRole === r.role ? "bg-white/20" : r.color}`}>
              {roleCounts[r.role] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2 mb-4">
        <button onClick={handleSelectAll} className="text-xs text-brand hover:underline">Select All</button>
        <span className="text-slate-300">|</span>
        <button onClick={handleClearAll} className="text-xs text-rose-500 hover:underline">Clear All</button>
      </div>

      {permsQ.isLoading || rolePermsQ.isLoading ? (
        <TableSkeleton cols={4} rows={6} />
      ) : (
        <div className="space-y-6">
          {moduleGroups.map(([module, perms]) => (
            <div key={module} className="bg-white rounded-2xl border overflow-x-auto">
              <div className="bg-slate-50 px-4 py-2.5 border-b">
                <h3 className="font-semibold text-slate-700 capitalize">{module}</h3>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {perms.map((p) => {
                    const granted = grantedMap.get(p.id) ?? false;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{p.code}</div>
                          <div className="text-xs text-slate-400">{p.description}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggle(p.id, granted, p.code)}
                            disabled={toggle.isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
                              granted ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                granted ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
