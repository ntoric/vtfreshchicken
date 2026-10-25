import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ProductEditSkeleton, Spinner } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";
import { ImageCropModal } from "@/components/ImageCropModal";
import { Toggle } from "@/components/Toggle";
import { Upload, Crop as CropIcon, Link as LinkIcon } from "lucide-react";
import type { Product, Variant, ProductImage, ProductAttributeValue } from "@/types";

type CropTarget =
  | { type: "primary" }
  | { type: "gallery"; index: number }
  | { type: "variant"; index: number };

type Tab = "general" | "images" | "variants" | "attributes" | "shipping" | "returns" | "seo";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "images", label: "Images" },
  { key: "variants", label: "Variants" },
  { key: "attributes", label: "Attributes" },
  { key: "shipping", label: "Shipping" },
  { key: "returns", label: "Returns" },
  { key: "seo", label: "SEO" },
];

export function ProductEdit() {
  const { tenant } = useAuth();
  const { currency, currencies } = useCurrency();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = !id;

  const catsQ = useQuery({ queryKey: ["categories", tenant], queryFn: () => api.listCategories(tenant) });
  const attrsQ = useQuery({ queryKey: ["attributes", tenant], queryFn: () => api.listAttributes(tenant) });
  const vendorsQ = useQuery({ queryKey: ["vendors", tenant], queryFn: () => api.listVendors(tenant) });
  const taxClassesQ = useQuery({ queryKey: ["tax-classes", tenant], queryFn: () => api.listTaxClasses(tenant) });

  const [form, setForm] = useState<Partial<Product>>({
    slug: "", name: "", description: "", sku: "", status: "draft",
    base_price: 0, currency_code: "", is_featured: false, stock: 0, image_url: "",
    category_id: "", variants: [], attributes: [], images: [],
    track_inventory: true, requires_shipping: true,
    weight: 0, length: 0, width: 0, height: 0, free_shipping: false,
    return_period_days: null, refund_period_days: null, replacement_period_days: null,
    return_enabled: null, refund_enabled: null, replacement_enabled: null,
    meta_title: "", meta_description: "", og_image: "",
    tax_class_id: null,
  });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [productAttrs, setProductAttrs] = useState<ProductAttributeValue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // Crop modal state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFilename, setCropFilename] = useState<string | undefined>(undefined);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  // Load existing product by ID (works for all statuses)
  const existingQ = useQuery({
    queryKey: ["product", tenant, id],
    queryFn: () => api.getProductById(tenant, id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!isNew && existingQ.data) {
      const p = existingQ.data;
      setForm(p);
      setVariants(p.variants || []);
      setImages(p.images || []);
      setProductAttrs(p.attributes || []);
    }
  }, [isNew, existingQ.data, id]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, currency_code: form.currency_code || currency.code, variants, images, attributes: productAttrs };
      if (isNew) return api.createProduct(tenant, body);
      return api.updateProduct(tenant, id!, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products-admin", tenant] });
      qc.invalidateQueries({ queryKey: ["product", tenant, id] });
      toast.success(isNew ? "Product created" : "Product saved", isNew ? "New product has been created." : "Product changes have been saved.");
      navigate("/products");
    },
    onError: (e) => {
      const msg = (e as Error).message;
      setError(msg);
      toast.error("Save failed", msg);
    },
    onSettled: () => setSaving(false),
  });

  function set<K extends keyof Product>(key: K, val: Product[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // ---- Variant helpers ----
  function addVariant() {
    setVariants((v) => [...v, { sku: "", name: "", price: form.base_price || 0, stock: 0, image_url: "", is_active: true, attributes: [] }]);
  }
  function updateVariant(i: number, patch: Partial<Variant>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function removeVariant(i: number) {
    setVariants((vs) => vs.filter((_, idx) => idx !== i));
  }

  // ---- Image helpers ----
  function addImage() {
    setImages((imgs) => [...imgs, { url: "", alt: "", sort_order: imgs.length }]);
  }
  function updateImage(i: number, patch: Partial<ProductImage>) {
    setImages((imgs) => imgs.map((img, idx) => (idx === i ? { ...img, ...patch } : img)));
  }
  function removeImage(i: number) {
    setImages((imgs) => imgs.filter((_, idx) => idx !== i).map((img, idx) => ({ ...img, sort_order: idx })));
  }

  // ---- Product attribute helpers ----
  function addProductAttr() {
    setProductAttrs((a) => [...a, { attribute_id: "", value_text: undefined }]);
  }
  function updateProductAttr(i: number, patch: Partial<ProductAttributeValue>) {
    setProductAttrs((attrs) => attrs.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function removeProductAttr(i: number) {
    setProductAttrs((attrs) => attrs.filter((_, idx) => idx !== i));
  }

  // ---- Upload + Crop helpers ----
  function handleFileSelect(files: FileList | null, target: CropTarget) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", "Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropFilename(file.name);
      setCropTarget(target);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  }

  function handleMultipleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    // For multiple files, process the first one and queue the rest
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", "Please select image files only.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropFilename(file.name);
      setCropTarget({ type: "gallery", index: -1 }); // -1 means "add new"
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    // Process remaining files after the first crop is confirmed
    if (files.length > 1) {
      remainingFilesRef.current = Array.from(files).slice(1);
    }
  }

  const remainingFilesRef = useRef<File[]>([]);

  function handleCropConfirm(url: string) {
    if (!cropTarget) return;
    if (cropTarget.type === "primary") {
      set("image_url", url);
    } else if (cropTarget.type === "gallery") {
      if (cropTarget.index === -1) {
        // Adding new image
        setImages((imgs) => [...imgs, { url, alt: "", sort_order: imgs.length }]);
      } else {
        updateImage(cropTarget.index, { url });
      }
    } else if (cropTarget.type === "variant") {
      updateVariant(cropTarget.index, { image_url: url });
    }
    setCropOpen(false);
    setCropSrc(null);
    setCropTarget(null);

    // Process next file in queue (for multiple uploads)
    if (remainingFilesRef.current.length > 0) {
      const nextFile = remainingFilesRef.current.shift()!;
      const reader = new FileReader();
      reader.onload = () => {
        setCropSrc(reader.result as string);
        setCropFilename(nextFile.name);
        setCropTarget({ type: "gallery", index: -1 });
        setCropOpen(true);
      };
      reader.readAsDataURL(nextFile);
    }
  }

  function handleCropCancel() {
    setCropOpen(false);
    setCropSrc(null);
    setCropTarget(null);
    remainingFilesRef.current = [];
  }

  // Open crop modal for an existing image URL
  function openCropForExisting(target: CropTarget, currentUrl: string) {
    setCropSrc(currentUrl);
    setCropFilename(undefined);
    setCropTarget(target);
    setCropOpen(true);
  }

  const variantAttrs = attrsQ.data?.items.filter((a) => a.is_variant) || [];
  const nonVariantAttrs = attrsQ.data?.items.filter((a) => !a.is_variant && !a.is_batch) || [];

  // Show skeleton while loading existing product in edit mode
  if (!isNew && existingQ.isLoading) {
    return <ProductEditSkeleton />;
  }

  return (
    <div>
      <PageHeader title={isNew ? "New Product" : "Edit Product"} subtitle={form.name} />

      {error && <div className="bg-rose-50 text-rose-600 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              activeTab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== General tab ===== */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <h3 className="font-semibold text-slate-900">Basic Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name">
                  <input value={form.name || ""} onChange={(e) => set("name", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Slug">
                  <input value={form.slug || ""} onChange={(e) => set("slug", e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Description">
                <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={4} className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="SKU">
                  <input value={form.sku || ""} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Base Price">
                  <input type="number" step="0.01" value={form.base_price ?? 0} onChange={(e) => set("base_price", Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Stock">
                  <input type="number" value={form.stock ?? 0} onChange={(e) => set("stock", Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Low Stock Threshold">
                  <input type="number" value={form.low_stock_threshold ?? 5} onChange={(e) => set("low_stock_threshold", Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Track Inventory">
                  <select value={form.track_inventory ? "true" : "false"} onChange={(e) => set("track_inventory", e.target.value === "true")} className={inputCls}>
                    <option value="true">Yes — enforce stock limits</option>
                    <option value="false">No — unlimited stock</option>
                  </select>
                </Field>
                <Field label="Requires Shipping">
                  <select value={form.requires_shipping ? "true" : "false"} onChange={(e) => set("requires_shipping", e.target.value === "true")} className={inputCls}>
                    <option value="true">Yes — physical product</option>
                    <option value="false">No — digital/no shipping</option>
                  </select>
                </Field>
                <Field label="Vendor">
                  <select value={form.vendor_id || ""} onChange={(e) => set("vendor_id", e.target.value || undefined)} className={inputCls}>
                    <option value="">No vendor</option>
                    {vendorsQ.data?.items.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <h3 className="font-semibold text-slate-900">Organization</h3>
              <Field label="Category">
                <select
                  value={form.category_id || ""}
                  onChange={(e) => set("category_id", e.target.value || undefined as any)}
                  className={inputCls}
                >
                  <option value="">None</option>
                  {catsQ.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Currency">
                <select value={form.currency_code || currency.code} onChange={(e) => set("currency_code", e.target.value)} className={inputCls}>
                  {!currencies.some((c) => c.code === (form.currency_code || currency.code)) && (
                    <option value={form.currency_code || currency.code}>{form.currency_code || currency.code}</option>
                  )}
                  {currencies.filter((c) => c.is_active).map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                  ))}
                </select>
              </Field>
              <Toggle
                checked={form.is_featured || false}
                onChange={(val) => set("is_featured", val)}
                label="Featured product"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== Images tab ===== */}
      {activeTab === "images" && (
        <div className="space-y-6">
          {/* Primary Image */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Primary Image</h3>
            <div className="flex items-start gap-3">
              {form.image_url && (
                <div className="relative group flex-shrink-0">
                  <img src={form.image_url} alt="" className="w-32 h-32 rounded-xl object-cover border" />
                  <button
                    onClick={() => openCropForExisting({ type: "primary" }, form.image_url!)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center"
                    title="Crop / Resize"
                  >
                    <CropIcon className="w-6 h-6 text-white" />
                  </button>
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white rounded-lg text-sm font-medium cursor-pointer hover:opacity-90 transition flex-shrink-0">
                    <Upload className="w-4 h-4" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files, { type: "primary" })}
                    />
                  </label>
                  <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2">
                    <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input
                      value={form.image_url || ""}
                      onChange={(e) => set("image_url", e.target.value)}
                      className="flex-1 text-sm outline-none bg-transparent"
                      placeholder="Paste image URL…"
                    />
                  </div>
                </div>
                {form.image_url && (
                  <button
                    onClick={() => openCropForExisting({ type: "primary" }, form.image_url!)}
                    className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
                  >
                    <CropIcon className="w-3 h-3" /> Crop / Resize existing
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Image Gallery</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg text-sm font-medium cursor-pointer hover:opacity-90 transition">
                  <Upload className="w-4 h-4" />
                  Upload Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleMultipleFileSelect(e.target.files)}
                  />
                </label>
                <button onClick={addImage} className="text-sm text-brand font-medium hover:underline">+ Add by URL</button>
              </div>
            </div>
            <p className="text-xs text-slate-400">Upload multiple images or paste URLs. The primary image above is shown as the main thumbnail.</p>
            {images.length === 0 && <p className="text-sm text-slate-400">No gallery images.</p>}
            {images.map((img, i) => (
              <div key={i} className="flex items-start gap-3 border rounded-xl p-3">
                {img.url ? (
                  <div className="relative group flex-shrink-0">
                    <img src={img.url} alt={img.alt} className="w-16 h-16 rounded-lg object-cover border" />
                    <button
                      onClick={() => openCropForExisting({ type: "gallery", index: i }, img.url)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center"
                      title="Crop / Resize"
                    >
                      <CropIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-slate-300" />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input placeholder="Image URL" value={img.url} onChange={(e) => updateImage(i, { url: e.target.value })} className={inputCls} />
                  <input placeholder="Alt text" value={img.alt} onChange={(e) => updateImage(i, { alt: e.target.value })} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-brand cursor-pointer hover:underline flex items-center gap-0.5">
                    <Upload className="w-3 h-3" /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files, { type: "gallery", index: i })}
                    />
                  </label>
                  <button onClick={() => removeImage(i)} className="text-rose-500 text-xs hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Variants tab ===== */}
      {activeTab === "variants" && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Variants</h3>
            <button onClick={addVariant} className="text-sm text-brand font-medium hover:underline">+ Add variant</button>
          </div>
          {variants.length === 0 && <p className="text-sm text-slate-400">No variants. The product base price will be used.</p>}
          {variants.map((v, i) => (
            <div key={i} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Variant {i + 1}</span>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={v.is_active}
                    onChange={(val) => updateVariant(i, { is_active: val })}
                    label="Active"
                    size="sm"
                  />
                  <button onClick={() => removeVariant(i)} className="text-rose-500 text-xs hover:underline">Remove</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Field label="SKU"><input value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} className={inputCls} /></Field>
                <Field label="Name"><input value={v.name} onChange={(e) => updateVariant(i, { name: e.target.value })} className={inputCls} placeholder="S / Red" /></Field>
                <Field label="Price"><input type="number" step="0.01" value={v.price} onChange={(e) => updateVariant(i, { price: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Stock"><input type="number" value={v.stock} onChange={(e) => updateVariant(i, { stock: Number(e.target.value) })} className={inputCls} /></Field>
              </div>

              {/* Variant Image — Upload + URL */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Variant Image</label>
                <div className="flex items-start gap-3">
                  {v.image_url ? (
                    <div className="relative group flex-shrink-0">
                      <img src={v.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                      <button
                        onClick={() => openCropForExisting({ type: "variant", index: i }, v.image_url!)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center"
                        title="Crop / Resize"
                      >
                        <CropIcon className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1 px-2.5 py-2 bg-brand text-white rounded-lg text-sm font-medium cursor-pointer hover:opacity-90 transition flex-shrink-0">
                        <Upload className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e.target.files, { type: "variant", index: i })}
                        />
                      </label>
                      <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2">
                        <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <input
                          value={v.image_url || ""}
                          onChange={(e) => updateVariant(i, { image_url: e.target.value })}
                          className="flex-1 text-sm outline-none bg-transparent"
                          placeholder="Paste image URL…"
                        />
                      </div>
                    </div>
                    {v.image_url && (
                      <button
                        onClick={() => openCropForExisting({ type: "variant", index: i }, v.image_url!)}
                        className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
                      >
                        <CropIcon className="w-3 h-3" /> Crop / Resize existing
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {variantAttrs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {variantAttrs.map((va) => (
                    <Field key={va.id} label={va.name}>
                      <select
                        value={v.attributes?.find((a) => a.attribute_slug === va.slug)?.option_value || ""}
                        onChange={(e) => {
                          const opt = va.options?.find((o) => o.value === e.target.value);
                          const others = v.attributes?.filter((a) => a.attribute_slug !== va.slug) || [];
                          updateVariant(i, {
                            attributes: e.target.value && opt
                              ? [...others, { attribute_slug: va.slug, attribute_name: va.name, option_value: opt.value, option_label: opt.label }]
                              : others,
                          });
                        }}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {va.options?.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Attributes tab ===== */}
      {activeTab === "attributes" && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Product Attributes</h3>
            <button onClick={addProductAttr} className="text-sm text-brand font-medium hover:underline">+ Add attribute</button>
          </div>
          <p className="text-xs text-slate-400">Non-variant attributes like brand, material, weight, etc.</p>
          {nonVariantAttrs.length === 0 && (
            <p className="text-sm text-slate-400">No non-variant attributes defined. Create attributes in the Attributes page first.</p>
          )}
          {productAttrs.length === 0 && nonVariantAttrs.length > 0 && <p className="text-sm text-slate-400">No product attributes set.</p>}
          {productAttrs.map((pa, i) => {
            const attr = nonVariantAttrs.find(a => a.id === pa.attribute_id);
            return (
              <div key={i} className="flex items-end gap-3 border rounded-xl p-3">
                <Field label="Attribute">
                  <select
                    value={pa.attribute_id}
                    onChange={(e) => {
                      const a = nonVariantAttrs.find(x => x.id === e.target.value);
                      updateProductAttr(i, {
                        attribute_id: e.target.value,
                        attribute_slug: a?.slug,
                        attribute_name: a?.name,
                        value_text: undefined, value_number: undefined, value_bool: undefined, option_id: undefined, option_label: undefined,
                      });
                    }}
                    className={inputCls}
                  >
                    <option value="">— Select —</option>
                    {nonVariantAttrs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Value">
                  {attr && (attr.type === "select" || attr.type === "color") ? (
                    <select
                      value={pa.option_id || ""}
                      onChange={(e) => {
                        const opt = attr.options?.find(o => o.id === e.target.value);
                        updateProductAttr(i, { option_id: e.target.value, option_label: opt?.label, value_text: opt?.value });
                      }}
                      className={inputCls}
                    >
                      <option value="">— Select —</option>
                      {attr.options?.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  ) : attr && attr.type === "boolean" ? (
                    <select
                      value={pa.value_bool ? "true" : "false"}
                      onChange={(e) => updateProductAttr(i, { value_bool: e.target.value === "true" })}
                      className={inputCls}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : attr && attr.type === "number" ? (
                    <input type="number" step="0.01" value={pa.value_number ?? ""} onChange={(e) => updateProductAttr(i, { value_number: Number(e.target.value) })} className={inputCls} />
                  ) : attr && attr.type === "datetime" ? (
                    <input type="datetime-local" value={pa.value_text || ""} onChange={(e) => updateProductAttr(i, { value_text: e.target.value })} className={inputCls} />
                  ) : (
                    <input value={pa.value_text || ""} onChange={(e) => updateProductAttr(i, { value_text: e.target.value })} className={inputCls} />
                  )}
                </Field>
                <button onClick={() => removeProductAttr(i)} className="text-rose-500 text-xs hover:underline pb-2">Remove</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Shipping tab ===== */}
      {activeTab === "shipping" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Shipping Settings</h3>
            {!form.requires_shipping && (
              <p className="text-sm text-slate-400">Shipping is disabled for this product (set "Requires Shipping" to "Yes" in the General tab to enable).</p>
            )}
            {form.requires_shipping && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <Field label="Weight (kg)">
                    <input type="number" step="0.001" min="0" value={form.weight ?? 0}
                      onChange={(e) => set("weight", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </Field>
                  <Field label="Length (cm)">
                    <input type="number" step="0.01" min="0" value={form.length ?? 0}
                      onChange={(e) => set("length", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </Field>
                  <Field label="Width (cm)">
                    <input type="number" step="0.01" min="0" value={form.width ?? 0}
                      onChange={(e) => set("width", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </Field>
                  <Field label="Height (cm)">
                    <input type="number" step="0.01" min="0" value={form.height ?? 0}
                      onChange={(e) => set("height", parseFloat(e.target.value) || 0)} className={inputCls} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Toggle label="Free shipping" description="This product ships free regardless of order total"
                    checked={form.free_shipping ?? false}
                    onChange={(v) => set("free_shipping", v)} />
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Tax Class</h3>
            <Field label="Tax Class">
              <select
                value={form.tax_class_id || ""}
                onChange={(e) => set("tax_class_id", e.target.value || null)}
                className={inputCls}
              >
                <option value="">Use tenant default</option>
                {taxClassesQ.data?.items.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name}{tc.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}

      {/* ===== Returns tab ===== */}
      {activeTab === "returns" && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Return & Refund Configuration</h3>
          <p className="text-xs text-slate-500">
            Control which return types are available for this product and override the store-default validity periods. Leave period fields blank to use store defaults. Toggle a type off to disable it entirely for this product.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">Returns</span>
                <select
                  value={form.return_enabled === null ? "default" : form.return_enabled ? "enabled" : "disabled"}
                  onChange={(e) => set("return_enabled", e.target.value === "default" ? null : e.target.value === "enabled")}
                  className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="default">Store default</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <Field label="Period (days)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.return_period_days ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("return_period_days", v === "" ? null : Math.max(1, parseInt(v) || 30));
                  }}
                  placeholder="Store default"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">Refunds</span>
                <select
                  value={form.refund_enabled === null ? "default" : form.refund_enabled ? "enabled" : "disabled"}
                  onChange={(e) => set("refund_enabled", e.target.value === "default" ? null : e.target.value === "enabled")}
                  className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="default">Store default</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <Field label="Period (days)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.refund_period_days ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("refund_period_days", v === "" ? null : Math.max(1, parseInt(v) || 30));
                  }}
                  placeholder="Store default"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">Replacements</span>
                <select
                  value={form.replacement_enabled === null ? "default" : form.replacement_enabled ? "enabled" : "disabled"}
                  onChange={(e) => set("replacement_enabled", e.target.value === "default" ? null : e.target.value === "enabled")}
                  className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="default">Store default</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <Field label="Period (days)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.replacement_period_days ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("replacement_period_days", v === "" ? null : Math.max(1, parseInt(v) || 15));
                  }}
                  placeholder="Store default"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ===== SEO tab ===== */}
      {activeTab === "seo" && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">SEO Settings</h3>
          <p className="text-xs text-slate-500">
            Override the meta title, meta description, and Open Graph image for this product. Leave blank to fall back to the product name, description, and primary image.
          </p>
          <div className="space-y-4">
            <Field label="Meta Title (SEO)">
              <input
                type="text"
                value={form.meta_title ?? ""}
                onChange={(e) => set("meta_title", e.target.value)}
                placeholder="Defaults to product name"
                className={inputCls}
              />
            </Field>
            <Field label="Meta Description (SEO)">
              <textarea
                value={form.meta_description ?? ""}
                onChange={(e) => set("meta_description", e.target.value)}
                rows={2}
                placeholder="Defaults to product description (first 160 chars)"
                className={inputCls}
              />
            </Field>
            <Field label="Open Graph Image URL">
              <input
                type="text"
                value={form.og_image ?? ""}
                onChange={(e) => set("og_image", e.target.value)}
                placeholder="Defaults to primary product image"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      )}

      {/* Save button (always visible) */}
      <div className="mt-6">
        <button
          onClick={() => { setSaving(true); save.mutate(); }}
          disabled={saving || !form.name || !form.slug}
          className="w-full sm:w-auto bg-brand text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-brand-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Spinner size={18} />}
          {saving ? "Saving…" : isNew ? "Create Product" : "Save Changes"}
        </button>
      </div>

      {/* Crop Modal */}
      <ImageCropModal
        open={cropOpen}
        imageSrc={cropSrc}
        filename={cropFilename}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </div>
  );
}

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
