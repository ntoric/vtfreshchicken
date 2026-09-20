import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import type { Currency, Language, SMTPSettings, LandingPageContent, LandingFeature, LandingTestimonial, TenantSettings, BrandStoryContent, LookbookContent, LookbookItem, TrendReportContent, TrendItem, SustainabilityContent, SustainabilityValue, StyleGuideContent, StyleGuideArticle, StatsContent, StatsItem, JournalContent, JournalArticle, InstagramContent, FAQContent, FAQItem, NewsletterContent, TrustBadgeContent, SplashContent } from "@/types";

// Mini live preview of the loading animation, rendered inside the backoffice
function MiniSplashPreview({ style, background, subtitle, showLogo, showProgress, showDots }: { style: string; background: string; subtitle: string; showLogo: boolean; showProgress: boolean; showDots: boolean }) {
  const initials = "ST";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden">
      {background === "orbs" && (
        <>
          <div className="absolute top-[-20%] left-[-10%] w-32 h-32 rounded-full blur-2xl bg-indigo-500 opacity-10 animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-10%] w-40 h-40 rounded-full blur-2xl bg-indigo-500 opacity-10 animate-pulse" />
        </>
      )}
      {background === "waves" && (
        <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none" viewBox="0 0 400 200" fill="none">
          <path d="M0,80 Q100,50 200,80 T400,80" stroke="#6366f1" strokeWidth="1.5" />
          <path d="M0,120 Q100,90 200,120 T400,120" stroke="#6366f1" strokeWidth="1" />
        </svg>
      )}
      <div className="relative z-10 flex flex-col items-center gap-2">
        {style === "rings" && (
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#6366f1", borderRightColor: "#6366f1", animationDuration: "2s" }} />
            <div className="absolute inset-1 rounded-full border-2 border-transparent animate-spin" style={{ borderBottomColor: "#6366f1", borderLeftColor: "#6366f1", animationDirection: "reverse", animationDuration: "1.5s", opacity: 0.5 }} />
            {showLogo && <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">{initials}</div>}
          </div>
        )}
        {style === "spinner" && (
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-3 border-slate-200" style={{ borderWidth: 3 }} />
            <div className="absolute inset-0 rounded-full border-transparent animate-spin" style={{ borderTopColor: "#6366f1", borderRightColor: "#6366f1", borderWidth: 3, animationDuration: "1s" }} />
            {showLogo && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">{initials}</div>}
          </div>
        )}
        {style === "pulse" && (
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-20 animate-ping" />
            <div className="absolute inset-1 rounded-full bg-indigo-500 opacity-30 animate-ping" style={{ animationDelay: "0.5s" }} />
            {showLogo && <div className="relative w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold animate-pulse">{initials}</div>}
          </div>
        )}
        {style === "dots" && (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }} />
            ))}
          </div>
        )}
        {style === "bars" && (
          <div className="flex items-end gap-1 h-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-1.5 rounded-full bg-indigo-600" style={{ height: "100%", animation: `pulse 1s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
          </div>
        )}
        <div className="text-center">
          <div className="text-sm font-bold text-slate-900">Store</div>
          <div className="text-[8px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">{subtitle || "Loading…"}</div>
        </div>
        {showDots && style !== "dots" && (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }} />
            ))}
          </div>
        )}
        {showProgress && (
          <div className="w-20 h-0.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-indigo-600 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

const ICON_OPTIONS = [
  { value: "truck", label: "Truck (Shipping)" },
  { value: "shield", label: "Shield (Security)" },
  { value: "refresh", label: "Refresh (Returns)" },
  { value: "support", label: "Support (Headset)" },
  { value: "star", label: "Star (Quality)" },
  { value: "tag", label: "Tag (Prices)" },
  { value: "heart", label: "Heart (Favorites)" },
  { value: "check", label: "Check (Verified)" },
  { value: "leaf", label: "Leaf (Eco)" },
  { value: "globe", label: "Globe (Worldwide)" },
  { value: "award", label: "Award (Excellence)" },
];

const LANDING_TABS = [
  { id: "hero", label: "Hero" },
  { id: "features", label: "Features" },
  { id: "featured", label: "Featured Products" },
  { id: "promo", label: "Promo Banner" },
  { id: "testimonials", label: "Testimonials" },
  { id: "cta", label: "Call to Action" },
  { id: "marquee", label: "Brand Marquee" },
  { id: "philosophy", label: "Philosophy" },
  { id: "brandstory", label: "Brand Story" },
  { id: "lookbook", label: "Lookbook" },
  { id: "trends", label: "Trend Report" },
  { id: "sustainability", label: "Sustainability" },
  { id: "styleguide", label: "Style Guide" },
  { id: "stats", label: "Stats" },
  { id: "journal", label: "Fashion Journal" },
  { id: "instagram", label: "Instagram" },
  { id: "faq", label: "FAQ" },
  { id: "newsletter", label: "Newsletter" },
  { id: "trust", label: "Trust Badges" },
  { id: "splash", label: "Loading Animation" },
];

const DEFAULT_CONTENT: LandingPageContent = {
  hero_title: "Wear the Future",
  hero_subtitle: "Bold silhouettes. Timeless craft. Step into a collection where every stitch tells a story of innovation and elegance.",
  hero_button_text: "Shop the Collection",
  hero_image_url: "",
  features: [
    { icon: "truck", title: "Free Shipping", text: "On all orders over $50, worldwide" },
    { icon: "shield", title: "Secure Payment", text: "Bank-grade encrypted checkout" },
    { icon: "refresh", title: "Easy Returns", text: "30-day hassle-free return policy" },
    { icon: "support", title: "24/7 Support", text: "Dedicated customer care team" },
  ],
  promo_title: "Season Sale — Up to 50% Off",
  promo_text: "Don't miss our biggest sale of the season. Limited time only — refresh your wardrobe for less.",
  promo_image_url: "",
  testimonials: [
    { name: "Sarah Johnson", role: "Verified Buyer", text: "Amazing quality and fast shipping! I'm definitely coming back for more.", rating: 5 },
    { name: "Mike Chen", role: "Verified Buyer", text: "Best online shopping experience I've had. The products exceeded my expectations.", rating: 5 },
    { name: "Emily Davis", role: "Verified Buyer", text: "Great prices and excellent customer service. Highly recommended!", rating: 4 },
  ],
  cta_title: "Ready to Start Shopping?",
  cta_text: "Browse our full catalog and find exactly what you're looking for. New arrivals every week.",
  cta_button_text: "Browse All Products",
  show_features: true,
  show_promo: true,
  show_testimonials: true,
  show_cta: true,
  show_featured_products: true,
  // Extended CMS sections
  show_marquee: true,
  marquee_brands: ["VOGUE", "GQ", "ELLE", "HARPER'S BAZAAR", "ESQUIRE", "WWD"],
  show_philosophy: true,
  philosophy_title: "Fashion is the armor to survive the reality of everyday life",
  philosophy_text1: "We believe fashion is not about following trends — it's about expressing who you are. Every piece in our collection is chosen for its ability to tell a story, to make a statement, to transform the ordinary into the extraordinary.",
  philosophy_text2: "From the ateliers of Milan to the textile mills of Osaka, from the indigo dyers of West Africa to the wool weavers of Scotland — our pieces carry the fingerprints of artisans who have dedicated their lives to their craft.",
  philosophy_badge: "Established 2001",
  show_brand_story: true,
  brand_story: {
    title: "Crafted with Passion, Worn with Pride",
    text1: "What began as a small atelier in 2001 has grown into a global destination for those who refuse to compromise on quality. Every garment passes through seven pairs of hands before it reaches yours.",
    text2: "We work directly with mills, tanneries, and artisans — cutting out the middlemen so we can invest in what matters: better materials, fairer wages, and garments that last a lifetime.",
    image_url: "",
    stat_value: "25+",
    stat_label: "Years of Craft",
    tags: ["Sustainable", "Handcrafted", "Ethically Sourced", "Premium Materials"],
  },
  show_lookbook: true,
  lookbook: {
    title: "The Autumn Edit",
    subtitle: "A curated selection of this season's most coveted pieces — styled, layered, and ready to inspire.",
    items: [
      { image_url: "", category: "Editorial", title: "The Tailored Suit" },
      { image_url: "", category: "Street Style", title: "Urban Layers" },
      { image_url: "", category: "Accessories", title: "Statement Pieces" },
      { image_url: "", category: "Evening", title: "Night Out" },
      { image_url: "", category: "Minimalist", title: "Clean Lines" },
    ],
  },
  show_trend_report: true,
  trend_report: {
    title: "The Trends Defining 2026",
    subtitle: "From the runways to the streets — the movements shaping how we dress this year.",
    trends: [
      { number: "01", title: "The Return of Tailoring", text: "Oversized blazers, deconstructed suits, and fluid silhouettes are redefining power dressing for the comfort generation." },
      { number: "02", title: "Quiet Luxury", text: "The move away from logos toward understated elegance. Quality you can feel in the fabric and see in the construction." },
      { number: "03", title: "Texture as Statement", text: "Boucle, shearling, and quilted nylon are replacing bold color as the new way to stand out. Tactile wardrobes in monochrome." },
      { number: "04", title: "Circular Fashion", text: "The mindset shift toward recycled, resold, and reborn garments is becoming mainstream — and increasingly stylish." },
    ],
  },
  show_sustainability: true,
  sustainability: {
    title: "Fashion with a Conscience",
    subtitle: "Every choice we make leaves a trace. We're committed to making ours a positive one.",
    values: [
      { icon: "leaf", title: "Eco Materials", text: "Organic cottons, recycled polyester, and Tencel from sustainably managed forests." },
      { icon: "globe", title: "Carbon Neutral", text: "Every order ships carbon-neutral. We offset 100% of our logistics emissions." },
      { icon: "heart", title: "Fair Trade", text: "Living wages, safe conditions, and transparent supply chains across all our partners." },
      { icon: "award", title: "Built to Last", text: "Garments designed for decades, not seasons. Repair, don't replace." },
    ],
  },
  show_style_guide: true,
  style_guide: {
    title: "The Style Guide",
    subtitle: "Expert advice on building a wardrobe that works as hard as you do.",
    articles: [
      { image_url: "", category: "Layering", title: "The Art of the Layer", text1: "Start with a breathable base, add a mid-layer for warmth, and finish with a protective outer shell.", text2: "The key is proportion — balance oversized pieces with fitted ones, and keep tones in the same family for a cohesive look." },
      { image_url: "", category: "Accessories", title: "Less Is Always More", text1: "One statement piece is worth more than five forgettable ones. Invest in a quality bag and good footwear.", text2: "A great watch, a leather belt, and clean sneakers can carry an entire outfit. Everything else is optional." },
      { image_url: "", category: "Capsule Wardrobe", title: "Build to Last", text1: "Start with 30 versatile pieces that all work together. Quality over quantity, every time.", text2: "A navy blazer, white shirts, dark denim, and leather boots form a foundation that never goes out of style." },
    ],
  },
  show_stats: true,
  stats: {
    title: "By the Numbers",
    items: [
      { value: 500, suffix: "+", label: "Products" },
      { value: 50, suffix: "+", label: "Categories" },
      { value: 100, suffix: "K+", label: "Happy Customers" },
    ],
  },
  show_journal: true,
  journal: {
    title: "Stories from the Atelier",
    subtitle: "Notes on craft, culture, and the art of dressing well.",
    articles: [
      { image_url: "", category: "Craftsmanship", read_time: "5 min read", title: "The Making of a Coat", text: "47 hours. 3,000 stitches. One coat. Follow the journey from sketch to final stitch through the hands of seven artisans.", featured: true },
      { image_url: "", category: "Color Theory", read_time: "3 min read", title: "Color Theory for Your Wardrobe", text: "Understanding warm and cool undertones is the first step to building a palette that flatters you every day.", featured: false },
      { image_url: "", category: "Fabric Guide", read_time: "4 min read", title: "A Fabric Guide: What to Look For", text: "Linen for summer, denim for everyday, cashmere for luxury. Here's what to check on the label before you buy.", featured: false },
      { image_url: "", category: "Seasonal", read_time: "6 min read", title: "Transitioning Your Wardrobe Between Seasons", text: "The art of strategic layering and transitional pieces that work year-round. Build a wardrobe framework.", featured: false },
    ],
  },
  show_instagram: true,
  instagram: {
    handle: "@yourstore",
    title: "Follow Our Journey",
    subtitle: "Behind the scenes, new arrivals, and styling inspiration.",
    images: ["", "", "", "", "", ""],
  },
  show_faq: true,
  faq: {
    title: "Frequently Asked Questions",
    subtitle: "Everything you need to know about shopping with us.",
    items: [
      { question: "How long does shipping take?", answer: "Standard shipping takes 3-5 business days within the continental US. Express shipping (1-2 days) is available at checkout. International orders take 7-14 business days depending on destination." },
      { question: "What is your return policy?", answer: "We offer a 30-day hassle-free return policy on all unworn items with original tags. Returns are free for orders over $50. Refunds are processed within 3-5 business days of receiving your return." },
      { question: "How do I find the right size?", answer: "Each product page has a detailed size guide with measurements in inches and centimeters. If you're between sizes, we recommend sizing up for a relaxed fit or down for a tailored look. You can also contact our support team for personalized advice." },
      { question: "Are your products sustainable?", answer: "We're committed to sustainability. 70% of our materials are organic, recycled, or sustainably sourced. We work with certified factories that pay living wages and maintain safe working conditions." },
      { question: "Do you offer gift cards?", answer: "Yes! Digital gift cards are available in denominations from $25 to $500. They're delivered instantly via email and never expire. Perfect for last-minute gifts." },
    ],
  },
  show_newsletter: true,
  newsletter: {
    badge: "Join the Club",
    title: "Get 10% Off Your First Order",
    subtitle: "Subscribe for early access to new collections, exclusive offers, and styling tips delivered to your inbox.",
    placeholder: "Enter your email address",
    button_text: "Subscribe",
    disclaimer: "By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.",
  },
  show_trust_badges: true,
  trust_badges: [
    { icon: "shield", title: "Secure Checkout", subtext: "SSL encrypted payment processing" },
    { icon: "truck", title: "Fast Delivery", subtext: "Free shipping on orders over $50" },
    { icon: "refresh", title: "Easy Returns", subtext: "30-day hassle-free returns" },
    { icon: "support", title: "24/7 Support", subtext: "Dedicated customer care" },
  ],
  splash: {
    enabled: true,
    style: "rings",
    background: "waves",
    subtitle: "Loading…",
    show_logo: true,
    show_progress: true,
    show_dots: true,
  },
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
      />
    </label>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
}

export function Settings() {
  const { user, tenant } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const settingsQ = useQuery({
    queryKey: ["settings", tenant],
    queryFn: () => api.getSettings(tenant),
  });

  const [brandColor, setBrandColor] = useState("#4f46e5");
  const [logoUrl, setLogoUrl] = useState("");
  const [landingEnabled, setLandingEnabled] = useState(false);
  const [anonymousCheckout, setAnonymousCheckout] = useState(true);
  const [returnPeriodDays, setReturnPeriodDays] = useState(30);
  const [refundPeriodDays, setRefundPeriodDays] = useState(30);
  const [replacementPeriodDays, setReplacementPeriodDays] = useState(15);
  const [seoMetaTitle, setSeoMetaTitle] = useState("");
  const [seoMetaDescription, setSeoMetaDescription] = useState("");
  const [seoOgImage, setSeoOgImage] = useState("");
  const [seoSiteUrl, setSeoSiteUrl] = useState("");
  const [seoSocialLinks, setSeoSocialLinks] = useState("");
  const [defaultCurrencyCode, setDefaultCurrencyCode] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
  const [content, setContent] = useState<LandingPageContent>(DEFAULT_CONTENT);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [landingTab, setLandingTab] = useState("hero");

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpEncryption, setSmtpEncryption] = useState("starttls");
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const currenciesQ = useQuery({
    queryKey: ["currencies", tenant],
    queryFn: () => api.listCurrencies(tenant),
  });
  const currencies = currenciesQ.data ?? [];

  const languagesQ = useQuery({
    queryKey: ["languages", tenant],
    queryFn: () => api.listLanguages(tenant),
  });
  const languages = languagesQ.data ?? [];

  const smtpQ = useQuery({
    queryKey: ["smtp", tenant],
    queryFn: () => api.getSMTPSettings(tenant),
  });

  useEffect(() => {
    if (smtpQ.data) {
      setSmtpHost(smtpQ.data.host || "");
      setSmtpPort(smtpQ.data.port || 587);
      setSmtpUser(smtpQ.data.username || "");
      setSmtpPass(smtpQ.data.password || "");
      setSmtpFromEmail(smtpQ.data.from_email || "");
      setSmtpFromName(smtpQ.data.from_name || "");
      setSmtpEncryption(smtpQ.data.encryption || "starttls");
      setSmtpEnabled(smtpQ.data.enabled ?? false);
    }
  }, [smtpQ.data]);

  useEffect(() => {
    if (settingsQ.data) {
      setBrandColor(settingsQ.data.brand_color || "#4f46e5");
      setLogoUrl(settingsQ.data.logo_url || "");
      setLandingEnabled(settingsQ.data.landing_page_enabled || false);
      setAnonymousCheckout(settingsQ.data.anonymous_checkout ?? true);
      setReturnPeriodDays(settingsQ.data.return_period_days ?? 30);
      setRefundPeriodDays(settingsQ.data.refund_period_days ?? 30);
      setReplacementPeriodDays(settingsQ.data.replacement_period_days ?? 15);
      setSeoMetaTitle(settingsQ.data.meta_title || "");
      setSeoMetaDescription(settingsQ.data.meta_description || "");
      setSeoOgImage(settingsQ.data.og_image || "");
      setSeoSiteUrl(settingsQ.data.site_url || "");
      setSeoSocialLinks((settingsQ.data.social_links || []).join("\n"));
      // Resolve default currency code from the currencies list
      if (settingsQ.data.default_currency_id && currencies.length > 0) {
        const cur = currencies.find((c) => c.id === settingsQ.data.default_currency_id);
        if (cur) setDefaultCurrencyCode(cur.code);
      }
      // Language settings
      setDefaultLanguage(settingsQ.data.default_language || "en");
      setSupportedLanguages(settingsQ.data.supported_languages || []);
      if (settingsQ.data.landing_page_content) {
        setContent({ ...DEFAULT_CONTENT, ...settingsQ.data.landing_page_content });
      }
    }
  }, [settingsQ.data, currencies]);

  const saveMut = useMutation({
    mutationFn: (body: Partial<TenantSettings>) => api.updateSettings(tenant, body),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["settings", tenant] });
      toast.success("Settings saved", "Your changes have been applied.");
      setTimeout(() => setSaveState("idle"), 2000);
    },
    onError: (e) => {
      setSaveState("idle");
      toast.error("Save failed", (e as Error).message);
    },
  });

  const handleSaveBranding = () => {
    saveMut.mutate({ brand_color: brandColor, logo_url: logoUrl });
  };

  const handleSaveCheckout = () => {
    saveMut.mutate({ anonymous_checkout: anonymousCheckout });
  };

  const handleSaveReturnPolicy = () => {
    saveMut.mutate({
      return_period_days: returnPeriodDays,
      refund_period_days: refundPeriodDays,
      replacement_period_days: replacementPeriodDays,
    });
  };

  const handleSaveSEO = () => {
    saveMut.mutate({
      meta_title: seoMetaTitle,
      meta_description: seoMetaDescription,
      og_image: seoOgImage,
      site_url: seoSiteUrl,
      social_links: seoSocialLinks.split("\n").map((s) => s.trim()).filter(Boolean),
    });
  };

  const handleSaveCurrency = () => {
    saveMut.mutate({ default_currency_code: defaultCurrencyCode });
  };

  const handleSaveLanguage = () => {
    // Ensure default language is in the supported list
    const langs = supportedLanguages.includes(defaultLanguage)
      ? supportedLanguages
      : [...supportedLanguages, defaultLanguage];
    saveMut.mutate({ default_language: defaultLanguage, supported_languages: langs });
  };

  const toggleSupportedLanguage = (code: string) => {
    setSupportedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSaveLanding = () => {
    saveMut.mutate({
      landing_page_enabled: landingEnabled,
      landing_page_content: content,
    });
  };

  // SMTP save + test
  const smtpSaveMut = useMutation({
    mutationFn: (body: Partial<SMTPSettings>) => api.updateSMTPSettings(tenant, body),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["smtp", tenant] });
      toast.success("SMTP settings saved", "Email configuration has been updated.");
      setTimeout(() => setSaveState("idle"), 2000);
    },
    onError: (e) => {
      setSaveState("idle");
      toast.error("Save failed", (e as Error).message);
    },
  });

  const smtpTestMut = useMutation({
    mutationFn: (to: string) => api.testSMTPSettings(tenant, to),
    onSuccess: () => {
      setSmtpTestResult({ ok: true, msg: "Test email sent successfully" });
      toast.success("Test email sent", `A test email was sent to ${smtpTestEmail}.`);
    },
    onError: (e: Error) => {
      setSmtpTestResult({ ok: false, msg: e.message });
      toast.error("Test email failed", e.message);
    },
  });

  const handleSaveSMTP = () => {
    smtpSaveMut.mutate({
      host: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
      from_email: smtpFromEmail,
      from_name: smtpFromName,
      encryption: smtpEncryption,
      enabled: smtpEnabled,
    });
  };

  const handleTestSMTP = () => {
    if (!smtpTestEmail) return;
    setSmtpTestResult(null);
    smtpTestMut.mutate(smtpTestEmail);
  };

  const handleUseDefaults = () => {
    setContent(DEFAULT_CONTENT);
  };

  const updateFeature = (i: number, field: keyof LandingFeature, value: string) => {
    setContent((prev) => ({
      ...prev,
      features: prev.features.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)),
    }));
  };

  const addFeature = () => {
    setContent((prev) => ({
      ...prev,
      features: [...prev.features, { icon: "check", title: "New Feature", text: "Feature description" }],
    }));
  };

  const removeFeature = (i: number) => {
    setContent((prev) => ({
      ...prev,
      features: prev.features.filter((_, idx) => idx !== i),
    }));
  };

  const updateTestimonial = (i: number, field: keyof LandingTestimonial, value: string | number) => {
    setContent((prev) => ({
      ...prev,
      testimonials: prev.testimonials.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)),
    }));
  };

  const addTestimonial = () => {
    setContent((prev) => ({
      ...prev,
      testimonials: [...prev.testimonials, { name: "New Customer", role: "Verified Buyer", text: "Great experience!", rating: 5 }],
    }));
  };

  const removeTestimonial = (i: number) => {
    setContent((prev) => ({
      ...prev,
      testimonials: prev.testimonials.filter((_, idx) => idx !== i),
    }));
  };

  // ---- Extended CMS helpers ----
  const updateBrandStory = (patch: Partial<BrandStoryContent>) => {
    setContent((prev) => ({ ...prev, brand_story: { ...prev.brand_story!, ...patch } }));
  };
  const updateLookbook = (patch: Partial<LookbookContent>) => {
    setContent((prev) => ({ ...prev, lookbook: { ...prev.lookbook!, ...patch } }));
  };
  const updateLookbookItem = (i: number, patch: Partial<LookbookItem>) => {
    setContent((prev) => ({ ...prev, lookbook: { ...prev.lookbook!, items: prev.lookbook!.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) } }));
  };
  const addLookbookItem = () => {
    setContent((prev) => ({ ...prev, lookbook: { ...prev.lookbook!, items: [...prev.lookbook!.items, { image_url: "", category: "Editorial", title: "New Look" }] } }));
  };
  const removeLookbookItem = (i: number) => {
    setContent((prev) => ({ ...prev, lookbook: { ...prev.lookbook!, items: prev.lookbook!.items.filter((_, idx) => idx !== i) } }));
  };
  const updateTrendReport = (patch: Partial<TrendReportContent>) => {
    setContent((prev) => ({ ...prev, trend_report: { ...prev.trend_report!, ...patch } }));
  };
  const updateTrend = (i: number, patch: Partial<TrendItem>) => {
    setContent((prev) => ({ ...prev, trend_report: { ...prev.trend_report!, trends: prev.trend_report!.trends.map((t, idx) => idx === i ? { ...t, ...patch } : t) } }));
  };
  const addTrend = () => {
    setContent((prev) => ({ ...prev, trend_report: { ...prev.trend_report!, trends: [...prev.trend_report!.trends, { number: String(prev.trend_report!.trends.length + 1).padStart(2, "0"), title: "New Trend", text: "" }] } }));
  };
  const removeTrend = (i: number) => {
    setContent((prev) => ({ ...prev, trend_report: { ...prev.trend_report!, trends: prev.trend_report!.trends.filter((_, idx) => idx !== i) } }));
  };
  const updateSustainability = (patch: Partial<SustainabilityContent>) => {
    setContent((prev) => ({ ...prev, sustainability: { ...prev.sustainability!, ...patch } }));
  };
  const updateSustainabilityValue = (i: number, patch: Partial<SustainabilityValue>) => {
    setContent((prev) => ({ ...prev, sustainability: { ...prev.sustainability!, values: prev.sustainability!.values.map((v, idx) => idx === i ? { ...v, ...patch } : v) } }));
  };
  const addSustainabilityValue = () => {
    setContent((prev) => ({ ...prev, sustainability: { ...prev.sustainability!, values: [...prev.sustainability!.values, { icon: "leaf", title: "New Value", text: "" }] } }));
  };
  const removeSustainabilityValue = (i: number) => {
    setContent((prev) => ({ ...prev, sustainability: { ...prev.sustainability!, values: prev.sustainability!.values.filter((_, idx) => idx !== i) } }));
  };
  const updateStyleGuide = (patch: Partial<StyleGuideContent>) => {
    setContent((prev) => ({ ...prev, style_guide: { ...prev.style_guide!, ...patch } }));
  };
  const updateStyleArticle = (i: number, patch: Partial<StyleGuideArticle>) => {
    setContent((prev) => ({ ...prev, style_guide: { ...prev.style_guide!, articles: prev.style_guide!.articles.map((a, idx) => idx === i ? { ...a, ...patch } : a) } }));
  };
  const addStyleArticle = () => {
    setContent((prev) => ({ ...prev, style_guide: { ...prev.style_guide!, articles: [...prev.style_guide!.articles, { image_url: "", category: "New", title: "New Article", text1: "", text2: "" }] } }));
  };
  const removeStyleArticle = (i: number) => {
    setContent((prev) => ({ ...prev, style_guide: { ...prev.style_guide!, articles: prev.style_guide!.articles.filter((_, idx) => idx !== i) } }));
  };
  const updateStats = (patch: Partial<StatsContent>) => {
    setContent((prev) => ({ ...prev, stats: { ...prev.stats!, ...patch } }));
  };
  const updateStatsItem = (i: number, patch: Partial<StatsItem>) => {
    setContent((prev) => ({ ...prev, stats: { ...prev.stats!, items: prev.stats!.items.map((s, idx) => idx === i ? { ...s, ...patch } : s) } }));
  };
  const addStatsItem = () => {
    setContent((prev) => ({ ...prev, stats: { ...prev.stats!, items: [...prev.stats!.items, { value: 0, suffix: "+", label: "New Stat" }] } }));
  };
  const removeStatsItem = (i: number) => {
    setContent((prev) => ({ ...prev, stats: { ...prev.stats!, items: prev.stats!.items.filter((_, idx) => idx !== i) } }));
  };
  const updateJournal = (patch: Partial<JournalContent>) => {
    setContent((prev) => ({ ...prev, journal: { ...prev.journal!, ...patch } }));
  };
  const updateJournalArticle = (i: number, patch: Partial<JournalArticle>) => {
    setContent((prev) => ({ ...prev, journal: { ...prev.journal!, articles: prev.journal!.articles.map((a, idx) => idx === i ? { ...a, ...patch } : a) } }));
  };
  const addJournalArticle = () => {
    setContent((prev) => ({ ...prev, journal: { ...prev.journal!, articles: [...prev.journal!.articles, { image_url: "", category: "New", read_time: "3 min read", title: "New Article", text: "", featured: false }] } }));
  };
  const removeJournalArticle = (i: number) => {
    setContent((prev) => ({ ...prev, journal: { ...prev.journal!, articles: prev.journal!.articles.filter((_, idx) => idx !== i) } }));
  };
  const updateInstagram = (patch: Partial<InstagramContent>) => {
    setContent((prev) => ({ ...prev, instagram: { ...prev.instagram!, ...patch } }));
  };
  const updateInstagramImage = (i: number, value: string) => {
    setContent((prev) => ({ ...prev, instagram: { ...prev.instagram!, images: prev.instagram!.images.map((img, idx) => idx === i ? value : img) } }));
  };
  const addInstagramImage = () => {
    setContent((prev) => ({ ...prev, instagram: { ...prev.instagram!, images: [...prev.instagram!.images, ""] } }));
  };
  const removeInstagramImage = (i: number) => {
    setContent((prev) => ({ ...prev, instagram: { ...prev.instagram!, images: prev.instagram!.images.filter((_, idx) => idx !== i) } }));
  };
  const updateFAQ = (patch: Partial<FAQContent>) => {
    setContent((prev) => ({ ...prev, faq: { ...prev.faq!, ...patch } }));
  };
  const updateFAQItem = (i: number, patch: Partial<FAQItem>) => {
    setContent((prev) => ({ ...prev, faq: { ...prev.faq!, items: prev.faq!.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) } }));
  };
  const addFAQItem = () => {
    setContent((prev) => ({ ...prev, faq: { ...prev.faq!, items: [...prev.faq!.items, { question: "New Question", answer: "" }] } }));
  };
  const removeFAQItem = (i: number) => {
    setContent((prev) => ({ ...prev, faq: { ...prev.faq!, items: prev.faq!.items.filter((_, idx) => idx !== i) } }));
  };
  const updateNewsletter = (patch: Partial<NewsletterContent>) => {
    setContent((prev) => ({ ...prev, newsletter: { ...prev.newsletter!, ...patch } }));
  };
  const updateTrustBadge = (i: number, patch: Partial<TrustBadgeContent>) => {
    setContent((prev) => ({ ...prev, trust_badges: (prev.trust_badges || []).map((tb, idx) => idx === i ? { ...tb, ...patch } : tb) }));
  };
  const addTrustBadge = () => {
    setContent((prev) => ({ ...prev, trust_badges: [...(prev.trust_badges || []), { icon: "check", title: "New Badge", subtext: "" }] }));
  };
  const removeTrustBadge = (i: number) => {
    setContent((prev) => ({ ...prev, trust_badges: (prev.trust_badges || []).filter((_, idx) => idx !== i) }));
  };
  const updateMarqueeBrands = (value: string) => {
    const brands = value.split("\n").map((s) => s.trim()).filter(Boolean);
    setContent((prev) => ({ ...prev, marquee_brands: brands }));
  };

  if (settingsQ.isLoading) {
    return (
      <div>
        <PageHeader title="Settings" />
        <div className="bg-white rounded-2xl border p-8 animate-pulse space-y-4 max-w-3xl">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        action={
          saveState !== "idle" && (
            <span className={`text-sm font-medium px-2.5 py-1 rounded-md ${saveState === "saving" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
              {saveState === "saving" ? "Saving..." : "Saved!"}
            </span>
          )
        }
      />

      <div className="space-y-6 max-w-3xl">
        {/* Account Info */}
        <Section title="Account" description="Your account information">
          <div className="space-y-1 text-sm text-slate-600">
            <p><span className="font-medium text-slate-900">{user?.full_name}</span> ({user?.email})</p>
            <p className="capitalize">Role: {user?.role.replace("_", " ")}</p>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Store Branding" description="Customize the look and feel of your storefront">
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Brand Color</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>
            </label>
            <TextInput label="Logo URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://example.com/logo.png" />
            <button
              onClick={handleSaveBranding}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Branding
            </button>
          </div>
        </Section>

        {/* Default Currency */}
        <Section title="Default Currency" description="The currency customers see by default when visiting your storefront">
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Default Currency</span>
              <select
                value={defaultCurrencyCode}
                onChange={(e) => setDefaultCurrencyCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              >
                <option value="">— Select a currency —</option>
                {currencies.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Customers can still switch currencies from the storefront header. Their selection is remembered across visits.
              </p>
            </label>
            <button
              onClick={handleSaveCurrency}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Default Currency
            </button>
          </div>
        </Section>

        {/* Default Language */}
        <Section title="Language Settings" description="Configure the default language and which languages your storefront supports">
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Default Language</span>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              >
                {languages.filter((l) => l.is_active).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                This is the language customers see by default when visiting your storefront.
              </p>
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Supported Languages</span>
              <p className="text-xs text-slate-400">
                Select which languages customers can switch between in the storefront header.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {languages.filter((l) => l.is_active).map((l) => {
                  const selected = supportedLanguages.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggleSupportedLanguage(l.code)}
                      className={`px-2.5 py-1 rounded-md text-sm font-medium border transition ${
                        selected
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {l.name} ({l.code})
                    </button>
                  );
                })}
              </div>
              {supportedLanguages.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No languages selected — the storefront will fall back to the default language only.
                </p>
              )}
            </div>

            <button
              onClick={handleSaveLanguage}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Language Settings
            </button>
          </div>
        </Section>

        {/* SMTP / Email */}
        <Section title="Email (SMTP) Settings" description="Configure transactional email delivery for order confirmations and notifications">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Enable Store SMTP</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When enabled, this store uses its own SMTP server. When disabled, falls back to platform-level SMTP (from env vars).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSmtpEnabled(!smtpEnabled)}
                className={`relative w-14 h-7 rounded-full transition flex-shrink-0 ${smtpEnabled ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${smtpEnabled ? "translate-x-7" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput label="SMTP Host" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.gmail.com" />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">SMTP Port</span>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput label="Username" value={smtpUser} onChange={setSmtpUser} placeholder="user@example.com" />
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput label="From Email" value={smtpFromEmail} onChange={setSmtpFromEmail} placeholder="noreply@yourstore.com" />
              <TextInput label="From Name" value={smtpFromName} onChange={setSmtpFromName} placeholder="Your Store" />
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Encryption</span>
              <select
                value={smtpEncryption}
                onChange={(e) => setSmtpEncryption(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              >
                <option value="starttls">STARTTLS (recommended, port 587)</option>
                <option value="ssl">SSL/TLS (port 465)</option>
                <option value="none">None (not recommended)</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleSaveSMTP}
                disabled={smtpSaveMut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {smtpSaveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save SMTP Settings
              </button>
            </div>

            {/* Test email */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-slate-900 text-sm">Send Test Email</h4>
              <p className="text-xs text-slate-500">Verify your SMTP configuration by sending a test email.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={smtpTestEmail}
                  onChange={(e) => setSmtpTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
                <button
                  onClick={handleTestSMTP}
                  disabled={smtpTestMut.isPending || !smtpTestEmail}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {smtpTestMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {smtpTestMut.isPending ? "Sending..." : "Send Test"}
                </button>
              </div>
              {smtpTestResult && (
                <div className={`text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${smtpTestResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {smtpTestResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}{smtpTestResult.msg}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Checkout */}
        <Section title="Checkout Settings" description="Control whether customers can purchase without an account">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Allow Guest Checkout</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When enabled, customers can purchase without registering or logging in. When disabled, customers must log in before checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnonymousCheckout(!anonymousCheckout)}
                className={`relative w-14 h-7 rounded-full transition flex-shrink-0 ${anonymousCheckout ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${anonymousCheckout ? "translate-x-7" : ""}`} />
              </button>
            </div>
            <button
              onClick={handleSaveCheckout}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Checkout Settings
            </button>
          </div>
        </Section>

        {/* Return & Refund Policy */}
        <Section title="Return & Refund Policy" description="Set how many days after delivery customers can request returns, refunds, or replacements">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-900 mb-1">Return Period (days)</label>
                <p className="text-xs text-slate-500 mb-2">General return window after delivery</p>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={returnPeriodDays}
                  onChange={(e) => setReturnPeriodDays(Math.max(1, parseInt(e.target.value) || 30))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-900 mb-1">Refund Period (days)</label>
                <p className="text-xs text-slate-500 mb-2">Refund request window after delivery</p>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={refundPeriodDays}
                  onChange={(e) => setRefundPeriodDays(Math.max(1, parseInt(e.target.value) || 30))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-900 mb-1">Replacement Period (days)</label>
                <p className="text-xs text-slate-500 mb-2">Replacement request window after delivery</p>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={replacementPeriodDays}
                  onChange={(e) => setReplacementPeriodDays(Math.max(1, parseInt(e.target.value) || 15))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              These periods start from the order&apos;s delivery date. Options for expired periods are automatically hidden from the customer dashboard and order page.
            </p>
            <button
              onClick={handleSaveReturnPolicy}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Return Policy
            </button>
          </div>
        </Section>

        {/* Storefront SEO */}
        <Section title="Storefront SEO" description="Default meta tags, Open Graph image, canonical URL, and social links for your storefront. Individual products and categories can override these.">
          <div className="space-y-4">
            <TextInput label="Meta Title" value={seoMetaTitle} onChange={setSeoMetaTitle} placeholder="Defaults to store name" />
            <TextArea label="Meta Description" value={seoMetaDescription} onChange={setSeoMetaDescription} placeholder="Defaults to 'Shop at [store name]'" rows={2} />
            <TextInput label="Open Graph Image URL" value={seoOgImage} onChange={setSeoOgImage} placeholder="Defaults to store logo" />
            <TextInput label="Site URL (Canonical Domain)" value={seoSiteUrl} onChange={setSeoSiteUrl} placeholder="https://mystore.com" />
            <TextArea label="Social Links (one per line)" value={seoSocialLinks} onChange={setSeoSocialLinks} placeholder={"https://twitter.com/mystore\nhttps://instagram.com/mystore\nhttps://facebook.com/mystore"} rows={4} />
            <button
              onClick={handleSaveSEO}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save SEO Settings
            </button>
          </div>
        </Section>

        {/* Landing Page CMS */}
        <Section
          title="Store Landing Page CMS"
          description="Configure every section of your landing page — hero, features, testimonials, editorial sections, and more"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Enable Landing Page</p>
                <p className="text-xs text-slate-500 mt-0.5">When enabled, visitors see the landing page instead of the product grid.</p>
              </div>
              <button type="button" onClick={() => setLandingEnabled(!landingEnabled)} className={`relative w-14 h-7 rounded-full transition flex-shrink-0 ${landingEnabled ? "bg-emerald-500" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${landingEnabled ? "translate-x-7" : ""}`} />
              </button>
            </div>

            {landingEnabled && (
              <div className="space-y-4 pt-2">
                {/* Tab bar */}
                <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
                  {LANDING_TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setLandingTab(tab.id)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${landingTab === tab.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-[200px]">
                  {/* Hero */}
                  {landingTab === "hero" && (
                    <div className="space-y-3">
                      <TextInput label="Hero Title" value={content.hero_title} onChange={(v) => setContent({ ...content, hero_title: v })} />
                      <TextArea label="Hero Subtitle" value={content.hero_subtitle} onChange={(v) => setContent({ ...content, hero_subtitle: v })} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <TextInput label="Button Text" value={content.hero_button_text} onChange={(v) => setContent({ ...content, hero_button_text: v })} />
                        <TextInput label="Hero Image URL" value={content.hero_image_url} onChange={(v) => setContent({ ...content, hero_image_url: v })} placeholder="https://..." />
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {landingTab === "features" && (
                    <div className="space-y-3">
                      <Toggle label="Show Features Section" checked={content.show_features} onChange={(v) => setContent({ ...content, show_features: v })} />
                      {content.show_features && content.features.map((f, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Feature {i + 1}</span><button onClick={() => removeFeature(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block space-y-1"><span className="text-xs text-slate-600">Icon</span><select value={f.icon} onChange={(e) => updateFeature(i, "icon", e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">{ICON_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                            <TextInput label="Title" value={f.title} onChange={(v) => updateFeature(i, "title", v)} />
                          </div>
                          <TextInput label="Description" value={f.text} onChange={(v) => updateFeature(i, "text", v)} />
                        </div>
                      ))}
                      {content.show_features && content.features.length < 6 && <button onClick={addFeature} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Feature</button>}
                    </div>
                  )}

                  {/* Featured Products */}
                  {landingTab === "featured" && <Toggle label="Show Featured Products" description="Display a grid of your featured products" checked={content.show_featured_products} onChange={(v) => setContent({ ...content, show_featured_products: v })} />}

                  {/* Promo */}
                  {landingTab === "promo" && (
                    <div className="space-y-3">
                      <Toggle label="Show Promo Banner" checked={content.show_promo} onChange={(v) => setContent({ ...content, show_promo: v })} />
                      {content.show_promo && (
                        <>
                          <TextInput label="Promo Title" value={content.promo_title} onChange={(v) => setContent({ ...content, promo_title: v })} />
                          <TextArea label="Promo Text" value={content.promo_text} onChange={(v) => setContent({ ...content, promo_text: v })} />
                          <TextInput label="Promo Image URL" value={content.promo_image_url} onChange={(v) => setContent({ ...content, promo_image_url: v })} placeholder="https://..." />
                        </>
                      )}
                    </div>
                  )}

                  {/* Testimonials */}
                  {landingTab === "testimonials" && (
                    <div className="space-y-3">
                      <Toggle label="Show Testimonials" checked={content.show_testimonials} onChange={(v) => setContent({ ...content, show_testimonials: v })} />
                      {content.show_testimonials && content.testimonials.map((t, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Testimonial {i + 1}</span><button onClick={() => removeTestimonial(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                          <div className="grid grid-cols-2 gap-2"><TextInput label="Name" value={t.name} onChange={(v) => updateTestimonial(i, "name", v)} /><TextInput label="Role" value={t.role} onChange={(v) => updateTestimonial(i, "role", v)} /></div>
                          <TextArea label="Quote" value={t.text} onChange={(v) => updateTestimonial(i, "text", v)} rows={2} />
                          <label className="block space-y-1"><span className="text-xs text-slate-600">Rating</span><select value={t.rating} onChange={(e) => updateTestimonial(i, "rating", parseInt(e.target.value))} className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}</select></label>
                        </div>
                      ))}
                      {content.show_testimonials && content.testimonials.length < 6 && <button onClick={addTestimonial} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Testimonial</button>}
                    </div>
                  )}

                  {/* CTA */}
                  {landingTab === "cta" && (
                    <div className="space-y-3">
                      <Toggle label="Show CTA Section" checked={content.show_cta} onChange={(v) => setContent({ ...content, show_cta: v })} />
                      {content.show_cta && (
                        <>
                          <TextInput label="CTA Title" value={content.cta_title} onChange={(v) => setContent({ ...content, cta_title: v })} />
                          <TextArea label="CTA Text" value={content.cta_text} onChange={(v) => setContent({ ...content, cta_text: v })} />
                          <TextInput label="Button Text" value={content.cta_button_text} onChange={(v) => setContent({ ...content, cta_button_text: v })} />
                        </>
                      )}
                    </div>
                  )}

                  {/* Marquee */}
                  {landingTab === "marquee" && (
                    <div className="space-y-3">
                      <Toggle label="Show Brand Marquee" checked={content.show_marquee} onChange={(v) => setContent({ ...content, show_marquee: v })} />
                      {content.show_marquee && <label className="block space-y-1"><span className="text-sm font-medium text-slate-700">Brand Names (one per line)</span><textarea value={content.marquee_brands.join("\n")} onChange={(e) => updateMarqueeBrands(e.target.value)} rows={6} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" placeholder="VOGUE&#10;GQ&#10;ELLE" /></label>}
                    </div>
                  )}

                  {/* Philosophy */}
                  {landingTab === "philosophy" && (
                    <div className="space-y-3">
                      <Toggle label="Show Fashion Philosophy" checked={content.show_philosophy} onChange={(v) => setContent({ ...content, show_philosophy: v })} />
                      {content.show_philosophy && (
                        <>
                          <TextInput label="Badge Text" value={content.philosophy_badge} onChange={(v) => setContent({ ...content, philosophy_badge: v })} />
                          <TextInput label="Title" value={content.philosophy_title} onChange={(v) => setContent({ ...content, philosophy_title: v })} />
                          <TextArea label="Paragraph 1" value={content.philosophy_text1} onChange={(v) => setContent({ ...content, philosophy_text1: v })} rows={4} />
                          <TextArea label="Paragraph 2" value={content.philosophy_text2} onChange={(v) => setContent({ ...content, philosophy_text2: v })} rows={4} />
                        </>
                      )}
                    </div>
                  )}

                  {/* Brand Story */}
                  {landingTab === "brandstory" && content.brand_story && (
                    <div className="space-y-3">
                      <Toggle label="Show Brand Story" checked={content.show_brand_story} onChange={(v) => setContent({ ...content, show_brand_story: v })} />
                      {content.show_brand_story && (
                        <>
                          <TextInput label="Title" value={content.brand_story.title} onChange={(v) => updateBrandStory({ title: v })} />
                          <TextArea label="Paragraph 1" value={content.brand_story.text1} onChange={(v) => updateBrandStory({ text1: v })} rows={3} />
                          <TextArea label="Paragraph 2" value={content.brand_story.text2} onChange={(v) => updateBrandStory({ text2: v })} rows={3} />
                          <TextInput label="Image URL" value={content.brand_story.image_url} onChange={(v) => updateBrandStory({ image_url: v })} placeholder="https://..." />
                          <div className="grid grid-cols-2 gap-3">
                            <TextInput label="Stat Value" value={content.brand_story.stat_value} onChange={(v) => updateBrandStory({ stat_value: v })} />
                            <TextInput label="Stat Label" value={content.brand_story.stat_label} onChange={(v) => updateBrandStory({ stat_label: v })} />
                          </div>
                          <TextInput label="Tags (comma separated)" value={content.brand_story.tags.join(", ")} onChange={(v) => updateBrandStory({ tags: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
                        </>
                      )}
                    </div>
                  )}

                  {/* Lookbook */}
                  {landingTab === "lookbook" && content.lookbook && (
                    <div className="space-y-3">
                      <Toggle label="Show Lookbook" checked={content.show_lookbook} onChange={(v) => setContent({ ...content, show_lookbook: v })} />
                      {content.show_lookbook && (
                        <>
                          <TextInput label="Title" value={content.lookbook.title} onChange={(v) => updateLookbook({ title: v })} />
                          <TextArea label="Subtitle" value={content.lookbook.subtitle} onChange={(v) => updateLookbook({ subtitle: v })} rows={2} />
                          {content.lookbook.items.map((item, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Look {i + 1}</span><button onClick={() => removeLookbookItem(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                              <TextInput label="Image URL" value={item.image_url} onChange={(v) => updateLookbookItem(i, { image_url: v })} placeholder="https://..." />
                              <div className="grid grid-cols-2 gap-2"><TextInput label="Category" value={item.category} onChange={(v) => updateLookbookItem(i, { category: v })} /><TextInput label="Title" value={item.title} onChange={(v) => updateLookbookItem(i, { title: v })} /></div>
                            </div>
                          ))}
                          <button onClick={addLookbookItem} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Look</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Trend Report */}
                  {landingTab === "trends" && content.trend_report && (
                    <div className="space-y-3">
                      <Toggle label="Show Trend Report" checked={content.show_trend_report} onChange={(v) => setContent({ ...content, show_trend_report: v })} />
                      {content.show_trend_report && (
                        <>
                          <TextInput label="Title" value={content.trend_report.title} onChange={(v) => updateTrendReport({ title: v })} />
                          <TextArea label="Subtitle" value={content.trend_report.subtitle} onChange={(v) => updateTrendReport({ subtitle: v })} rows={2} />
                          {content.trend_report.trends.map((t, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Trend {i + 1}</span><button onClick={() => removeTrend(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                              <div className="grid grid-cols-2 gap-2"><TextInput label="Number" value={t.number} onChange={(v) => updateTrend(i, { number: v })} /><TextInput label="Title" value={t.title} onChange={(v) => updateTrend(i, { title: v })} /></div>
                              <TextArea label="Description" value={t.text} onChange={(v) => updateTrend(i, { text: v })} rows={3} />
                            </div>
                          ))}
                          <button onClick={addTrend} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Trend</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Sustainability */}
                  {landingTab === "sustainability" && content.sustainability && (
                    <div className="space-y-3">
                      <Toggle label="Show Sustainability" checked={content.show_sustainability} onChange={(v) => setContent({ ...content, show_sustainability: v })} />
                      {content.show_sustainability && (
                        <>
                          <TextInput label="Title" value={content.sustainability.title} onChange={(v) => updateSustainability({ title: v })} />
                          <TextArea label="Subtitle" value={content.sustainability.subtitle} onChange={(v) => updateSustainability({ subtitle: v })} rows={2} />
                          {content.sustainability.values.map((val, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Value {i + 1}</span><button onClick={() => removeSustainabilityValue(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                              <label className="block space-y-1"><span className="text-xs text-slate-600">Icon</span><select value={val.icon} onChange={(e) => updateSustainabilityValue(i, { icon: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">{ICON_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                              <TextInput label="Title" value={val.title} onChange={(v) => updateSustainabilityValue(i, { title: v })} />
                              <TextInput label="Description" value={val.text} onChange={(v) => updateSustainabilityValue(i, { text: v })} />
                            </div>
                          ))}
                          <button onClick={addSustainabilityValue} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Value</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Style Guide */}
                  {landingTab === "styleguide" && content.style_guide && (
                    <div className="space-y-3">
                      <Toggle label="Show Style Guide" checked={content.show_style_guide} onChange={(v) => setContent({ ...content, show_style_guide: v })} />
                      {content.show_style_guide && (
                        <>
                          <TextInput label="Title" value={content.style_guide.title} onChange={(v) => updateStyleGuide({ title: v })} />
                          <TextArea label="Subtitle" value={content.style_guide.subtitle} onChange={(v) => updateStyleGuide({ subtitle: v })} rows={2} />
                          {content.style_guide.articles.map((a, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Article {i + 1}</span><button onClick={() => removeStyleArticle(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                              <TextInput label="Image URL" value={a.image_url} onChange={(v) => updateStyleArticle(i, { image_url: v })} placeholder="https://..." />
                              <div className="grid grid-cols-2 gap-2"><TextInput label="Category" value={a.category} onChange={(v) => updateStyleArticle(i, { category: v })} /><TextInput label="Title" value={a.title} onChange={(v) => updateStyleArticle(i, { title: v })} /></div>
                              <TextArea label="Paragraph 1" value={a.text1} onChange={(v) => updateStyleArticle(i, { text1: v })} rows={3} />
                              <TextArea label="Paragraph 2" value={a.text2} onChange={(v) => updateStyleArticle(i, { text2: v })} rows={3} />
                            </div>
                          ))}
                          <button onClick={addStyleArticle} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Article</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  {landingTab === "stats" && content.stats && (
                    <div className="space-y-3">
                      <Toggle label="Show Stats" checked={content.show_stats} onChange={(v) => setContent({ ...content, show_stats: v })} />
                      {content.show_stats && (
                        <>
                          <TextInput label="Section Title" value={content.stats.title} onChange={(v) => updateStats({ title: v })} />
                          {content.stats.items.map((s, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Stat {i + 1}</span><button onClick={() => removeStatsItem(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                              <div className="grid grid-cols-3 gap-2">
                                <label className="block space-y-1"><span className="text-xs text-slate-600">Value</span><input type="number" value={s.value} onChange={(e) => updateStatsItem(i, { value: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" /></label>
                                <TextInput label="Suffix" value={s.suffix} onChange={(v) => updateStatsItem(i, { suffix: v })} />
                                <TextInput label="Label" value={s.label} onChange={(v) => updateStatsItem(i, { label: v })} />
                              </div>
                            </div>
                          ))}
                          <button onClick={addStatsItem} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Stat</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Journal */}
                  {landingTab === "journal" && content.journal && (
                    <div className="space-y-3">
                      <Toggle label="Show Fashion Journal" checked={content.show_journal} onChange={(v) => setContent({ ...content, show_journal: v })} />
                      {content.show_journal && (
                        <>
                          <TextInput label="Title" value={content.journal.title} onChange={(v) => updateJournal({ title: v })} />
                          <TextArea label="Subtitle" value={content.journal.subtitle} onChange={(v) => updateJournal({ subtitle: v })} rows={2} />
                          {content.journal.articles.map((a, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Article {i + 1}</span><div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={a.featured} onChange={(e) => updateJournalArticle(i, { featured: e.target.checked })} /> Featured</label><button onClick={() => removeJournalArticle(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div></div>
                              <TextInput label="Image URL" value={a.image_url} onChange={(v) => updateJournalArticle(i, { image_url: v })} placeholder="https://..." />
                              <div className="grid grid-cols-2 gap-2"><TextInput label="Category" value={a.category} onChange={(v) => updateJournalArticle(i, { category: v })} /><TextInput label="Read Time" value={a.read_time} onChange={(v) => updateJournalArticle(i, { read_time: v })} /></div>
                              <TextInput label="Title" value={a.title} onChange={(v) => updateJournalArticle(i, { title: v })} />
                              <TextArea label="Text" value={a.text} onChange={(v) => updateJournalArticle(i, { text: v })} rows={3} />
                            </div>
                          ))}
                          <button onClick={addJournalArticle} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Article</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Instagram */}
                  {landingTab === "instagram" && content.instagram && (
                    <div className="space-y-3">
                      <Toggle label="Show Instagram Gallery" checked={content.show_instagram} onChange={(v) => setContent({ ...content, show_instagram: v })} />
                      {content.show_instagram && (
                        <>
                          <div className="grid grid-cols-2 gap-3"><TextInput label="Handle" value={content.instagram.handle} onChange={(v) => updateInstagram({ handle: v })} /><TextInput label="Title" value={content.instagram.title} onChange={(v) => updateInstagram({ title: v })} /></div>
                          <TextArea label="Subtitle" value={content.instagram.subtitle} onChange={(v) => updateInstagram({ subtitle: v })} rows={2} />
                          {content.instagram.images.map((img, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <TextInput label={`Image ${i + 1}`} value={img} onChange={(v) => updateInstagramImage(i, v)} placeholder="https://..." />
                              <button onClick={() => removeInstagramImage(i)} className="mt-5 text-xs text-rose-500 hover:text-rose-700 flex-shrink-0">Remove</button>
                            </div>
                          ))}
                          <button onClick={addInstagramImage} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Image</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* FAQ */}
                  {landingTab === "faq" && content.faq && (
                    <div className="space-y-3">
                      <Toggle label="Show FAQ" checked={content.show_faq} onChange={(v) => setContent({ ...content, show_faq: v })} />
                      {content.show_faq && (
                        <>
                          <TextInput label="Title" value={content.faq.title} onChange={(v) => updateFAQ({ title: v })} />
                          <TextArea label="Subtitle" value={content.faq.subtitle} onChange={(v) => updateFAQ({ subtitle: v })} rows={2} />
                          {content.faq.items.map((item, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Question {i + 1}</span><button onClick={() => removeFAQItem(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                              <TextInput label="Question" value={item.question} onChange={(v) => updateFAQItem(i, { question: v })} />
                              <TextArea label="Answer" value={item.answer} onChange={(v) => updateFAQItem(i, { answer: v })} rows={3} />
                            </div>
                          ))}
                          <button onClick={addFAQItem} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Question</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Newsletter */}
                  {landingTab === "newsletter" && content.newsletter && (
                    <div className="space-y-3">
                      <Toggle label="Show Newsletter" checked={content.show_newsletter} onChange={(v) => setContent({ ...content, show_newsletter: v })} />
                      {content.show_newsletter && (
                        <>
                          <TextInput label="Badge Text" value={content.newsletter.badge} onChange={(v) => updateNewsletter({ badge: v })} />
                          <TextInput label="Title" value={content.newsletter.title} onChange={(v) => updateNewsletter({ title: v })} />
                          <TextArea label="Subtitle" value={content.newsletter.subtitle} onChange={(v) => updateNewsletter({ subtitle: v })} rows={2} />
                          <div className="grid grid-cols-2 gap-3"><TextInput label="Placeholder" value={content.newsletter.placeholder} onChange={(v) => updateNewsletter({ placeholder: v })} /><TextInput label="Button Text" value={content.newsletter.button_text} onChange={(v) => updateNewsletter({ button_text: v })} /></div>
                          <TextArea label="Disclaimer" value={content.newsletter.disclaimer} onChange={(v) => updateNewsletter({ disclaimer: v })} rows={2} />
                        </>
                      )}
                    </div>
                  )}

                  {/* Trust Badges */}
                  {landingTab === "trust" && (
                    <div className="space-y-3">
                      <Toggle label="Show Trust Badges" checked={content.show_trust_badges} onChange={(v) => setContent({ ...content, show_trust_badges: v })} />
                      {content.show_trust_badges && (content.trust_badges || []).map((tb, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Badge {i + 1}</span><button onClick={() => removeTrustBadge(i)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
                          <label className="block space-y-1"><span className="text-xs text-slate-600">Icon</span><select value={tb.icon} onChange={(e) => updateTrustBadge(i, { icon: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">{ICON_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                          <TextInput label="Title" value={tb.title} onChange={(v) => updateTrustBadge(i, { title: v })} />
                          <TextInput label="Subtext" value={tb.subtext} onChange={(v) => updateTrustBadge(i, { subtext: v })} />
                        </div>
                      ))}
                      {content.show_trust_badges && <button onClick={addTrustBadge} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Badge</button>}
                    </div>
                  )}

                  {/* Loading Animation */}
                  {landingTab === "splash" && content.splash && (
                    <div className="space-y-4">
                      <Toggle label="Custom Loading Animation" description="Use a custom splash animation instead of the default loader" checked={content.splash.enabled} onChange={(v) => setContent({ ...content, splash: { ...content.splash!, enabled: v } })} />
                      {content.splash.enabled && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Animation Style</label>
                            <div className="grid grid-cols-5 gap-2">
                              {(["rings", "spinner", "pulse", "dots", "bars"] as const).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setContent({ ...content, splash: { ...content.splash!, style: s } })}
                                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition capitalize ${content.splash!.style === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Background Effect</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(["waves", "orbs", "none"] as const).map((b) => (
                                <button
                                  key={b}
                                  onClick={() => setContent({ ...content, splash: { ...content.splash!, background: b } })}
                                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition capitalize ${content.splash!.background === b ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                                >
                                  {b}
                                </button>
                              ))}
                            </div>
                          </div>
                          <TextInput label="Subtitle Text" value={content.splash.subtitle} onChange={(v) => setContent({ ...content, splash: { ...content.splash!, subtitle: v } })} />
                          <div className="grid grid-cols-2 gap-3">
                            <Toggle label="Show Logo Initials" checked={content.splash.show_logo} onChange={(v) => setContent({ ...content, splash: { ...content.splash!, show_logo: v } })} />
                            <Toggle label="Show Progress Bar" checked={content.splash.show_progress} onChange={(v) => setContent({ ...content, splash: { ...content.splash!, show_progress: v } })} />
                            <Toggle label="Show Loading Dots" checked={content.splash.show_dots} onChange={(v) => setContent({ ...content, splash: { ...content.splash!, show_dots: v } })} />
                          </div>
                          {/* Live preview */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                              <span className="text-xs font-medium text-slate-500">Live Preview</span>
                            </div>
                            <div className="relative h-48 bg-stone-50 overflow-hidden">
                              <MiniSplashPreview style={content.splash.style} background={content.splash.background} subtitle={content.splash.subtitle} showLogo={content.splash.show_logo} showProgress={content.splash.show_progress} showDots={content.splash.show_dots} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <button onClick={handleSaveLanding} disabled={saveMut.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                    {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saveMut.isPending ? "Saving..." : "Save Landing Page"}
                  </button>
                  <button onClick={handleUseDefaults} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition">Reset to Defaults</button>
                  <a href={`/${tenant}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition">Preview Store <ArrowRight className="w-4 h-4 inline" /></a>
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
