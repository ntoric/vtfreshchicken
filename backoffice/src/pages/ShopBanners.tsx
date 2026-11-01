import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, Copy, Eye, EyeOff, ImagePlus, Loader2, Phone, Leaf, Plus, RotateCcw, Save, Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageCropModal } from "@/components/ImageCropModal";
import type { ShopBanner, ShopBannerTheme } from "@/types";

// ── Preview palette — keep in sync with frontstore/src/components/ShopBannerCarousel.tsx ──
interface ThemePalette { bg: string; accent: string; badge: string; badgeText: string; ctaText: string; label: string }
const THEMES: Record<ShopBannerTheme, ThemePalette> = {
  crimson: { label: "Crimson", bg: "radial-gradient(120% 140% at 30% 40%, #c8261f 0%, #8f1015 48%, #4f0709 100%)", accent: "#ffd23f", badge: "#ffd23f", badgeText: "#5a0a0d", ctaText: "#5a0a0d" },
  plum: { label: "Plum", bg: "radial-gradient(120% 140% at 30% 40%, #6d2470 0%, #4a1450 50%, #250828 100%)", accent: "#f7a531", badge: "#f6e7d0", badgeText: "#4a1450", ctaText: "#2b0a2e" },
  forest: { label: "Forest", bg: "radial-gradient(120% 140% at 30% 40%, #2f6b42 0%, #1b4429 50%, #0c2415 100%)", accent: "#f4c95d", badge: "#f4c95d", badgeText: "#123020", ctaText: "#123020" },
  charcoal: { label: "Charcoal", bg: "radial-gradient(120% 140% at 30% 40%, #3a3a3a 0%, #222 50%, #0d0d0d 100%)", accent: "#ef3b33", badge: "#ef3b33", badgeText: "#ffffff", ctaText: "#ffffff" },
  saffron: { label: "Saffron", bg: "radial-gradient(120% 140% at 30% 40%, #f08a1c 0%, #c45f08 50%, #7a3504 100%)", accent: "#fff1c9", badge: "#7a1e0e", badgeText: "#fff1c9", ctaText: "#7a1e0e" },
};
const CREAM = "#f4e6d0";
const TORN = "polygon(9% 0, 100% 0, 100% 100%, 3% 100%, 6% 90%, 1% 80%, 5% 69%, 0 58%, 4% 47%, 1% 36%, 6% 25%, 2% 14%, 7% 6%)";
const TORN_PAPER = "polygon(6% 0, 100% 0, 100% 100%, 0 100%, 3% 91%, 0 81%, 2% 70%, 0 59%, 2% 48%, 0 37%, 3% 26%, 0 15%, 4% 6%)";
const HEX = "polygon(50% 0, 100% 16%, 100% 84%, 50% 100%, 0 84%, 0 16%)";
const SCRIPT_FONT = "'Great Vibes', cursive";
const HEAVY_FONT = "'Anton', Impact, sans-serif";

// Brand photos bundled with the frontstore (served at /brand/*).
const BRAND_IMAGES = [
  "/brand/range-fresh.jpg",
  "/brand/chicken-table.jpg",
  "/brand/range-frozen.jpg",
  "/brand/range-everyday.jpg",
];

const LIMITS: Partial<Record<keyof ShopBanner, number>> = {
  eyebrow: 40, title: 24, subtitle: 200, badge_value: 8, badge_label: 12,
  cta_text: 30, cta_link: 500, phone: 30, footer_note: 80,
};

function useBannerFonts() {
  useEffect(() => {
    const id = "shop-banner-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Anton&family=Great+Vibes&display=swap";
    document.head.appendChild(link);
  }, []);
}

function newBanner(): ShopBanner {
  return {
    id: "", enabled: true, theme: "crimson",
    eyebrow: "Delicious", title: "CHICKEN", subtitle: "Fresh cuts delivered chilled to your door.",
    badge_value: "10%", badge_label: "OFF", image_url: BRAND_IMAGES[0],
    cta_text: "Order now", cta_link: "/shop", phone: "", footer_note: "",
  };
}

// Client-side key for list rendering (server assigns real IDs for new banners).
type Draft = ShopBanner & { _key: string };
let keySeq = 0;
const withKey = (b: ShopBanner): Draft => ({ ...b, _key: `k${++keySeq}` });
const stripKey = ({ _key, ...b }: Draft): ShopBanner => b;

function BannerPreview({ banner, compact = false }: { banner: ShopBanner; compact?: boolean }) {
  const t = THEMES[banner.theme] ?? THEMES.crimson;
  const stack = banner.badge_label.length > 0 && banner.badge_label.length <= 5;
  const showBadge = !!(banner.badge_value || banner.badge_label);
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] select-none">
      <div className={`relative ${compact ? "min-h-[64px]" : "min-h-[240px] lg:min-h-[280px]"}`} style={{ background: t.bg }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)" }} />
        <div className="absolute top-0 right-0 h-full w-[52%]" style={{ background: CREAM, clipPath: "polygon(78% 0, 100% 0, 100% 34%)" }} />
        <div className="absolute inset-y-0 right-0 w-[42%]">
          <div className="absolute inset-y-[6%] -left-2 right-0" style={{ clipPath: TORN_PAPER, background: CREAM }} />
          <div className="absolute inset-y-[6%] left-0 right-0 overflow-hidden" style={{ clipPath: TORN }}>
            {banner.image_url && <img src={banner.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          </div>
        </div>
        {!compact && (
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2 text-white/90">
            <img src="/brand/mark-reversed.svg" alt="" className="w-6 h-6" onError={(e) => (e.currentTarget.style.display = "none")} />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">VT Fresh Chicken</span>
          </div>
        )}
        <div className={`relative z-10 flex items-center ${compact ? "gap-2 pl-2 pr-[44%] py-2" : "gap-6 pl-6 pr-[44%] pt-12 pb-8"} min-h-[inherit]`}>
          {showBadge && !compact && (
            <div className="relative w-[70px] h-[116px] flex-shrink-0">
              <div className="absolute inset-0" style={{ clipPath: HEX, background: t.accent }} />
              <div className="absolute inset-[3px]" style={{ clipPath: HEX, background: "rgba(0,0,0,0.35)" }} />
              <div className="absolute inset-[6px] flex flex-col items-center justify-center text-center px-1" style={{ clipPath: HEX, background: t.badge, color: t.badgeText }}>
                {banner.badge_value && <span className="font-extrabold leading-none text-lg tracking-tight">{banner.badge_value}</span>}
                {banner.badge_label && (stack ? (
                  <span className="mt-1 flex flex-col text-[10px] font-bold leading-[1.15]">{banner.badge_label.split("").map((c, i) => <span key={i}>{c}</span>)}</span>
                ) : (
                  <span className="mt-1 text-[9px] font-bold tracking-wider leading-tight break-all">{banner.badge_label}</span>
                ))}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1 text-center">
            {banner.eyebrow && (
              <p className={`text-white leading-none ${compact ? "text-sm" : "text-5xl"}`} style={{ fontFamily: SCRIPT_FONT }}>{banner.eyebrow}</p>
            )}
            <h2
              className={`uppercase leading-[0.95] tracking-wide break-words ${compact ? "text-xl" : "text-7xl mt-1 drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]"}`}
              style={{ color: t.accent, fontFamily: HEAVY_FONT }}
            >
              {banner.title || "TITLE"}
            </h2>
            {banner.subtitle && !compact && (
              <p className="mt-3 text-white/85 text-sm leading-snug max-w-md mx-auto line-clamp-2">{banner.subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="flex items-center gap-6 px-6 py-2.5 text-xs text-stone-700" style={{ background: CREAM }}>
          {banner.cta_text && (
            <span className="inline-flex items-center rounded-full px-5 py-1.5 font-bold uppercase tracking-wider text-[11px] shadow-sm" style={{ background: t.accent, color: t.ctaText }}>
              {banner.cta_text}
            </span>
          )}
          {banner.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-stone-500" />{banner.phone}</span>}
          {banner.footer_note && <span className="inline-flex items-center gap-1.5 truncate"><Leaf className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" /><span className="truncate">{banner.footer_note}</span></span>}
        </div>
      )}
    </div>
  );
}

const inp = "w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500";

function Field({ label, hint, count, max, children }: { label: string; hint?: string; count?: number; max?: number; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-medium text-neutral-600 mb-1">
        <span>{label}</span>
        {max != null && <span className={count! > max ? "text-rose-600" : "text-neutral-400"}>{count}/{max}</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-neutral-400 mt-1">{hint}</span>}
    </label>
  );
}

export function ShopBanners() {
  useBannerFonts();
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();
  const q = useQuery({ queryKey: ["shop-banners"], queryFn: () => api.getShopBanners() });

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [baseline, setBaseline] = useState("[]");
  const [selected, setSelected] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropName, setCropName] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (banners: ShopBanner[]) => {
    setDrafts(banners.map(withKey));
    setBaseline(JSON.stringify(banners));
    setSelected((s) => Math.min(s, Math.max(banners.length - 1, 0)));
  };

  useEffect(() => {
    if (q.data) load(q.data.banners);
  }, [q.data]);

  const dirty = useMemo(() => JSON.stringify(drafts.map(stripKey)) !== baseline, [drafts, baseline]);
  const max = q.data?.max ?? 10;
  const current = drafts[selected];

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => api.updateShopBanners(drafts.map(stripKey)),
    onSuccess: (data) => {
      qc.setQueryData(["shop-banners"], data);
      load(data.banners);
      toast.success("Banners saved", "The shop page will show the new banners right away.");
    },
    onError: (e) => toast.error("Save failed", (e as Error).message),
  });

  const reset = useMutation({
    mutationFn: () => api.resetShopBanners(),
    onSuccess: (data) => {
      qc.setQueryData(["shop-banners"], data);
      setSelected(0);
      load(data.banners);
      toast.success("Defaults restored", "The built-in banners are live again.");
    },
    onError: (e) => toast.error("Reset failed", (e as Error).message),
  });

  const patch = (p: Partial<ShopBanner>) =>
    setDrafts((ds) => ds.map((d, i) => (i === selected ? { ...d, ...p } : d)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= drafts.length) return;
    setDrafts((ds) => {
      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    if (selected === i) setSelected(j);
    else if (selected === j) setSelected(i);
  };

  const add = (b: ShopBanner) => {
    if (drafts.length >= max) {
      toast.error("Limit reached", `You can have up to ${max} banners.`);
      return;
    }
    setDrafts((ds) => [...ds, withKey({ ...b, id: "" })]);
    setSelected(drafts.length);
  };

  const remove = (i: number) => {
    setDrafts((ds) => ds.filter((_, k) => k !== i));
    setSelected((s) => (s > i ? s - 1 : Math.min(s, drafts.length - 2)));
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setCropName(f.name);
    setCropSrc(URL.createObjectURL(f));
  };

  const activeCount = drafts.filter((d) => d.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop Banners"
        subtitle="Promotional banner carousel at the top of the shop page. List order is display order."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => confirmDlg.open({
                title: "Restore default banners?",
                message: "This replaces all your banners with the built-in VT Fresh Chicken banners.",
                confirmLabel: "Restore defaults",
                variant: "warning",
                onConfirm: () => reset.mutate(),
              })}
              disabled={reset.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Defaults
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        }
      />

      {q.isLoading ? (
        <div className="flex items-center justify-center py-24 text-neutral-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : q.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{(q.error as Error).message}</div>
      ) : (
        <>
          {q.data && !q.data.customized && !dirty && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The shop page is showing the built-in default banners. Edit and save to customise them.
            </div>
          )}
          {drafts.length > 0 && activeCount === 0 && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              All banners are hidden — the shop page will show its standard hero instead.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Banner list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-800">Banners <span className="text-neutral-400 font-normal">({drafts.length}/{max})</span></h2>
                <button
                  type="button"
                  onClick={() => add(newBanner())}
                  className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {drafts.length === 0 && (
                <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                  No banners. Add one, or restore the defaults.
                </div>
              )}
              {drafts.map((d, i) => (
                <div
                  key={d._key}
                  className={`rounded-xl border bg-white p-2 transition ${i === selected ? "border-red-500 ring-2 ring-red-500/20" : "border-neutral-200 hover:border-neutral-300"}`}
                >
                  <button type="button" onClick={() => setSelected(i)} className={`block w-full text-left ${d.enabled ? "" : "opacity-50"}`}>
                    <BannerPreview banner={d} compact />
                  </button>
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-xs text-neutral-500 truncate">
                      {i + 1}. {[d.eyebrow, d.title].filter(Boolean).join(" ")}
                    </span>
                    <div className="flex items-center gap-0.5 text-neutral-500">
                      <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === drafts.length - 1}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn label={d.enabled ? "Hide" : "Show"} onClick={() => setDrafts((ds) => ds.map((x, k) => (k === i ? { ...x, enabled: !x.enabled } : x)))}>
                        {d.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </IconBtn>
                      <IconBtn label="Duplicate" onClick={() => add(stripKey(d))}><Copy className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn label="Delete" onClick={() => remove(i)} danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Editor */}
            {current ? (
              <div className="space-y-5 min-w-0">
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-2">Live preview</p>
                  <BannerPreview banner={current} />
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-neutral-600 mb-2">Colour theme</p>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(THEMES) as ShopBannerTheme[]).map((k) => (
                          <button
                            key={k}
                            type="button"
                            title={THEMES[k].label}
                            onClick={() => patch({ theme: k })}
                            className={`relative w-10 h-10 rounded-full ring-offset-2 transition ${current.theme === k ? "ring-2 ring-neutral-900" : "hover:scale-105"}`}
                            style={{ background: THEMES[k].bg }}
                          >
                            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: THEMES[k].accent }} />
                            <span className="sr-only">{THEMES[k].label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Toggle label="Visible" checked={current.enabled} onChange={(v) => patch({ enabled: v })} />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Script lead word" hint="Shown in handwriting style, e.g. “Delicious”" count={current.eyebrow.length} max={LIMITS.eyebrow}>
                      <input className={inp} value={current.eyebrow} onChange={(e) => patch({ eyebrow: e.target.value })} />
                    </Field>
                    <Field label="Headline *" hint="Big bold word — keep it short, e.g. “CHICKEN”" count={current.title.length} max={LIMITS.title}>
                      <input className={inp} value={current.title} onChange={(e) => patch({ title: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Description" count={current.subtitle.length} max={LIMITS.subtitle}>
                    <textarea className={inp} rows={2} value={current.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Badge value" hint="e.g. 45%, ₹99, FREE — leave both empty to hide" count={current.badge_value.length} max={LIMITS.badge_value}>
                      <input className={inp} value={current.badge_value} onChange={(e) => patch({ badge_value: e.target.value })} />
                    </Field>
                    <Field label="Badge caption" hint="≤5 letters stack vertically, e.g. SAVE" count={current.badge_label.length} max={LIMITS.badge_label}>
                      <input className={inp} value={current.badge_label} onChange={(e) => patch({ badge_label: e.target.value.toUpperCase() })} />
                    </Field>
                  </div>

                  {/* Image */}
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-2">Image</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {BRAND_IMAGES.map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => patch({ image_url: src })}
                          className={`w-16 h-12 rounded-lg overflow-hidden border-2 ${current.image_url === src ? "border-red-500" : "border-transparent hover:border-neutral-300"}`}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="w-16 h-12 rounded-lg border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:border-red-400"
                        title="Upload image"
                      >
                        <ImagePlus className="w-5 h-5" />
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                    </div>
                    <input
                      className={`${inp} mt-2`}
                      placeholder="/uploads/... or https://..."
                      value={current.image_url}
                      onChange={(e) => patch({ image_url: e.target.value })}
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">Pick a brand photo, upload your own (4:3 works best), or paste a URL.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Button text" count={current.cta_text.length} max={LIMITS.cta_text}>
                      <input className={inp} value={current.cta_text} onChange={(e) => patch({ cta_text: e.target.value })} />
                    </Field>
                    <Field label="Link" hint="Where the banner goes, e.g. /shop?category=wings or /products/curry-cut" count={current.cta_link.length} max={LIMITS.cta_link}>
                      <input className={inp} value={current.cta_link} onChange={(e) => patch({ cta_link: e.target.value })} placeholder="/shop" />
                    </Field>
                    <Field label="Phone (optional)" count={current.phone.length} max={LIMITS.phone}>
                      <input className={inp} value={current.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+91 98765 43210" />
                    </Field>
                    <Field label="Footer note (optional)" count={current.footer_note.length} max={LIMITS.footer_note}>
                      <input className={inp} value={current.footer_note} onChange={(e) => patch({ footer_note: e.target.value })} placeholder="Cut fresh daily · Same-day delivery" />
                    </Field>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 flex items-center justify-center p-12 text-sm text-neutral-500">
                Select or add a banner to edit it.
              </div>
            )}
          </div>
        </>
      )}

      <ImageCropModal
        open={!!cropSrc}
        imageSrc={cropSrc}
        filename={cropName}
        aspectRatio={4 / 3}
        maxWidth={1200}
        onConfirm={(url) => {
          patch({ image_url: url });
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onCancel={() => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
      />
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "hover:text-rose-600 hover:bg-rose-50" : "hover:text-neutral-900 hover:bg-neutral-100"}`}
    >
      {children}
    </button>
  );
}
