import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Save, Eye, Settings, Trash2, GripVertical, Plus, X,
  ChevronUp, ChevronDown, Copy, Star, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { FullPageLoader } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";
import { BLOCK_TYPES, PAGE_TYPES, PAGE_STATUSES } from "@/types";
import type { StorePage, PageBlock, StorePageRequest, Product, Category } from "@/types";

// Icon mapping
import {
  Image, FileText, Images, MousePointerClick, Minus, Megaphone,
  Package, Grid3x3, GalleryHorizontalEnd, Quote, HelpCircle, Mail,
  MapPin, Users, BarChart3, GitCommit, Columns3, LayoutGrid, Code2, PanelBottom, Loader2,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Image, FileText, Images, MousePointerClick, Minus, Megaphone,
  Package, Grid3x3, GalleryHorizontalEnd, Quote, HelpCircle, Mail,
  MapPin, Users, BarChart3, GitCommit, Columns3, LayoutGrid, Star, Code2, PanelBottom,
};

function genId() {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function PageBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState<StorePage | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<PageBlock | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dirty, setDirty] = useState(false);

  const q = useQuery({
    queryKey: ["page", tenant, id],
    queryFn: () => api.getPage(tenant!, id!),
    enabled: !!tenant && !!id,
  });

  useEffect(() => {
    if (q.data) {
      setPage(q.data);
      setDirty(false);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: (body: StorePageRequest) => api.updatePage(tenant!, id!, body),
    onSuccess: (data) => {
      setPage(data);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["pages", tenant] });
      qc.invalidateQueries({ queryKey: ["page", tenant, id] });
      toast.success("Page saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const blocks = page?.blocks ?? [];
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  const updateBlocks = useCallback((newBlocks: PageBlock[]) => {
    setPage((prev) => prev ? { ...prev, blocks: newBlocks } : prev);
    setDirty(true);
  }, []);

  const handleDragStart = (e: DragStartEvent) => {
    const blk = blocks.find((b) => b.id === e.active.id);
    if (blk) setDraggedBlock(blk);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggedBlock(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(oldIdx, 1);
    newBlocks.splice(newIdx, 0, moved);
    updateBlocks(newBlocks);
  };

  const addBlock = (blockType: string) => {
    const def = BLOCK_TYPES.find((b) => b.type === blockType);
    if (!def) return;
    const newBlock: PageBlock = {
      id: genId(),
      type: blockType,
      props: JSON.parse(JSON.stringify(def.defaultProps)),
    };
    updateBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setShowPalette(false);
  };

  const updateBlockProps = (blockId: string, props: Record<string, any>) => {
    updateBlocks(blocks.map((b) => b.id === blockId ? { ...b, props: { ...b.props, ...props } } : b));
  };

  const deleteBlock = (blockId: string) => {
    updateBlocks(blocks.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const duplicateBlock = (blockId: string) => {
    const blk = blocks.find((b) => b.id === blockId);
    if (!blk) return;
    const idx = blocks.findIndex((b) => b.id === blockId);
    const copy: PageBlock = { ...JSON.parse(JSON.stringify(blk)), id: genId() };
    const newBlocks = [...blocks];
    newBlocks.splice(idx + 1, 0, copy);
    updateBlocks(newBlocks);
  };

  const moveBlock = (blockId: string, dir: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    updateBlocks(newBlocks);
  };

  const handleSave = () => {
    if (!page) return;
    saveMut.mutate({
      slug: page.slug,
      title: page.title,
      page_type: page.page_type,
      status: page.status,
      blocks: page.blocks,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
    });
  };

  if (q.isLoading) return <FullPageLoader />;
  if (!page) return <div className="p-8 text-center text-slate-400">Page not found</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/pages")} className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={page.title}
            onChange={(e) => { setPage({ ...page, title: e.target.value }); setDirty(true); }}
            className="text-lg font-semibold text-slate-900 bg-transparent border-none outline-none focus:bg-slate-50 rounded px-2 py-1"
          />
          {dirty && <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={page.status}
            onChange={(e) => { setPage({ ...page, status: e.target.value }); setDirty(true); }}
            className="border rounded-md px-2 py-1 text-sm"
          >
            {PAGE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            onClick={() => setShowSettings(true)}
            className="border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Settings className="w-4 h-4" /> SEO
          </button>
          <a
            href={`/${tenant}/p/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Eye className="w-4 h-4" /> Preview
          </a>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="bg-brand text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-brand-dark inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saveMut.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Main area: palette (left) + canvas (center) + properties (right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Block palette */}
        <div className="w-56 bg-white border-r overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Blocks</h3>
          </div>
          {["Core", "Commerce", "Info", "Layout"].map((cat) => (
            <div key={cat} className="p-3 border-b">
              <p className="text-xs font-medium text-slate-500 mb-2">{cat}</p>
              <div className="space-y-1">
                {BLOCK_TYPES.filter((b) => b.category === cat).map((b) => {
                  const Icon = ICON_MAP[b.icon] || FileText;
                  return (
                    <button
                      key={b.type}
                      onClick={() => addBlock(b.type)}
                      className="pb-palette-icon w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 rounded-md hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm active:scale-95 transition-all duration-200 text-left"
                    >
                      <Icon className="w-4 h-4 text-slate-400" />
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-slate-100 pb-canvas-bg">
          <div className="max-w-4xl mx-auto py-6 px-4">
            {blocks.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-20 text-center relative overflow-hidden">
                {/* Decorative pulse rings */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-brand/20 pb-pulse-ring" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-brand/20 pb-pulse-ring" style={{ animationDelay: "1s" }} />
                {/* Floating icon */}
                <div className="relative pb-float">
                  <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-brand" />
                  </div>
                </div>
                <p className="text-slate-500 font-medium mb-1 text-lg">No blocks yet</p>
                <p className="text-sm text-slate-400">Add blocks from the left panel to build your page</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {blocks.map((block, idx) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        selected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onDelete={() => deleteBlock(block.id)}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onMoveUp={() => moveBlock(block.id, "up")}
                        onMoveDown={() => moveBlock(block.id, "down")}
                        isFirst={blocks[0].id === block.id}
                        isLast={blocks[blocks.length - 1].id === block.id}
                        index={idx}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {draggedBlock ? (
                    <div className="bg-white rounded-xl border shadow-2xl p-4 opacity-90 cursor-grabbing pb-drag-float">
                      <BlockPreview block={draggedBlock} />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>

        {/* Properties panel */}
        {selectedBlock && (
          <div className="w-80 bg-white border-l overflow-y-auto flex-shrink-0 pb-panel-slide-in">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = ICON_MAP[BLOCK_TYPES.find((b) => b.type === selectedBlock.type)?.icon || ""] || FileText;
                  return <Icon className="w-4 h-4 text-brand" />;
                })()}
                <h3 className="text-sm font-semibold text-slate-700">
                  {BLOCK_TYPES.find((b) => b.type === selectedBlock.type)?.label || selectedBlock.type}
                </h3>
              </div>
              <button onClick={() => setSelectedBlockId(null)} className="pb-tool-btn text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <PropertyEditor block={selectedBlock} tenant={tenant ?? undefined} onChange={(props) => updateBlockProps(selectedBlock.id, props)} />
            </div>
          </div>
        )}
      </div>

      {/* SEO Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 pb-modal-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Page Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Slug (URL)</label>
              <input
                type="text"
                value={page.slug}
                onChange={(e) => { setPage({ ...page, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }); setDirty(true); }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">URL: /t/{tenant}/p/{page.slug}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Page Type</label>
              <select
                value={page.page_type}
                onChange={(e) => { setPage({ ...page, page_type: e.target.value }); setDirty(true); }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {PAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Meta Title (SEO)</label>
              <input
                type="text"
                value={page.meta_title}
                onChange={(e) => { setPage({ ...page, meta_title: e.target.value }); setDirty(true); }}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="SEO title for search engines"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Meta Description (SEO)</label>
              <textarea
                value={page.meta_description}
                onChange={(e) => { setPage({ ...page, meta_description: e.target.value }); setDirty(true); }}
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="SEO description for search engines"
              />
            </div>
            <button onClick={() => setShowSettings(false)} className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Sortable Block Wrapper =====
function SortableBlock({
  block, selected, onSelect, onDelete, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast, index,
}: {
  block: PageBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current || isDragging) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ rx: -dy * 4, ry: dx * 4 });
  };

  const handleMouseLeave = () => setTilt({ rx: 0, ry: 0 });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const blockDef = BLOCK_TYPES.find((b) => b.type === block.type);
  const Icon = blockDef ? (ICON_MAP[blockDef.icon] || FileText) : FileText;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, animationDelay: `${Math.min(index * 0.06, 0.6)}s` }}
      className="pb-block-enter"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        onClick={onSelect}
        style={{
          transform: `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
        className={`pb-block-card relative bg-white rounded-xl border-2 overflow-hidden ${
          selected ? "pb-selected-glow" : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
        }`}
      >
        {/* Glare sweep overlay */}
        <div className="pb-glare" />

        {/* Block type badge */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50/80 backdrop-blur-sm border border-slate-200/60">
          <Icon className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{blockDef?.label || block.type}</span>
        </div>

        {/* Block toolbar */}
        <div className={`absolute -top-3 right-2 flex items-center gap-0.5 bg-white rounded-md border shadow-sm transition ${
          selected || isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}>
          <button
            {...attributes}
            {...listeners}
            className="pb-tool-btn p-1.5 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} className="pb-tool-btn p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move up">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} className="pb-tool-btn p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move down">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="pb-tool-btn p-1.5 text-slate-400 hover:text-slate-700" title="Duplicate">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="pb-tool-btn p-1.5 text-slate-400 hover:text-rose-500" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Block content */}
        <div className="p-1 pt-8">
          <BlockPreview block={block} />
        </div>
      </div>
    </div>
  );
}

// ===== Block Preview (simplified visual in editor) =====
function BlockPreview({ block }: { block: PageBlock }) {
  const p = block.props;
  switch (block.type) {
    case "hero":
      return (
        <div className="rounded-lg p-12 text-center" style={{ backgroundColor: p.backgroundColor || "#4f46e5", color: p.textColor || "#fff", backgroundImage: p.backgroundImage ? `url(${p.backgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
          <h2 className="text-2xl font-bold mb-2">{p.title || "Hero Title"}</h2>
          <p className="text-sm opacity-90 mb-4">{p.subtitle}</p>
          {p.buttonText && <span className="inline-block bg-white/20 px-4 py-2 rounded-md text-sm font-medium">{p.buttonText}</span>}
        </div>
      );
    case "rich_text":
      return <div className="p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: p.content || "<p>Empty text block</p>" }} />;
    case "image":
      return p.src ? (
        <div>
          <img src={p.src} alt={p.alt || ""} className={`w-full ${p.width !== "full" ? "max-w-2xl mx-auto" : ""} ${p.rounded ? "rounded-lg" : ""}`} />
          {p.caption && <p className="text-xs text-slate-400 text-center mt-1">{p.caption}</p>}
        </div>
      ) : <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">Image placeholder</div>;
    case "gallery":
      return (
        <div>
          {p.title && <h3 className="font-semibold text-slate-800 mb-3 px-3">{p.title}</h3>}
          <div className={`grid grid-cols-${p.columns || 3} gap-2 p-2`}>
            {(p.images || []).length > 0 ? (p.images || []).map((img: string, i: number) => (
              <div key={i} className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            )) : <div className="col-span-full text-center text-slate-400 text-sm py-8">No images yet</div>}
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="rounded-lg p-8 text-center" style={{ backgroundColor: p.backgroundColor || "#4f46e5", color: p.textColor || "#fff" }}>
          <h3 className="text-xl font-bold mb-3">{p.title}</h3>
          {p.buttonText && <span className="inline-block bg-white/20 px-4 py-2 rounded-md text-sm font-medium">{p.buttonText}</span>}
        </div>
      );
    case "spacer":
      return <div style={{ height: p.height || 48 }} className="flex items-center justify-center"><span className="text-xs text-slate-300">Spacer ({p.height || 48}px)</span></div>;
    case "divider":
      return <div className="p-2"><hr style={{ borderStyle: p.style || "solid", borderColor: p.color || "#e5e7eb" }} /></div>;
    case "banner":
      return (
        <div className="rounded-lg p-6 flex items-center justify-between" style={{ backgroundColor: p.backgroundColor || "#f59e0b", color: p.textColor || "#fff" }}>
          <div><h3 className="font-bold text-lg">{p.title}</h3><p className="text-sm opacity-90">{p.subtitle}</p></div>
          {p.buttonText && <span className="inline-block bg-white/20 px-4 py-2 rounded-md text-sm font-medium">{p.buttonText}</span>}
        </div>
      );
    case "featured_products": {
      const sourceLabel = p.source === "selected" ? `${(p.product_ids || []).length} selected` : p.source === "category" ? `Category: ${p.category || "all"}` : p.source === "all" ? "All products" : "Featured";
      return <div className="p-3"><h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3><div className="text-xs text-slate-400 mb-2">{sourceLabel}</div><div className="grid grid-cols-4 gap-2">{Array.from({ length: p.source === "selected" ? Math.min((p.product_ids || []).length, 4) : Math.min(p.limit || 4, 4) }).map((_, i) => <div key={i} className="aspect-square bg-slate-100 rounded-lg" />)}</div></div>;
    }
    case "category_showcase": {
      const catSourceLabel = p.source === "selected" ? `${(p.category_ids || []).length} selected` : "All categories";
      return <div className="p-3"><h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3><div className="text-xs text-slate-400 mb-2">{catSourceLabel}</div><div className="grid grid-cols-3 gap-2">{Array.from({ length: p.source === "selected" ? Math.min((p.category_ids || []).length, 3) : Math.min(p.columns || 3, 3) }).map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-lg" />)}</div></div>;
    }
    case "product_carousel": {
      const sourceLabel = p.source === "selected" ? `${(p.product_ids || []).length} selected` : p.source === "category" ? `Category: ${p.category || "all"}` : p.source === "featured" ? "Featured" : "All products";
      return <div className="p-3"><h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3><div className="text-xs text-slate-400 mb-2">{sourceLabel}</div><div className="flex gap-3 overflow-hidden">{Array.from({ length: p.source === "selected" ? Math.min((p.product_ids || []).length, 5) : 5 }).map((_, i) => <div key={i} className="w-32 h-40 bg-slate-100 rounded-lg flex-shrink-0" />)}</div></div>;
    }
    case "testimonials":
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-3">{p.title}</h3>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(p.items || []).map((item: any, i: number) => (
              <div key={i} className="bg-slate-50 rounded-lg p-4">
                <div className="flex gap-0.5 mb-1">{Array.from({ length: item.rating || 5 }).map((_, j) => <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-sm text-slate-600">"{item.text}"</p>
                <p className="text-xs text-slate-400 mt-1">— {item.name}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "reviews":
      return <div className="p-3"><h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3><div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="bg-slate-50 rounded-lg p-3 flex gap-2"><div className="w-8 h-8 bg-slate-200 rounded-full" /><div className="flex-1"><div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div><div className="h-2 bg-slate-200 rounded mt-1 w-3/4" /></div></div>)}</div></div>;
    case "faq":
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3>}
          <div className="space-y-1">
            {(p.items || []).map((item: any, i: number) => (
              <div key={i} className="border rounded-md p-3">
                <p className="font-medium text-sm text-slate-700">{item.question}</p>
                <p className="text-sm text-slate-500 mt-1">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "contact_form": {
      const fields = p.fields || { name: true, email: true, phone: false, subject: true, message: true };
      const enabledFields = Object.entries(fields).filter(([, v]) => v).map(([k]) => k);
      return (
        <div className="p-3">
          <h3 className="font-semibold text-slate-800">{p.title}</h3>
          <p className="text-sm text-slate-500 mb-3">{p.subtitle}</p>
          <div className="text-xs text-slate-400 mb-2">Fields: {enabledFields.join(", ")}</div>
          <div className="space-y-2 max-w-md">
            <div className="h-10 bg-slate-100 rounded-md" /><div className="h-10 bg-slate-100 rounded-md" /><div className="h-20 bg-slate-100 rounded-md" />
            <div className="h-10 bg-brand rounded-md w-32" />
          </div>
        </div>
      );
    }
    case "map":
      return <div className="p-3"><h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3><div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm"><MapPin className="w-8 h-8 mb-1" /> Map: {p.address || "No address set"}</div></div>;
    case "team":
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-3">{p.title}</h3>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(p.members || []).map((m: any, i: number) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-2" />
                <p className="font-medium text-sm text-slate-700">{m.name}</p>
                <p className="text-xs text-slate-400">{m.role}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "stats":
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-3 text-center">{p.title}</h3>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {(p.items || []).map((item: any, i: number) => (
              <div key={i}>
                <p className="text-2xl font-bold text-brand">{item.value}</p>
                <p className="text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "timeline":
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-3">{p.title}</h3>}
          <div className="space-y-3">
            {(p.items || []).map((item: any, i: number) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-12 text-right"><span className="text-sm font-bold text-brand">{item.year}</span></div>
                <div className="border-l-2 border-slate-200 pl-3"><p className="font-medium text-sm text-slate-700">{item.title}</p><p className="text-sm text-slate-500">{item.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      );
    case "columns":
      return (
        <div className="p-3">
          <div className={`grid grid-cols-${p.columns || 2} gap-${p.gap || 4}`}>
            {(p.items || []).map((item: any, i: number) => (
              <div key={i} className="bg-slate-50 rounded-md p-3 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: item.content || "" }} />
            ))}
          </div>
        </div>
      );
    case "feature_grid":
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-3 text-center">{p.title}</h3>}
          <div className={`grid grid-cols-${p.columns || 3} gap-4`}>
            {(p.features || []).map((f: any, i: number) => {
              const Icon = ICON_MAP[f.icon] || Package;
              return (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-6 h-6 text-brand" />
                  </div>
                  <p className="font-medium text-sm text-slate-700">{f.title}</p>
                  <p className="text-sm text-slate-500">{f.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      );
    case "custom_html": {
      const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${p.css || ""}</style></head><body>${p.html || ""}<script>${p.js || ""}<\/script></body></html>`;
      const hasContent = (p.html || "") + (p.css || "") + (p.js || "");
      return (
        <div className="p-3">
          {p.title && <h3 className="font-semibold text-slate-800 mb-2">{p.title}</h3>}
          {hasContent ? (
            <iframe
              srcDoc={srcdoc}
              sandbox="allow-scripts"
              className="w-full border-0 rounded-md"
              style={{ height: Math.min(p.height || 200, 300) }}
              title="Custom HTML Preview"
            />
          ) : (
            <div className="text-sm text-slate-400 text-center py-8 border rounded-md bg-slate-50">
              No custom HTML content yet. Open the settings panel to add HTML, CSS, or JS.
            </div>
          )}
        </div>
      );
    }
    case "footer": {
      const cols: any[] = p.columns || [];
      return (
        <div className="p-3">
          <div className="rounded-lg p-4" style={{ backgroundColor: p.backgroundColor || "#1e293b", color: p.textColor || "#cbd5e1" }}>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {cols.slice(0, 3).map((col: any, i: number) => (
                <div key={i}>
                  <p className="font-semibold text-white text-xs mb-2">{col.title}</p>
                  {(col.links || []).slice(0, 3).map((link: any, j: number) => (
                    <div key={j} className="text-xs opacity-70 mb-1">{link.label}</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-3 text-xs opacity-60">{p.copyright || ""}</div>
          </div>
        </div>
      );
    }
    default:
      return <div className="p-4 text-sm text-slate-400">Unknown block: {block.type}</div>;
  }
}

// ===== Product Picker =====
function ProductPicker({ tenant, selectedIds, onChange }: {
  tenant: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const productsQ = useQuery({
    queryKey: ["products-admin", tenant, search],
    queryFn: () => api.listProductsAdmin(tenant, search || undefined),
    enabled: !!tenant && showSearch,
  });

  const selectedProductsQ = useQuery({
    queryKey: ["products-selected", tenant, selectedIds.join(",")],
    queryFn: async () => {
      if (selectedIds.length === 0) return { items: [] as Product[] };
      const all = await api.listProductsAdmin(tenant);
      return { items: all.items.filter((p) => selectedIds.includes(p.id)) };
    },
    enabled: !!tenant && selectedIds.length > 0,
  });

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const labelCls = "text-xs font-medium text-slate-500 block mb-1";

  return (
    <div>
      <label className={labelCls}>Selected Products ({selectedIds.length})</label>

      {/* Selected products list */}
      {selectedIds.length > 0 && (
        <div className="space-y-1 mb-2 max-h-40 overflow-y-auto border rounded-md p-2">
          {(selectedProductsQ.data?.items || []).map((prod) => (
            <div key={prod.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
              <div className="flex items-center gap-2 min-w-0">
                {prod.image_url && (
                  <img src={prod.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                )}
                <span className="truncate">{prod.name}</span>
                {prod.is_featured && <Star size={10} className="text-amber-400 flex-shrink-0" />}
              </div>
              <button onClick={() => toggleProduct(prod.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 ml-2">
                <X size={14} />
              </button>
            </div>
          ))}
          {selectedProductsQ.isLoading && <div className="text-xs text-slate-400">Loading...</div>}
        </div>
      )}

      {/* Search and add products */}
      <div className="relative">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="w-full border rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
        >
          <Plus size={14} /> {showSearch ? "Close search" : "Add products"}
        </button>

        {showSearch && (
          <div className="mt-2 border rounded-md p-2 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded-md pl-7 pr-3 py-1.5 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {productsQ.isLoading && <div className="text-xs text-slate-400 p-2">Loading products...</div>}
              {(productsQ.data?.items || []).map((prod) => {
                const isSelected = selectedIds.includes(prod.id);
                return (
                  <div
                    key={prod.id}
                    className={`flex items-center justify-between text-xs rounded px-2 py-1.5 cursor-pointer ${
                      isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                    }`}
                    onClick={() => toggleProduct(prod.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {prod.image_url && (
                        <img src={prod.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                      )}
                      <span className="truncate">{prod.name}</span>
                      <span className="text-slate-400 flex-shrink-0">{prod.currency_code} {prod.base_price}</span>
                    </div>
                    {isSelected && <span className="text-indigo-600 flex-shrink-0 ml-2">✓</span>}
                  </div>
                );
              })}
              {!productsQ.isLoading && (productsQ.data?.items || []).length === 0 && (
                <div className="text-xs text-slate-400 p-2 text-center">No products found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Category Select =====
function CategorySelect({ tenant, value, onChange }: {
  tenant: string;
  value: string;
  onChange: (slug: string) => void;
}) {
  const catsQ = useQuery({
    queryKey: ["categories", tenant],
    queryFn: () => api.listCategories(tenant),
    enabled: !!tenant,
  });

  const labelCls = "text-xs font-medium text-slate-500 block mb-1";
  const inputCls = "w-full border rounded-md px-3 py-2 text-sm";

  return (
    <div>
      <label className={labelCls}>Category</label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">All categories</option>
        {(catsQ.data?.items || []).map((cat) => (
          <option key={cat.id} value={cat.slug}>{cat.name}</option>
        ))}
      </select>
    </div>
  );
}

// ===== Category Picker =====
function CategoryPicker({ tenant, selectedIds, onChange }: {
  tenant: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const catsQ = useQuery({
    queryKey: ["categories", tenant],
    queryFn: () => api.listCategories(tenant),
    enabled: !!tenant,
  });

  const allCats = catsQ.data?.items || [];
  const selectedCats = allCats.filter((c) => selectedIds.includes(c.id));

  const toggleCategory = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const labelCls = "text-xs font-medium text-slate-500 block mb-1";

  return (
    <div>
      <label className={labelCls}>Selected Categories ({selectedIds.length})</label>

      {/* Selected categories list */}
      {selectedIds.length > 0 && (
        <div className="space-y-1 mb-2 max-h-40 overflow-y-auto border rounded-md p-2">
          {selectedCats.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
              <span className="truncate">{cat.name}</span>
              <button onClick={() => toggleCategory(cat.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 ml-2">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Available categories */}
      <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
        {catsQ.isLoading && <div className="text-xs text-slate-400 p-2">Loading categories...</div>}
        {allCats.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          return (
            <div
              key={cat.id}
              className={`flex items-center justify-between text-xs rounded px-2 py-1.5 cursor-pointer ${
                isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
              onClick={() => toggleCategory(cat.id)}
            >
              <span className="truncate">{cat.name}</span>
              {isSelected && <span className="text-indigo-600 flex-shrink-0 ml-2">✓</span>}
            </div>
          );
        })}
        {!catsQ.isLoading && allCats.length === 0 && (
          <div className="text-xs text-slate-400 p-2 text-center">No categories found</div>
        )}
      </div>
    </div>
  );
}

// ===== Property Editor =====
function PropertyEditor({ block, onChange, tenant }: { block: PageBlock; onChange: (props: Record<string, any>) => void; tenant?: string }) {
  const p = block.props;
  const set = (key: string, value: any) => onChange({ [key]: value });

  const inputCls = "w-full border rounded-md px-3 py-2 text-sm";
  const labelCls = "text-xs font-medium text-slate-500 block mb-1";

  const renderListEditor = (key: string, label: string, fields: { key: string; label: string; type?: string }[]) => {
    const items = p[key] || [];
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div className="space-y-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="border rounded-md p-2 space-y-1.5 relative">
              {fields.map((f) => (
                <input
                  key={f.key}
                  type={f.type || "text"}
                  placeholder={f.label}
                  value={item[f.key] ?? ""}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[i] = { ...item, [f.key]: e.target.value };
                    set(key, newItems);
                  }}
                  className={inputCls}
                />
              ))}
              <button onClick={() => set(key, items.filter((_: any, j: number) => j !== i))} className="text-xs text-rose-500 hover:text-rose-700">
                Remove
              </button>
            </div>
          ))}
          <button onClick={() => set(key, [...items, fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {})])} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add item
          </button>
        </div>
      </div>
    );
  };

  switch (block.type) {
    case "hero":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Subtitle</label><input type="text" value={p.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Button Text</label><input type="text" value={p.buttonText ?? ""} onChange={(e) => set("buttonText", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Button Link</label><input type="text" value={p.buttonLink ?? ""} onChange={(e) => set("buttonLink", e.target.value)} className={inputCls} placeholder="/demo?view=shop" /></div>
          <div><label className={labelCls}>Background Image URL</label><input type="text" value={p.backgroundImage ?? ""} onChange={(e) => set("backgroundImage", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Alignment</label><select value={p.align ?? "center"} onChange={(e) => set("align", e.target.value)} className={inputCls}><option value="left">Left</option><option value="center">Center</option></select></div>
          <div><label className={labelCls}>Background Color</label><input type="color" value={p.backgroundColor ?? "#4f46e5"} onChange={(e) => set("backgroundColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
          <div><label className={labelCls}>Text Color</label><input type="color" value={p.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
        </>
      );
    case "rich_text":
      return (
        <div>
          <label className={labelCls}>Content (HTML)</label>
          <textarea value={p.content ?? ""} onChange={(e) => set("content", e.target.value)} rows={10} className={inputCls + " font-mono"} />
          <p className="text-xs text-slate-400 mt-1">{"Supports HTML: <h2>, <p>, <ul>, <strong>, etc."}</p>
        </div>
      );
    case "image":
      return (
        <>
          <div><label className={labelCls}>Image URL</label><input type="text" value={p.src ?? ""} onChange={(e) => set("src", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Alt Text</label><input type="text" value={p.alt ?? ""} onChange={(e) => set("alt", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Width</label><select value={p.width ?? "full"} onChange={(e) => set("width", e.target.value)} className={inputCls}><option value="full">Full width</option><option value="contained">Contained</option></select></div>
          <div><label className={labelCls}>Rounded Corners</label><input type="checkbox" checked={p.rounded ?? true} onChange={(e) => set("rounded", e.target.checked)} /></div>
          <div><label className={labelCls}>Caption</label><input type="text" value={p.caption ?? ""} onChange={(e) => set("caption", e.target.value)} className={inputCls} /></div>
        </>
      );
    case "gallery":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Columns</label><input type="number" min={1} max={6} value={p.columns ?? 3} onChange={(e) => set("columns", Number(e.target.value))} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Images (one URL per line)</label>
            <textarea value={(p.images || []).join("\n")} onChange={(e) => set("images", e.target.value.split("\n").filter(Boolean))} rows={5} className={inputCls} />
          </div>
        </>
      );
    case "cta":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Button Text</label><input type="text" value={p.buttonText ?? ""} onChange={(e) => set("buttonText", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Button Link</label><input type="text" value={p.buttonLink ?? ""} onChange={(e) => set("buttonLink", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Background Color</label><input type="color" value={p.backgroundColor ?? "#4f46e5"} onChange={(e) => set("backgroundColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
          <div><label className={labelCls}>Text Color</label><input type="color" value={p.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
        </>
      );
    case "spacer":
      return <div><label className={labelCls}>Height (px)</label><input type="number" value={p.height ?? 48} onChange={(e) => set("height", Number(e.target.value))} className={inputCls} /></div>;
    case "divider":
      return (
        <>
          <div><label className={labelCls}>Style</label><select value={p.style ?? "solid"} onChange={(e) => set("style", e.target.value)} className={inputCls}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></div>
          <div><label className={labelCls}>Color</label><input type="color" value={p.color ?? "#e5e7eb"} onChange={(e) => set("color", e.target.value)} className="w-full h-10 border rounded-md" /></div>
        </>
      );
    case "banner":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Subtitle</label><input type="text" value={p.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Button Text</label><input type="text" value={p.buttonText ?? ""} onChange={(e) => set("buttonText", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Button Link</label><input type="text" value={p.buttonLink ?? ""} onChange={(e) => set("buttonLink", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Background Color</label><input type="color" value={p.backgroundColor ?? "#f59e0b"} onChange={(e) => set("backgroundColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
          <div><label className={labelCls}>Text Color</label><input type="color" value={p.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
        </>
      );
    case "featured_products":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Product Source</label>
            <select value={p.source ?? "featured"} onChange={(e) => set("source", e.target.value)} className={inputCls}>
              <option value="featured">Featured products only</option>
              <option value="all">All products</option>
              <option value="category">By category</option>
              <option value="selected">Specific products</option>
            </select>
          </div>
          {p.source === "category" && tenant && (
            <CategorySelect tenant={tenant} value={p.category ?? ""} onChange={(v) => set("category", v)} />
          )}
          {p.source === "selected" && tenant && (
            <ProductPicker tenant={tenant} selectedIds={p.product_ids ?? []} onChange={(ids) => set("product_ids", ids)} />
          )}
          {p.source !== "selected" && (
            <div><label className={labelCls}>Product Limit</label><input type="number" value={p.limit ?? 8} onChange={(e) => set("limit", Number(e.target.value))} className={inputCls} /></div>
          )}
          <div><label className={labelCls}>Columns</label><input type="number" min={2} max={6} value={p.columns ?? 4} onChange={(e) => set("columns", Number(e.target.value))} className={inputCls} /></div>
        </>
      );
    case "category_showcase":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Category Source</label>
            <select value={p.source ?? "all"} onChange={(e) => set("source", e.target.value)} className={inputCls}>
              <option value="all">All categories</option>
              <option value="selected">Specific categories</option>
            </select>
          </div>
          {p.source === "selected" && tenant && (
            <CategoryPicker tenant={tenant} selectedIds={p.category_ids ?? []} onChange={(ids) => set("category_ids", ids)} />
          )}
          {p.source !== "selected" && (
            <div><label className={labelCls}>Category Limit</label><input type="number" value={p.limit ?? 6} onChange={(e) => set("limit", Number(e.target.value))} className={inputCls} /></div>
          )}
          <div><label className={labelCls}>Columns</label><input type="number" min={2} max={6} value={p.columns ?? 3} onChange={(e) => set("columns", Number(e.target.value))} className={inputCls} /></div>
        </>
      );
    case "product_carousel":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Product Source</label>
            <select value={p.source ?? "all"} onChange={(e) => set("source", e.target.value)} className={inputCls}>
              <option value="all">All products</option>
              <option value="featured">Featured products only</option>
              <option value="category">By category</option>
              <option value="selected">Specific products</option>
            </select>
          </div>
          {p.source === "category" && tenant && (
            <CategorySelect tenant={tenant} value={p.category ?? ""} onChange={(v) => set("category", v)} />
          )}
          {p.source === "selected" && tenant && (
            <ProductPicker tenant={tenant} selectedIds={p.product_ids ?? []} onChange={(ids) => set("product_ids", ids)} />
          )}
          {p.source !== "selected" && (
            <div><label className={labelCls}>Product Limit</label><input type="number" value={p.limit ?? 10} onChange={(e) => set("limit", Number(e.target.value))} className={inputCls} /></div>
          )}
        </>
      );
    case "testimonials":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          {renderListEditor("items", "Testimonials", [{ key: "name", label: "Name" }, { key: "text", label: "Text" }, { key: "rating", label: "Rating (1-5)", type: "number" }])}
        </>
      );
    case "reviews":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Review Limit</label><input type="number" value={p.limit ?? 6} onChange={(e) => set("limit", Number(e.target.value))} className={inputCls} /></div>
        </>
      );
    case "faq":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          {renderListEditor("items", "FAQ Items", [{ key: "question", label: "Question" }, { key: "answer", label: "Answer" }])}
        </>
      );
    case "contact_form":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Subtitle</label><input type="text" value={p.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Contact Email (for notifications)</label><input type="email" value={p.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Form Fields</label>
            <div className="space-y-1.5 border rounded-md p-3">
              {(["name", "email", "phone", "subject", "message"] as const).map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.fields?.[field] ?? (field === "phone" ? false : true)}
                    onChange={(e) => set("fields", { ...(p.fields || {}), [field]: e.target.checked })}
                    className="rounded"
                  />
                  {field}
                </label>
              ))}
            </div>
          </div>
          <div><label className={labelCls}>Button Text</label><input type="text" value={p.buttonText ?? "Send Message"} onChange={(e) => set("buttonText", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Success Message</label><input type="text" value={p.successMessage ?? "Thank you! Your message has been sent."} onChange={(e) => set("successMessage", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Background Color (optional)</label><input type="color" value={p.backgroundColor ?? "#ffffff"} onChange={(e) => set("backgroundColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
          <div><label className={labelCls}>Show Map</label><input type="checkbox" checked={p.showMap ?? false} onChange={(e) => set("showMap", e.target.checked)} /></div>
        </>
      );
    case "map":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Address</label><input type="text" value={p.address ?? ""} onChange={(e) => set("address", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Latitude</label><input type="number" step="any" value={p.latitude ?? 0} onChange={(e) => set("latitude", Number(e.target.value))} className={inputCls} /></div>
          <div><label className={labelCls}>Longitude</label><input type="number" step="any" value={p.longitude ?? 0} onChange={(e) => set("longitude", Number(e.target.value))} className={inputCls} /></div>
          <div><label className={labelCls}>Zoom</label><input type="number" value={p.zoom ?? 14} onChange={(e) => set("zoom", Number(e.target.value))} className={inputCls} /></div>
        </>
      );
    case "team":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          {renderListEditor("members", "Team Members", [{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "bio", label: "Bio" }, { key: "image", label: "Image URL" }])}
        </>
      );
    case "stats":
      return (
        <>
          <div><label className={labelCls}>Title (optional)</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          {renderListEditor("items", "Stats", [{ key: "label", label: "Label" }, { key: "value", label: "Value" }, { key: "icon", label: "Icon name" }])}
        </>
      );
    case "timeline":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          {renderListEditor("items", "Timeline Items", [{ key: "year", label: "Year" }, { key: "title", label: "Title" }, { key: "description", label: "Description" }])}
        </>
      );
    case "columns":
      return (
        <>
          <div><label className={labelCls}>Number of Columns</label><input type="number" min={1} max={4} value={p.columns ?? 2} onChange={(e) => set("columns", Number(e.target.value))} className={inputCls} /></div>
          <div><label className={labelCls}>Gap</label><input type="number" value={p.gap ?? 4} onChange={(e) => set("gap", Number(e.target.value))} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Column Contents (HTML)</label>
            <div className="space-y-2">
              {(p.items || []).map((item: any, i: number) => (
                <textarea key={i} value={item.content ?? ""} onChange={(e) => { const newItems = [...(p.items || [])]; newItems[i] = { ...item, content: e.target.value }; set("items", newItems); }} rows={4} className={inputCls + " font-mono"} placeholder={`Column ${i + 1} HTML`} />
              ))}
            </div>
          </div>
        </>
      );
    case "feature_grid":
      return (
        <>
          <div><label className={labelCls}>Title</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Columns</label><input type="number" min={2} max={6} value={p.columns ?? 3} onChange={(e) => set("columns", Number(e.target.value))} className={inputCls} /></div>
          {renderListEditor("features", "Features", [{ key: "icon", label: "Icon name" }, { key: "title", label: "Title" }, { key: "text", label: "Description" }])}
        </>
      );
    case "custom_html":
      return (
        <>
          <div><label className={labelCls}>Title (optional)</label><input type="text" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>HTML</label>
            <textarea
              value={p.html ?? ""}
              onChange={(e) => set("html", e.target.value)}
              rows={8}
              className={inputCls + " font-mono text-xs"}
              placeholder="<div>Hello World</div>"
            />
          </div>
          <div>
            <label className={labelCls}>CSS</label>
            <textarea
              value={p.css ?? ""}
              onChange={(e) => set("css", e.target.value)}
              rows={6}
              className={inputCls + " font-mono text-xs"}
              placeholder=".my-class { color: red; }"
            />
          </div>
          <div>
            <label className={labelCls}>JavaScript</label>
            <textarea
              value={p.js ?? ""}
              onChange={(e) => set("js", e.target.value)}
              rows={6}
              className={inputCls + " font-mono text-xs"}
              placeholder="console.log('hello');"
            />
          </div>
          <div><label className={labelCls}>Iframe Height (px)</label><input type="number" min={50} max={2000} value={p.height ?? 300} onChange={(e) => set("height", Number(e.target.value))} className={inputCls} /></div>
          <div className="text-xs text-slate-400 bg-slate-50 rounded-md p-2 border">
            <strong>Encapsulation:</strong> Custom code runs inside a sandboxed iframe with <code>allow-scripts</code>. It cannot access the parent page's DOM, styles, or cookies. CSS and JS are scoped to the iframe only.
          </div>
        </>
      );
    case "footer": {
      const cols: any[] = p.columns || [];
      const social = p.social || {};
      const updateColumn = (i: number, field: string, value: any) => {
        const newCols = [...cols];
        newCols[i] = { ...newCols[i], [field]: value };
        set("columns", newCols);
      };
      const updateLink = (ci: number, li: number, field: string, value: any) => {
        const newCols = [...cols];
        const links = [...(newCols[ci].links || [])];
        links[li] = { ...links[li], [field]: value };
        newCols[ci] = { ...newCols[ci], links };
        set("columns", newCols);
      };
      const addColumn = () => set("columns", [...cols, { title: "New Column", links: [{ label: "Link", url: "/" }] }]);
      const removeColumn = (i: number) => set("columns", cols.filter((_, idx) => idx !== i));
      const addLink = (ci: number) => {
        const newCols = [...cols];
        newCols[ci] = { ...newCols[ci], links: [...(newCols[ci].links || []), { label: "New Link", url: "/" }] };
        set("columns", newCols);
      };
      const removeLink = (ci: number, li: number) => {
        const newCols = [...cols];
        newCols[ci] = { ...newCols[ci], links: (newCols[ci].links || []).filter((_: any, idx: number) => idx !== li) };
        set("columns", newCols);
      };
      const socialFields = ["facebook", "twitter", "instagram", "youtube", "linkedin"] as const;
      return (
        <>
          <div><label className={labelCls}>Copyright Text</label><input type="text" value={p.copyright ?? ""} onChange={(e) => set("copyright", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Background Color</label><input type="color" value={p.backgroundColor ?? "#1e293b"} onChange={(e) => set("backgroundColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>
          <div><label className={labelCls}>Text Color</label><input type="color" value={p.textColor ?? "#cbd5e1"} onChange={(e) => set("textColor", e.target.value)} className="w-full h-10 border rounded-md" /></div>

          {/* Link Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Link Columns</label>
              <button onClick={addColumn} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Add column</button>
            </div>
            <div className="space-y-3">
              {cols.map((col: any, ci: number) => (
                <div key={ci} className="border rounded-md p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <input type="text" value={col.title ?? ""} onChange={(e) => updateColumn(ci, "title", e.target.value)} className={inputCls} placeholder="Column title" />
                    <button onClick={() => removeColumn(ci)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={16} /></button>
                  </div>
                  <div className="space-y-1.5 pl-2 border-l-2 border-slate-200">
                    {(col.links || []).map((link: any, li: number) => (
                      <div key={li} className="flex items-center gap-2">
                        <input type="text" value={link.label ?? ""} onChange={(e) => updateLink(ci, li, "label", e.target.value)} className={inputCls + " flex-1"} placeholder="Label" />
                        <input type="text" value={link.url ?? ""} onChange={(e) => updateLink(ci, li, "url", e.target.value)} className={inputCls + " flex-1"} placeholder="/path" />
                        <button onClick={() => removeLink(ci, li)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => addLink(ci)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={10} /> Add link</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social Media */}
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input type="checkbox" checked={p.showSocial ?? true} onChange={(e) => set("showSocial", e.target.checked)} className="rounded" />
              Show Social Media Icons
            </label>
            {p.showSocial !== false && (
              <div className="space-y-2 border rounded-md p-3 bg-slate-50">
                {socialFields.map((s) => (
                  <div key={s}>
                    <label className={labelCls}>{s.charAt(0).toUpperCase() + s.slice(1)} URL</label>
                    <input type="text" value={social[s] ?? ""} onChange={(e) => set("social", { ...social, [s]: e.target.value })} className={inputCls} placeholder={`https://${s}.com/yourstore`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment badges */}
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={p.showPayment ?? true} onChange={(e) => set("showPayment", e.target.checked)} className="rounded" />
              Show Payment Method Badges
            </label>
          </div>
        </>
      );
    }
    default:
      return <p className="text-sm text-slate-400">No properties for this block type.</p>;
  }
}
