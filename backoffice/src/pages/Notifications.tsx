import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

// The pre-built ClassicEditor (v44) bundles an older ckeditor5 than the
// @ckeditor/ckeditor5-react v11 wrapper expects (>=46). The runtime API is
// compatible, so we cast to satisfy the stricter type contract.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ClassicEditorCompat = ClassicEditor as any;

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import type {
  NotificationEvent,
  NotificationTemplate,
  NotificationTemplateParameter,
  NotificationPreviewResult,
  NotificationLog,
} from "@/types";

type Tab = "templates" | "events" | "logs";

const MEDIUMS = ["email", "sms", "push"] as const;
const RECIPIENT_TYPES = [
  { value: "customer", label: "Customer" },
  { value: "staff", label: "Staff" },
  { value: "business_admin", label: "Business Admin" },
  { value: "all_staff", label: "All Staff" },
  { value: "all_customers", label: "All Customers" },
  { value: "specific_emails", label: "Specific Emails" },
] as const;

const inp = "w-full border rounded-lg px-3 py-2 text-sm";

// ---------------- Event form ----------------

interface EventForm {
  code: string;
  name: string;
  description: string;
  is_instant: boolean;
  is_active: boolean;
}

const emptyEventForm: EventForm = {
  code: "",
  name: "",
  description: "",
  is_instant: true,
  is_active: true,
};

// ---------------- Template form ----------------

interface TemplateForm {
  event_id: string;
  name: string;
  medium: string;
  subject: string;
  body_html: string;
  body_text: string;
  parameters: NotificationTemplateParameter[];
  recipient_type: string;
  is_active: boolean;
  recipients: { name: string; email: string; phone: string }[];
}

const emptyTemplateForm: TemplateForm = {
  event_id: "",
  name: "",
  medium: "email",
  subject: "",
  body_html: "",
  body_text: "",
  parameters: [],
  recipient_type: "customer",
  is_active: true,
  recipients: [],
};

export function Notifications() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("templates");

  return (
    <div>
      <PageHeader title="Notifications" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(["templates", "events", "logs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition ${
              tab === t
                ? "border-brand text-brand"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "templates" && <TemplatesTab tenant={tenant} qc={qc} confirmDlg={confirmDlg} toast={toast} />}
      {tab === "events" && <EventsTab tenant={tenant} qc={qc} confirmDlg={confirmDlg} toast={toast} />}
      {tab === "logs" && <LogsTab tenant={tenant} />}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

// ============================================================
// Templates Tab
// ============================================================

interface TabProps {
  tenant: string;
  qc: ReturnType<typeof useQueryClient>;
  confirmDlg: ReturnType<typeof useConfirmState>;
  toast: ReturnType<typeof useToast>;
}

function TemplatesTab({ tenant, qc, confirmDlg, toast }: TabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);

  // Preview / send state
  const [previewParams, setPreviewParams] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<NotificationPreviewResult | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendParams, setSendParams] = useState<Record<string, string>>({});

  const eventsQ = useQuery({
    queryKey: ["notif-events", tenant],
    queryFn: () => api.listNotificationEvents(tenant),
  });
  const events = eventsQ.data?.items ?? [];

  const [page, setPage] = useState(0);
  const limit = 8;
  const templatesQ = useQuery({
    queryKey: ["notif-templates", tenant, page],
    queryFn: () => api.listNotificationTemplates(tenant, undefined, { limit, offset: page * limit }),
  });

  const rows = templatesQ.data?.items ?? [];
  const total = templatesQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const create = useMutation({
    mutationFn: () => api.createNotificationTemplate(tenant, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-templates", tenant] });
      toast.success("Template created", "Notification template has been saved.");
      resetForm();
    },
    onError: (e) => toast.error("Create failed", (e as Error).message),
  });

  const update = useMutation({
    mutationFn: () => api.updateNotificationTemplate(tenant, editingId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-templates", tenant] });
      toast.success("Template updated", "Notification template has been saved.");
      resetForm();
    },
    onError: (e) => toast.error("Update failed", (e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteNotificationTemplate(tenant, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-templates", tenant] });
      toast.success("Deleted", "Template has been deleted.");
    },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const previewMut = useMutation({
    mutationFn: () =>
      api.previewNotification(tenant, {
        template_id: editingId ?? undefined,
        subject: form.subject,
        body_html: form.body_html,
        body_text: form.body_text,
        parameters: previewParams,
      }),
    onSuccess: (r) => {
      setPreviewResult(r);
      toast.success("Preview rendered", "Template variables have been substituted.");
    },
    onError: (e) => toast.error("Preview failed", (e as Error).message),
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const to = sendTo
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return api.sendNotification(tenant, {
        template_id: editingId!,
        to,
        parameters: sendParams,
      });
    },
    onSuccess: (r) => {
      const sent = r.results.filter((x) => x.status === "sent").length;
      const failed = r.results.filter((x) => x.status === "failed").length;
      if (failed === 0) {
        toast.success("Sent", `${sent} notification(s) dispatched.`);
      } else {
        toast.warning("Partial send", `${sent} sent, ${failed} failed.`);
      }
      qc.invalidateQueries({ queryKey: ["notif-logs", tenant] });
    },
    onError: (e) => toast.error("Send failed", (e as Error).message),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyTemplateForm);
    setPreviewResult(null);
    setPreviewParams({});
    setSendTo("");
    setSendParams({});
  }

  function startCreate() {
    setEditingId(null);
    setShowForm(true);
    setForm({ ...emptyTemplateForm, event_id: events[0]?.id ?? "" });
    setPreviewResult(null);
    setPreviewParams({});
    setSendTo("");
    setSendParams({});
  }

  function startEdit(t: NotificationTemplate) {
    setEditingId(t.id);
    setShowForm(true);
    setForm({
      event_id: t.event_id,
      name: t.name,
      medium: t.medium,
      subject: t.subject,
      body_html: t.body_html,
      body_text: t.body_text,
      parameters: t.parameters ?? [],
      recipient_type: t.recipient_type,
      is_active: t.is_active,
      recipients: (t.recipients ?? []).map((r) => ({ name: r.name, email: r.email, phone: r.phone })),
    });
    setPreviewResult(null);
    setPreviewParams({});
    setSendTo("");
    setSendParams({});
  }

  // Build a set of available variable keys for the current form
  const varKeys = useMemo(() => form.parameters.map((p) => p.key), [form.parameters]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={startCreate}
          disabled={events.length === 0}
          className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
          title={events.length === 0 ? "Create an event first" : undefined}
        >
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">
              {editingId ? "Edit Template" : "New Template"}
            </h3>
            <button onClick={resetForm} className="text-sm text-neutral-500 hover:text-neutral-700">
              Cancel
            </button>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-700">Event</span>
              <select
                value={form.event_id}
                onChange={(e) => setForm({ ...form, event_id: e.target.value })}
                className={inp}
              >
                <option value="">— Select event —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-700">Template Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Order Confirmation Email"
                className={inp}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-700">Medium</span>
              <select
                value={form.medium}
                onChange={(e) => setForm({ ...form, medium: e.target.value })}
                className={inp}
              >
                {MEDIUMS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-700">Recipient Type</span>
              <select
                value={form.recipient_type}
                onChange={(e) => setForm({ ...form, recipient_type: e.target.value })}
                className={inp}
              >
                {RECIPIENT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end pb-2">
              <Toggle
                checked={form.is_active}
                onChange={(v) => setForm({ ...form, is_active: v })}
                label="Active"
              />
            </div>
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-neutral-700">Subject</span>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Email subject — use {{variables}}"
              className={inp}
            />
          </label>

          {/* CKEditor for HTML body */}
          <div className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">Body (HTML)</span>
            <p className="text-xs text-neutral-400">
              Use <code className="bg-neutral-100 px-1 rounded">{"{{variable}}"}</code> placeholders for templating.
              Available: {varKeys.length > 0 ? varKeys.map((k) => `{{${k}}}`).join(", ") : "none — add parameters below"}
            </p>
            <div className="border rounded-lg overflow-hidden">
              <CKEditor
                editor={ClassicEditorCompat}
                data={form.body_html}
                config={{
                  toolbar: [
                    "heading", "|", "bold", "italic", "link", "bulletedList", "numberedList",
                    "|", "blockQuote", "insertTable", "|", "undo", "redo",
                  ],
                }}
                onChange={(_event, editor) => {
                  setForm((f) => ({ ...f, body_html: editor.getData() }));
                }}
              />
            </div>
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-medium text-neutral-700">Body (Plain Text)</span>
            <textarea
              value={form.body_text}
              onChange={(e) => setForm({ ...form, body_text: e.target.value })}
              placeholder="Plain text fallback (for SMS or text-only clients)"
              rows={3}
              className={inp}
            />
          </label>

          {/* Parameters editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Template Parameters</span>
              <button
                onClick={() =>
                  setForm({
                    ...form,
                    parameters: [...form.parameters, { key: "", label: "", required: false }],
                  })
                }
                className="text-xs text-brand font-medium hover:underline"
              >
                + Add parameter
              </button>
            </div>
            {form.parameters.length === 0 && (
              <p className="text-xs text-neutral-400">
                No parameters. Add variables that can be substituted in the subject and body.
              </p>
            )}
            {form.parameters.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={p.key}
                  onChange={(e) => updateParam(form, setForm, i, { key: e.target.value })}
                  placeholder="key (e.g. customer_name)"
                  className={`${inp} col-span-4`}
                />
                <input
                  value={p.label}
                  onChange={(e) => updateParam(form, setForm, i, { label: e.target.value })}
                  placeholder="Label"
                  className={`${inp} col-span-4`}
                />
                <span className="col-span-3 flex items-center gap-2 text-xs text-neutral-600">
                  <Toggle
                    size="sm"
                    checked={p.required}
                    onChange={(v) => updateParam(form, setForm, i, { required: v })}
                  />
                  Required
                </span>
                <button
                  onClick={() => setForm({ ...form, parameters: form.parameters.filter((_, idx) => idx !== i) })}
                  className="col-span-1 text-rose-500 hover:text-rose-700 text-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Specific recipients */}
          {form.recipient_type === "specific_emails" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Specific Recipients</span>
                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      recipients: [...form.recipients, { name: "", email: "", phone: "" }],
                    })
                  }
                  className="text-xs text-brand font-medium hover:underline"
                >
                  + Add recipient
                </button>
              </div>
              {form.recipients.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={r.name}
                    onChange={(e) => updateRecipient(form, setForm, i, { name: e.target.value })}
                    placeholder="Name"
                    className={`${inp} col-span-3`}
                  />
                  <input
                    value={r.email}
                    onChange={(e) => updateRecipient(form, setForm, i, { email: e.target.value })}
                    placeholder="Email"
                    className={`${inp} col-span-5`}
                  />
                  <input
                    value={r.phone}
                    onChange={(e) => updateRecipient(form, setForm, i, { phone: e.target.value })}
                    placeholder="Phone"
                    className={`${inp} col-span-3`}
                  />
                  <button
                    onClick={() => setForm({ ...form, recipients: form.recipients.filter((_, idx) => idx !== i) })}
                    className="col-span-1 text-rose-500 hover:text-rose-700 text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              onClick={() => (editingId ? update.mutate() : create.mutate())}
              disabled={!form.name || !form.event_id || create.isPending || update.isPending}
              className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {(editingId ? update.isPending : create.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? (update.isPending ? "Saving…" : "Save Template") : (create.isPending ? "Creating…" : "Create Template")}
            </button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">
              Cancel
            </button>
          </div>

          {/* Preview + Send (only when editing an existing template) */}
          {editingId && (
            <div className="border-t pt-5 space-y-4">
              <h4 className="font-semibold text-neutral-900 text-sm">Preview & Send</h4>

              {/* Preview params */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-neutral-700">Preview Parameters</span>
                {varKeys.length === 0 && (
                  <p className="text-xs text-neutral-400">No template parameters defined.</p>
                )}
                {varKeys.map((k) => (
                  <div key={k} className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-xs font-mono text-neutral-600">{`{{${k}}}`}</label>
                    <input
                      value={previewParams[k] ?? ""}
                      onChange={(e) => setPreviewParams({ ...previewParams, [k]: e.target.value })}
                      placeholder={`value for ${k}`}
                      className={`${inp} col-span-2`}
                    />
                  </div>
                ))}
                <button
                  onClick={() => previewMut.mutate()}
                  disabled={previewMut.isPending}
                  className="inline-flex items-center gap-1.5 text-sm bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-md hover:bg-neutral-200 disabled:opacity-50"
                >
                  {previewMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {previewMut.isPending ? "Rendering…" : "Render Preview"}
                </button>
              </div>

              {previewResult && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-700">Preview Output</p>
                  <div className="bg-neutral-50 border rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Subject</p>
                    <p className="text-sm font-medium text-neutral-900 mb-2">{previewResult.subject}</p>
                    <p className="text-xs text-neutral-500 mb-1">HTML Body</p>
                    <div
                      className="prose prose-sm max-w-none bg-white border rounded p-3"
                      dangerouslySetInnerHTML={{ __html: previewResult.body_html }}
                    />
                    {previewResult.body_text && (
                      <>
                        <p className="text-xs text-neutral-500 mt-2 mb-1">Plain Text</p>
                        <pre className="text-xs text-neutral-700 whitespace-pre-wrap bg-white border rounded p-3">
                          {previewResult.body_text}
                        </pre>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Send */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-neutral-700">Send Test Notification</span>
                <input
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="comma-separated email addresses"
                  className={inp}
                />
                {varKeys.map((k) => (
                  <div key={k} className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-xs font-mono text-neutral-600">{`{{${k}}}`}</label>
                    <input
                      value={sendParams[k] ?? ""}
                      onChange={(e) => setSendParams({ ...sendParams, [k]: e.target.value })}
                      placeholder={`value for ${k}`}
                      className={`${inp} col-span-2`}
                    />
                  </div>
                ))}
                <button
                  onClick={() => sendMut.mutate()}
                  disabled={!sendTo || sendMut.isPending}
                  className="inline-flex items-center gap-1.5 text-sm bg-brand text-white px-2.5 py-1 rounded-md hover:bg-brand-dark disabled:opacity-50"
                >
                  {sendMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {sendMut.isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates list */}
      {templatesQ.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Medium</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{t.name}</p>
                    <p className="text-xs text-neutral-400">{t.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {t.event_name ?? <span className="text-neutral-400">—</span>}
                    {t.event_code && (
                      <span className="block text-xs text-neutral-400 font-mono">{t.event_code}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 capitalize">
                      {t.medium}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 capitalize">
                    {t.recipient_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(t) },
                        {
                          label: "Delete",
                          variant: "danger",
                          onClick: () =>
                            confirmDlg.open({
                              message: `Delete template "${t.name}"?`,
                              variant: "danger",
                              confirmLabel: "Delete",
                              onConfirm: () => del.mutate(t.id),
                            }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {templatesQ.data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                    No notification templates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            start={page * limit}
            end={Math.min((page + 1) * limit, total)}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}

function updateParam(
  form: TemplateForm,
  setForm: React.Dispatch<React.SetStateAction<TemplateForm>>,
  i: number,
  patch: Partial<NotificationTemplateParameter>,
) {
  setForm({
    ...form,
    parameters: form.parameters.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
  });
}

function updateRecipient(
  form: TemplateForm,
  setForm: React.Dispatch<React.SetStateAction<TemplateForm>>,
  i: number,
  patch: Partial<{ name: string; email: string; phone: string }>,
) {
  setForm({
    ...form,
    recipients: form.recipients.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
  });
}

// ============================================================
// Events Tab
// ============================================================

function EventsTab({ tenant, qc, confirmDlg, toast }: TabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyEventForm);

  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({
    queryKey: ["notif-events", tenant, page],
    queryFn: () => api.listNotificationEvents(tenant, { limit, offset: page * limit }),
  });
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const create = useMutation({
    mutationFn: () => api.createNotificationEvent(tenant, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-events", tenant] });
      toast.success("Event created", "Notification event has been saved.");
      resetForm();
    },
    onError: (e) => toast.error("Create failed", (e as Error).message),
  });

  const update = useMutation({
    mutationFn: () => api.updateNotificationEvent(tenant, editingId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-events", tenant] });
      toast.success("Event updated", "Notification event has been saved.");
      resetForm();
    },
    onError: (e) => toast.error("Update failed", (e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteNotificationEvent(tenant, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-events", tenant] });
      toast.success("Deleted", "Event has been deleted.");
    },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyEventForm);
  }

  function startCreate() {
    setEditingId(null);
    setShowForm(true);
    setForm(emptyEventForm);
  }

  function startEdit(e: NotificationEvent) {
    setEditingId(e.id);
    setShowForm(true);
    setForm({
      code: e.code,
      name: e.name,
      description: e.description,
      is_instant: e.is_instant,
      is_active: e.is_active,
    });
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={startCreate}
          className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
        >
          + New Event
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-neutral-900">{editingId ? "Edit Event" : "New Event"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              placeholder="Code (e.g. order_placed)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
              className={inp}
            />
            <input
              placeholder="Name (e.g. Order Placed)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inp}
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className={inp}
          />
          <div className="flex items-center gap-6">
            <Toggle
              checked={form.is_instant}
              onChange={(v) => setForm({ ...form, is_instant: v })}
              label="Instant delivery"
              description="Send immediately when triggered vs. scheduled digest"
            />
            <Toggle
              checked={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
              label="Active"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => (editingId ? update.mutate() : create.mutate())}
              disabled={!form.code || !form.name || create.isPending || update.isPending}
              className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {(editingId ? update.isPending : create.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? (update.isPending ? "Saving…" : "Save") : (create.isPending ? "Creating…" : "Create")}
            </button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={5} rows={5} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-brand">{e.code}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{e.name}</td>
                  <td className="px-4 py-3 text-neutral-500 max-w-xs truncate">{e.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.is_instant ? "bg-sky-100 text-sky-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {e.is_instant ? "Instant" : "Digest"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {e.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(e) },
                        {
                          label: "Delete",
                          variant: "danger",
                          onClick: () =>
                            confirmDlg.open({
                              message: `Delete event "${e.name}"? Templates using this event may break.`,
                              variant: "danger",
                              confirmLabel: "Delete",
                              onConfirm: () => del.mutate(e.id),
                            }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {q.data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                    No notification events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            start={page * limit}
            end={Math.min((page + 1) * limit, total)}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Logs Tab
// ============================================================

function LogsTab({ tenant }: { tenant: string }) {
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const q = useQuery({
    queryKey: ["notif-logs", tenant, offset],
    queryFn: () => api.listNotificationLogs(tenant, limit, offset),
  });
  const logs = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  return (
    <div>
      {q.isLoading ? (
        <TableSkeleton cols={6} rows={8} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Medium</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((l: NotificationLog) => (
                <tr key={l.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 capitalize">{l.medium}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{l.recipient}</td>
                  <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{l.subject || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        l.status === "sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : l.status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-rose-500 max-w-xs truncate">{l.error || "—"}</td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                    No notification logs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-neutral-500">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1 border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1 border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
