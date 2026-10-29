import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Eye, CheckCircle2, Trash2, Mail, MailOpen, Inbox, Phone, Mail as MailIcon, Reply } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { ActionMenu } from "@/components/ActionMenu";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { ContactSubmission } from "@/types";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

const LIMIT = 20;

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ContactSubmissions() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ContactSubmission | null>(null);

  const q = useQuery({
    queryKey: ["contact-submissions", tenant, statusFilter, page],
    queryFn: () =>
      api.listContactSubmissions(tenant, {
        status: statusFilter || undefined,
        limit: LIMIT,
        offset: page * LIMIT,
      }),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.markContactSubmissionRead(tenant, id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["contact-submissions", tenant] });
      setSelected((cur) => (cur && cur.id === id ? { ...cur, is_read: true } : cur));
    },
    onError: (e: Error) => toast.error("Update failed", e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteContactSubmission(tenant, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-submissions", tenant] });
      setSelected(null);
      toast.success("Submission deleted");
    },
    onError: (e: Error) => toast.error("Delete failed", e.message),
  });

  const confirmDelete = (s: ContactSubmission) =>
    confirmDlg.open({
      title: "Delete submission?",
      message: (
        <>
          Permanently delete the message from <b>{s.name || s.email}</b>? This cannot be undone.
        </>
      ),
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: () => delMut.mutate(s.id),
    });

  const openDetail = (s: ContactSubmission) => {
    setSelected(s);
    if (!s.is_read) markReadMut.mutate(s.id);
  };

  const actionItems = (s: ContactSubmission) => [
    { label: "View Message", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => openDetail(s) },
    ...(s.is_read
      ? []
      : [
          {
            label: "Mark as Read",
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            onClick: () => markReadMut.mutate(s.id),
          },
        ]),
    {
      label: "Delete",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      variant: "danger" as const,
      onClick: () => confirmDelete(s),
    },
  ];

  return (
    <div>
      <PageHeader title="Contact Submissions" subtitle="Messages sent through the storefront contact form" />

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(0);
              }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium whitespace-nowrap transition ${
                active ? "bg-brand text-white" : "bg-white border text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {q.isLoading ? (
        <TableSkeleton cols={5} rows={6} />
      ) : items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-neutral-50 transition cursor-pointer ${!s.is_read ? "bg-brand-light" : ""}`}
                  onClick={() => openDetail(s)}
                >
                  <td className="px-4 py-3">
                    <div className={`text-neutral-800 ${!s.is_read ? "font-semibold" : "font-medium"}`}>
                      {s.name || "—"}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">{s.email}</div>
                    {s.phone && <div className="text-xs text-neutral-400 mt-0.5">{s.phone}</div>}
                  </td>
                  <td className="px-4 py-3 max-w-[380px]">
                    {s.subject && (
                      <p className={`text-neutral-800 line-clamp-1 ${!s.is_read ? "font-semibold" : "font-medium"}`}>
                        {s.subject}
                      </p>
                    )}
                    <p className="text-neutral-500 text-xs mt-0.5 line-clamp-2">{s.message}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.is_read ? "bg-neutral-100 text-neutral-500" : "bg-brand-light text-brand"
                      }`}
                    >
                      {s.is_read ? <MailOpen className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      {s.is_read ? "Read" : "Unread"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu items={actionItems(s)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50">
              <p className="text-xs text-neutral-500">
                Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-white transition"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm text-neutral-500">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-white transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <Inbox className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-400 text-sm">
            {statusFilter ? `No ${statusFilter} submissions.` : "No contact form submissions yet."}
          </p>
        </div>
      )}

      {/* Message detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-bold text-neutral-800">
                  {selected.subject || "Contact message"}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">{fmtDateTime(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <p className="font-semibold text-neutral-900">{selected.name || "Anonymous"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MailIcon className="w-3.5 h-3.5 text-neutral-400" />
                    {selected.email}
                  </span>
                  {selected.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      {selected.phone}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap bg-neutral-50 rounded-xl p-4">
                {selected.message}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 p-5 border-t">
              <button
                onClick={() => confirmDelete(selected)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <a
                href={`mailto:${selected.email}?subject=${encodeURIComponent(
                  `Re: ${selected.subject || "Your message"}`
                )}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-brand hover:bg-brand-dark transition"
              >
                <Reply className="w-4 h-4" /> Reply by email
              </a>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
