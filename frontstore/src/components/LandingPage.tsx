"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useInView,
} from "framer-motion";
import { ShoppingBag, ShoppingCart, ArrowRight, ArrowUpRight, Star, Truck, ShieldCheck, RefreshCw, Headphones, Quote, Sparkles, Camera, Mail, Plus, Minus, Leaf, Heart, Award, Globe, Scissors, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchProducts } from "@/lib/api";
import { OfferBanner } from "@/components/OfferBanner";
import { Header } from "@/components/Header";
import { getCurrencySymbol, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import type { BootstrapResponse, LandingPageContent, Offer, Category, BrandStoryContent, LookbookContent, TrendReportContent, SustainabilityContent, StyleGuideContent, StatsContent, JournalContent, InstagramContent, FAQContent, NewsletterContent, TrustBadgeContent } from "@/types";

// Default content — fashion-focused copy
const DEFAULT_CONTENT: LandingPageContent = {
  hero_title: "Wear the Future",
  hero_subtitle: "Bold silhouettes. Timeless craft. Step into a collection where every stitch tells a story of innovation and elegance.",
  hero_button_text: "Shop the Collection",
  hero_image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&q=85",
  features: [
    { icon: "truck", title: "Free Shipping", text: "On all orders over $50, worldwide" },
    { icon: "shield", title: "Secure Payment", text: "Bank-grade encrypted checkout" },
    { icon: "refresh", title: "Easy Returns", text: "30-day hassle-free return policy" },
    { icon: "support", title: "24/7 Support", text: "Dedicated customer care team" },
  ],
  promo_title: "Season Sale — Up to 50% Off",
  promo_text: "Don't miss our biggest sale of the season. Limited time only — refresh your wardrobe, home, and lifestyle for less.",
  promo_image_url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1400&q=85",
  testimonials: [
    { name: "Sarah Johnson", role: "Verified Buyer", text: "Amazing quality and fast shipping! The products exceeded my expectations. I'm definitely coming back for more.", rating: 5 },
    { name: "Mike Chen", role: "Verified Buyer", text: "Best online shopping experience I've had. Beautiful packaging, premium feel, and the quality is outstanding.", rating: 5 },
    { name: "Emily Davis", role: "Verified Buyer", text: "Great prices and excellent customer service. The return process was effortless. Highly recommended!", rating: 4 },
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
  marquee_brands: ["Haute Couture", "Streetwear", "Avant-Garde", "Minimalist", "Luxury", "Tailored"],
  show_philosophy: true,
  philosophy_title: "Fashion is the armor to survive the reality of everyday life",
  philosophy_text1:
    "We don't just sell clothing — we curate expressions of identity. Every collection is a dialogue between the past and the future, between tradition and rebellion, between the body you have and the person you want to become. Fashion, at its truest, is not about following trends. It's about discovering the version of yourself that hasn't been seen yet.",
  philosophy_text2:
    "Our designers travel the world studying textiles, techniques, and the cultural stories woven into every garment. From the ateliers of Milan to the textile mills of Osaka, from the indigo dyers of West Africa to the wool weavers of the Scottish Highlands — we bring the world's finest craft to your wardrobe.",
  philosophy_badge: "Established 2001",
  show_brand_story: true,
  brand_story: {
    title: "Crafted with Passion, Worn with Pride",
    text1:
      "Born from a love of timeless design and modern innovation, our atelier blends traditional tailoring with contemporary silhouettes. Every piece is thoughtfully crafted to empower the wearer — because fashion is more than clothing, it's a statement.",
    text2:
      "From sourcing the finest fabrics to the final stitch, we obsess over every detail. Our commitment to quality and sustainability drives us to create pieces that last beyond seasons.",
    image_url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=85",
    stat_value: "25+",
    stat_label: "Years of Craft",
    tags: ["Sustainable", "Handcrafted", "Ethically Sourced", "Premium Materials"],
  } as BrandStoryContent,
  show_lookbook: true,
  lookbook: {
    title: "The Autumn Edit",
    subtitle: "A curated selection of this season's most coveted pieces — styled, layered, and ready to inspire.",
    items: [
      { image_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=85", category: "Editorial", title: "The Tailored Suit" },
      { image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&q=85", category: "Street Style", title: "Urban Layers" },
      { image_url: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=600&q=85", category: "Accessories", title: "Statement Pieces" },
      { image_url: "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=600&q=85", category: "Evening", title: "Night Out" },
      { image_url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=900&q=85", category: "Minimalist", title: "Clean Lines" },
    ],
  } as LookbookContent,
  show_trend_report: true,
  trend_report: {
    title: "The Trends Defining 2026",
    subtitle: "A deep dive into the silhouettes, fabrics, and cultural shifts shaping what we wear this year.",
    trends: [
      { number: "01", title: "The Return of Tailoring", text: "After years of casual dominance, structured tailoring is back — but not as you remember it. Oversized blazers, deconstructed suits, and fluid silhouettes are redefining what formalwear means. The new tailoring is less about rigid perfection and more about effortless confidence. Think soft shoulders, relaxed fits, and fabrics that move with you. It's power dressing for a generation that values comfort as much as authority." },
      { number: "02", title: "Quiet Luxury", text: "Logo-mania is fading. In its place, a movement toward understated elegance — garments that whisper quality rather than shout it. The focus is on fabric, cut, and construction. Cashmere that feels like air, leather that ages like wine, stitching so fine it's nearly invisible. This is fashion for those who know that true luxury doesn't need a label to be recognized. It's felt in the hand, seen in the drape, and lived in over years." },
      { number: "03", title: "Texture as Statement", text: "Color is taking a backseat to texture in 2026. Boucle, shearling, quilted nylon, ribbed knits, and crinkled silks are creating depth and visual interest without relying on bold hues. The result is a tactile wardrobe that feels rich and layered even in monochrome. Mixing textures within a single outfit — a smooth silk blouse under a rough wool coat, or a sleek leather skirt paired with a chunky knit — creates dimension that photographs can't fully capture. You have to feel it." },
      { number: "04", title: "Circular Fashion", text: "The most important trend of 2026 isn't a silhouette or a fabric — it's a mindset. Circular fashion, where garments are designed to be recycled, resold, or reborn, is moving from niche to mainstream. Upcycled collections, repair programs, and resale platforms are reshaping how we think about ownership. We believe the future of fashion is not in producing more, but in producing better — pieces designed to outlive trends and find second lives with new owners." },
    ],
  } as TrendReportContent,
  show_sustainability: true,
  sustainability: {
    title: "Fashion with a Conscience",
    subtitle: "We believe great fashion shouldn't come at the planet's expense. Here's how we're making a difference.",
    values: [
      { icon: "leaf", title: "Eco Materials", text: "100% organic cotton, recycled polyester, and responsibly sourced fabrics in every collection." },
      { icon: "globe", title: "Carbon Neutral", text: "We offset 100% of our shipping emissions and use recyclable packaging for every order." },
      { icon: "heart", title: "Fair Trade", text: "Every garment is made in certified factories with fair wages and safe working conditions." },
      { icon: "award", title: "Built to Last", text: "Quality craftsmanship means pieces designed to be worn for years, not just seasons." },
    ],
  } as SustainabilityContent,
  show_style_guide: true,
  style_guide: {
    title: "How to Wear It Well",
    subtitle: "",
    articles: [
      { image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=85", category: "Layering", title: "The Art of the Layer", text1: "Layering is the foundation of a versatile wardrobe. Start with a breathable base — a fine cotton tee or silk camisole. Add a mid-layer for warmth and texture: a merino knit, a structured shirt, or a lightweight cardigan. Finish with an outer piece that defines the silhouette — an oversized blazer, a cropped leather jacket, or a long wool coat. The secret is in the proportions: balance volume with structure, and never let more than two layers compete for attention.", text2: "Color palettes should flow naturally between layers. A monochrome base with a single contrasting outer layer creates instant sophistication. When in doubt, tone-on-tone dressing — shades of the same hue — always looks intentional and refined." },
      { image_url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=85", category: "Accessories", title: "Less Is Always More", text1: "The most stylish people understand that accessories should complement, not overwhelm. A single statement piece — a sculptural pair of earrings, a quality leather belt, or a well-made watch — does more for your look than a dozen competing details. Choose accessories that tell a story: something inherited, something from a trip, something that makes you feel like the best version of yourself.", text2: "Invest in a quality everyday bag and versatile footwear first. These are the items people notice first and the ones you'll use most. A well-maintained leather bag ages beautifully and can elevate even the simplest outfit. Shoes should be clean, structured, and appropriate for the occasion — they are the foundation of every look." },
      { image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=85", category: "Capsule Wardrobe", title: "Build to Last", text1: "A capsule wardrobe is not about owning less — it's about owning better. Start with timeless foundations: a perfectly tailored blazer, a crisp white shirt, well-fitted denim, a versatile knit, and a classic coat. These five pieces form the backbone of hundreds of outfits. Add seasonal accents to reflect your personality and the moment, but never at the expense of the essentials.", text2: "Quality over quantity is the golden rule. A $300 coat worn for five years costs less per wear than a $60 coat replaced every season. Buy pieces that fit the body you have now, not the one you plan to have. And always choose fabrics that age gracefully — wool, linen, cotton, and leather develop character with time." },
    ],
  } as StyleGuideContent,
  show_stats: true,
  stats: {
    title: "",
    items: [
      { value: 0, suffix: "+", label: "Featured Products" },
      { value: 0, suffix: "", label: "Categories" },
      { value: 0, suffix: "", label: "Live Offers" },
      { value: 10, suffix: "k+", label: "Happy Customers" },
    ],
  } as StatsContent,
  show_journal: true,
  journal: {
    title: "Stories from the Atelier",
    subtitle: "",
    articles: [
      { image_url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=700&q=85", category: "Craftsmanship", read_time: "8 min read", title: "The Making of a Coat: From Sketch to Final Stitch", text: "Follow the journey of a single garment from initial sketch to the moment it leaves our atelier. Every coat passes through the hands of seven artisans, each a master of their craft. The pattern-maker translates the designer's vision into precise templates. The cutter lays the fabric with grain alignment so exact that a millimeter's deviation can alter the drape. The tailor assembles, the finisher hand-stitches the lining, and the quality controller examines every seam under natural light. It takes 47 hours and over 3,000 stitches to complete a single coat. This is not fast fashion. This is slow, deliberate, beautiful craft — the kind that produces garments meant to be worn for decades, not seasons.", featured: true },
      { image_url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=85", category: "Style", read_time: "5 min read", title: "Color Theory for Your Wardrobe", text: "Understanding color is the most powerful tool in building a wardrobe that works. Learn the difference between warm and cool undertones, how to build a capsule palette around three core colors, and why neutrals are the secret to looking effortlessly put together.", featured: false },
      { image_url: "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=600&q=85", category: "Guide", read_time: "6 min read", title: "A Fabric Guide: What to Look For", text: "Not all cotton is created equal. Not all wool keeps you warm. We break down the fabrics every wardrobe should include — from the breathability of linen to the durability of denim to the luxury of cashmere — and what to check on the label before you buy.", featured: false },
      { image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=85", category: "Seasonal", read_time: "4 min read", title: "Transitioning Your Wardrobe Between Seasons", text: "The art of seasonal dressing isn't about buying a new wardrobe every three months. It's about layering strategically, investing in transitional pieces, and knowing when to store and when to display. Here's our framework for a year-round wardrobe.", featured: false },
    ],
  } as JournalContent,
  show_instagram: true,
  instagram: {
    handle: "store",
    title: "Follow Our Journey",
    subtitle: "Tag us in your looks and get featured. Join our community of style enthusiasts.",
    images: [
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=85",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=85",
      "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=400&q=85",
      "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=400&q=85",
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=85",
      "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=85",
    ],
  } as InstagramContent,
  show_faq: true,
  faq: {
    title: "Frequently Asked Questions",
    subtitle: "",
    items: [
      { question: "How long does shipping take?", answer: "Standard shipping takes 3-5 business days within the country and 7-14 days internationally. Express shipping options are available at checkout for faster delivery." },
      { question: "What is your return policy?", answer: "We offer a 30-day hassle-free return policy on all unworn items with original tags. Returns are free for orders over $50. Simply initiate a return from your account dashboard." },
      { question: "How do I find the right size?", answer: "Each product page includes a detailed size guide. If you're between sizes, we recommend sizing up for a relaxed fit or down for a tailored look. Our support team is always happy to help with sizing questions." },
      { question: "Are your products sustainable?", answer: "Yes! We use organic cotton, recycled polyester, and responsibly sourced fabrics. All our products are made in certified factories with fair labor practices. Look for the sustainability badge on each product." },
      { question: "Do you offer gift cards?", answer: "Yes, we offer digital gift cards in denominations of $25, $50, $100, and $250. They're delivered instantly via email and never expire. Perfect for gifting fashion to friends and family." },
    ],
  } as FAQContent,
  show_newsletter: true,
  newsletter: {
    badge: "Join the Club",
    title: "Get 10% Off Your First Order",
    subtitle: "Subscribe to our newsletter for exclusive offers, early access to new collections, and styling tips delivered to your inbox.",
    placeholder: "Enter your email",
    button_text: "Subscribe",
    disclaimer: "By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.",
  } as NewsletterContent,
  show_trust_badges: true,
  trust_badges: [
    { icon: "truck", title: "Worldwide Shipping", subtext: "" },
    { icon: "shield", title: "Secure Checkout", subtext: "" },
    { icon: "refresh", title: "Easy Returns", subtext: "" },
    { icon: "support", title: "24/7 Support", subtext: "" },
  ] as TrustBadgeContent[],
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

const ICONS: Record<string, string> = {
  truck: "M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-6m6 0V10.5m-6 8.25V10.5m6 0H9.75M16.5 6.75h-3.75v3.75h3.75V6.75Z",
  shield: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  refresh: "M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 8.62 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3",
  support: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 3.83-.413c1.585-.227 2.707-1.626 2.707-3.228V6.741c0-1.602-1.122-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z",
  star: "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.98 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  heart: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z",
  check: "m4.5 12.75 6 6 9-13.5",
};

// Icon component maps for CMS-configurable sections (string -> lucide component)
const SUSTAINABILITY_ICONS: Record<string, LucideIcon> = {
  leaf: Leaf,
  globe: Globe,
  heart: Heart,
  award: Award,
};

const TRUST_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  shield: ShieldCheck,
  refresh: RefreshCw,
  support: Headphones,
};

// Curated fashion Unsplash images for category tiles
const CATEGORY_IMAGES: Record<string, string> = {
  fashion: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=85",
  apparel: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=85",
  clothing: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=85",
  electronics: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=85",
  tech: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=85",
  gadgets: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=85",
  home: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=85",
  furniture: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=85",
  decor: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=85",
  beauty: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=85",
  cosmetics: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=85",
  sports: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=85",
  fitness: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=85",
  books: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=85",
  food: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=85",
  grocery: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=85",
  toys: "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=800&q=85",
  jewelry: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=85",
  accessories: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=85",
  shoes: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=85",
  footwear: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=85",
  bags: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=85",
  watches: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&q=85",
  // Food / nuts / dates / dry fruits / chocolates
  dates: "https://images.unsplash.com/photo-1770617476915-7269d29d27dc?w=800&q=85",
  date: "https://images.unsplash.com/photo-1770617476915-7269d29d27dc?w=800&q=85",
  medjool: "https://images.unsplash.com/photo-1770617476915-7269d29d27dc?w=800&q=85",
  ajwa: "https://images.unsplash.com/photo-1770617476915-7269d29d27dc?w=800&q=85",
  nuts: "https://images.unsplash.com/photo-1514537193821-ed4955693802?w=800&q=85",
  nut: "https://images.unsplash.com/photo-1514537193821-ed4955693802?w=800&q=85",
  almond: "https://images.unsplash.com/photo-1430163393927-3dab9af7ea38?w=800&q=85",
  almonds: "https://images.unsplash.com/photo-1430163393927-3dab9af7ea38?w=800&q=85",
  cashew: "https://images.unsplash.com/photo-1598371623789-44e341c1b6ab?w=800&q=85",
  cashews: "https://images.unsplash.com/photo-1598371623789-44e341c1b6ab?w=800&q=85",
  pistachio: "https://images.unsplash.com/photo-1517244683847-7456b63c5969?w=800&q=85",
  pistachios: "https://images.unsplash.com/photo-1517244683847-7456b63c5969?w=800&q=85",
  walnut: "https://images.unsplash.com/photo-1603736029103-dafad0eb0906?w=800&q=85",
  walnuts: "https://images.unsplash.com/photo-1603736029103-dafad0eb0906?w=800&q=85",
  hazelnut: "https://images.unsplash.com/photo-1623428186374-ef0f009bbd72?w=800&q=85",
  hazelnuts: "https://images.unsplash.com/photo-1623428186374-ef0f009bbd72?w=800&q=85",
  "dry fruit": "https://images.unsplash.com/photo-1556216583-cb1ac9559189?w=800&q=85",
  "dry fruits": "https://images.unsplash.com/photo-1556216583-cb1ac9559189?w=800&q=85",
  dried: "https://images.unsplash.com/photo-1556216583-cb1ac9559189?w=800&q=85",
  apricot: "https://images.unsplash.com/photo-1556216583-cb1ac9559189?w=800&q=85",
  apricots: "https://images.unsplash.com/photo-1556216583-cb1ac9559189?w=800&q=85",
  raisin: "https://images.unsplash.com/photo-1595412017587-b7f3117dff54?w=800&q=85",
  raisins: "https://images.unsplash.com/photo-1595412017587-b7f3117dff54?w=800&q=85",
  cranberry: "https://images.unsplash.com/photo-1595412017940-94541e6b1ce7?w=800&q=85",
  cranberries: "https://images.unsplash.com/photo-1595412017940-94541e6b1ce7?w=800&q=85",
  chocolate: "https://images.unsplash.com/photo-1523035274455-b2e5c6d5c2e0?w=800&q=85",
  chocolates: "https://images.unsplash.com/photo-1523035274455-b2e5c6d5c2e0?w=800&q=85",
  cocoa: "https://images.unsplash.com/photo-1523035274455-b2e5c6d5c2e0?w=800&q=85",
  cacao: "https://images.unsplash.com/photo-1523035274455-b2e5c6d5c2e0?w=800&q=85",
  "dark chocolate": "https://images.unsplash.com/photo-1523035274455-b2e5c6d5c2e0?w=800&q=85",
  "gift box": "https://images.unsplash.com/photo-1609074458316-3e282975bb1e?w=800&q=85",
  gift: "https://images.unsplash.com/photo-1609074458316-3e282975bb1e?w=800&q=85",
  sweets: "https://images.unsplash.com/photo-1535117156854-d5c5243361a8?w=800&q=85",
  sweet: "https://images.unsplash.com/photo-1535117156854-d5c5243361a8?w=800&q=85",
  snack: "https://images.unsplash.com/photo-1600070306429-8b21d175d44d?w=800&q=85",
  snacks: "https://images.unsplash.com/photo-1600070306429-8b21d175d44d?w=800&q=85",
  organic: "https://images.unsplash.com/photo-1769255485022-f9bb6d6e8169?w=800&q=85",
  saffron: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=800&q=85",
  premium: "https://images.unsplash.com/photo-1769255485022-f9bb6d6e8169?w=800&q=85",
};

function categoryImage(cat: Category): string {
  const slug = cat.slug.toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_IMAGES)) {
    if (slug.includes(key)) return url;
  }
  return "https://images.unsplash.com/photo-1769255485022-f9bb6d6e8169?w=800&q=85";
}

const PROMO_FALLBACK = "https://images.unsplash.com/photo-1609074458316-3e282975bb1e?w=1400&q=85";

// Showcase images for the hero 3D rotating stack
const HERO_SHOWCASE = [
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=85",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=85",
  "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=85",
  "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=800&q=85",
];

interface LandingPageProps {
  bootstrap: BootstrapResponse;
  currency: string;
  setCurrency: (c: string) => void;
  lang: string;
  setLang: (l: string) => void;
}

// ===== Reusable animation helpers =====

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

// ===== 3D Tilt Card Component =====
function TiltCard({ children, className = "", intensity = 15 }: { children: React.ReactNode; className?: string; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-50, 50], [intensity, -intensity]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-intensity, intensity]), { stiffness: 300, damping: 30 });

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    x.set((px / rect.width) * 100);
    y.set((py / rect.height) * 100);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ===== 3D Tilt Card with glare overlay =====
function GlareCard({ children, className = "", intensity = 12, glareColor = "rgba(255,255,255,0.25)" }: { children: React.ReactNode; className?: string; intensity?: number; glareColor?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-50, 50], [intensity, -intensity]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-intensity, intensity]), { stiffness: 300, damping: 30 });

  // Glare position follows mouse
  const glareX = useTransform(x, [-50, 50], ["0%", "100%"]);
  const glareY = useTransform(y, [-50, 50], ["0%", "100%"]);
  const glareOpacity = useMotionValue(0);

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    x.set((px / rect.width) * 100);
    y.set((py / rect.height) * 100);
    glareOpacity.set(0.5);
  }

  function reset() {
    x.set(0);
    y.set(0);
    glareOpacity.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`relative ${className}`}
    >
      {children}
      {/* Glare overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
        style={{ opacity: glareOpacity, transform: "translateZ(1px)" }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${glareX} ${glareY}, ${glareColor}, transparent 50%)`,
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// ===== Full 3D Product Card with layered depth =====
function ProductCard3D({ product, currency, brandColor }: { product: import("@/types").Product; currency?: import("@/types").Currency; brandColor: string }) {
  const price = product.discounted_price ?? product.effective_price ?? (product.base_price || product.variants?.[0]?.price) ?? 0;
  const hasDiscount = product.discounted_price != null && (product.discount_pct ?? 0) > 0;
  const cart = useCart();
  const wishlist = useWishlist();
  const isWishlisted = wishlist?.isInWishlist(product.id) ?? false;
  const variantStock = product.variants?.reduce((sum, v) => sum + (v.stock ?? 0), 0) ?? 0;
  const stock = product.stock || variantStock;
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= (product.low_stock_threshold ?? 5);
  const displayImage = product.image_url || product.images?.[0]?.url || product.variants?.[0]?.image_url;

  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-50, 50], [12, -12]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-12, 12]), { stiffness: 300, damping: 30 });

  // Glare follows mouse
  const glareX = useTransform(x, [-50, 50], ["0%", "100%"]);
  const glareY = useTransform(y, [-50, 50], ["0%", "100%"]);
  const glareOpacity = useMotionValue(0);

  // Card lift on hover
  const liftZ = useSpring(useTransform(glareOpacity, [0, 0.5], [0, 30]), { stiffness: 200, damping: 20 });

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    x.set((px / rect.width) * 100);
    y.set((py / rect.height) * 100);
    glareOpacity.set(0.35);
  }

  function reset() {
    x.set(0);
    y.set(0);
    glareOpacity.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", zIndex: liftZ }}
      className="relative h-full"
    >
      <Link
        href={`/products/${product.slug}`}
        className="group block h-full bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow duration-300 border border-stone-200"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Image layer — base depth */}
        <div className="relative aspect-square bg-stone-100 overflow-hidden" style={{ transform: "translateZ(0px)" }}>
          {displayImage ? (
            <Image
              src={displayImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <ShoppingBag className="w-12 h-12" strokeWidth={1} />
            </div>
          )}
          {/* Subtle gradient at bottom of image for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        </div>

        {/* Badges layer — floats above image */}
        <div className="absolute top-3 left-3 flex flex-col gap-2" style={{ transform: "translateZ(40px)" }}>
          {hasDiscount && (
            <span className="bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              -{Math.round(product.discount_pct!)}%
            </span>
          )}
          {product.is_featured && !hasDiscount && !outOfStock && (
            <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              Featured
            </span>
          )}
          {outOfStock && (
            <span className="bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              Out of Stock
            </span>
          )}
          {lowStock && !outOfStock && (
            <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              Only {stock} left
            </span>
          )}
        </div>

        {/* Wishlist button — highest depth, floats above everything */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            wishlist?.toggleItem(product.id);
          }}
          className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isWishlisted
              ? "bg-rose-500 text-white"
              : "bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white hover:text-rose-500"
          }`}
          style={{ transform: "translateZ(60px)" }}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg className="w-5 h-5" fill={isWishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        </button>

        {/* Info section — mid depth, pops above image */}
        <div className="p-4 sm:p-5 space-y-2" style={{ transform: "translateZ(25px)" }}>
          <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">{product.category_slug || "General"}</p>
          <h3 className="font-semibold text-sm sm:text-base text-gray-900 line-clamp-2 group-hover:text-gray-700 transition-colors">
            {product.name}
          </h3>
          {product.rating > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-base sm:text-lg font-bold text-gray-900">{formatPrice(price, currency)}</span>
              {hasDiscount && (
                <span className="text-xs sm:text-sm text-gray-400 line-through">
                  {formatPrice(product.effective_price ?? product.base_price, currency)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Add to cart button — floats at highest depth, slides up on hover */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5" style={{ transform: "translateZ(50px)" }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!outOfStock) cart?.addItem(product.id, undefined, 1, price, currency?.code);
            }}
            disabled={outOfStock}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
              outOfStock
                ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                : "text-white shadow-lg hover:shadow-xl"
            }`}
            style={!outOfStock ? { backgroundColor: brandColor } : undefined}
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            {outOfStock ? "Sold Out" : "Add to Cart"}
          </button>
        </div>

        {/* Glare overlay — follows mouse */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
          style={{ opacity: glareOpacity }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.4), transparent 50%)`,
            }}
          />
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ===== Animated counter =====
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const duration = 1500;
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * to));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ===== Word-by-word text reveal =====
function WordReveal({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "100%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: delay + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            {word}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// ===== Hero 3D rotating showcase =====
function HeroShowcase({ scrollProgress, brandColor, images }: { scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"]; brandColor: string; images: string[] }) {
  const [active, setActive] = useState(0);
  const rotateY = useTransform(scrollProgress, [0, 1], [0, 25]);
  const rotateX = useTransform(scrollProgress, [0, 1], [0, 10]);
  const showcaseY = useTransform(scrollProgress, [0, 1], [0, -80]);
  const showcaseScale = useTransform(scrollProgress, [0, 1], [1, 0.9]);

  // Auto-rotate showcase images
  useEffect(() => {
    const t = setInterval(() => {
      setActive((a) => (a + 1) % images.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      style={{ y: showcaseY, scale: showcaseScale, rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="relative w-full max-w-md mx-auto"
    >
      {/* Main showcase card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, rotateY: -15 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl"
        style={{ transform: "translateZ(60px)" }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={images[active]}
              alt="Fashion showcase"
              fill
              sizes="(max-width: 1024px) 100vw, 500px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Floating brand badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute top-5 left-5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider"
          style={{ color: brandColor, transform: "translateZ(40px)" }}
        >
          New Collection
        </motion.div>

        {/* Image counter */}
        <div className="absolute bottom-5 left-5 flex items-center gap-2" style={{ transform: "translateZ(40px)" }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-8 bg-white" : "w-1.5 bg-white/40"}`}
              aria-label={`Showcase image ${i + 1}`}
            />
          ))}
        </div>
      </motion.div>

      {/* Floating accent card — top right */}
      <motion.div
        initial={{ opacity: 0, x: 40, y: -20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -top-6 -right-6 w-32 h-40 rounded-2xl overflow-hidden shadow-xl hidden sm:block"
        style={{ transform: "translateZ(100px)" }}
      >
        <Image
          src={images[(active + 1) % images.length]}
          alt=""
          fill
          sizes="200px"
          className="object-cover"
        />
      </motion.div>

      {/* Floating accent card — bottom left */}
      <motion.div
        initial={{ opacity: 0, x: -40, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -bottom-8 -left-8 w-36 h-44 rounded-2xl overflow-hidden shadow-xl hidden sm:block"
        style={{ transform: "translateZ(80px)" }}
      >
        <Image
          src={images[(active + 2) % images.length]}
          alt=""
          fill
          sizes="200px"
          className="object-cover"
        />
      </motion.div>

      {/* Floating rating badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute -bottom-5 right-4 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2"
        style={{ transform: "translateZ(120px)" }}
      >
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900">4.9</p>
          <p className="text-[10px] text-gray-400">10k+ reviews</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== FAQ Accordion Item =====
function FAQItem({ question, answer, brandColor, defaultOpen = false }: { question: string; answer: string; brandColor: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-stone-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 lg:py-6 text-left group"
      >
        <span className="text-base lg:text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">{question}</span>
        <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-stone-300 group-hover:border-gray-900 transition-colors" style={{ borderColor: open ? brandColor : undefined, color: open ? brandColor : undefined }}>
          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 lg:pb-6 text-sm lg:text-base text-gray-500 leading-relaxed pr-12">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Newsletter Form =====
function NewsletterForm({ brandColor, placeholder = "Enter your email", buttonText = "Subscribe" }: { brandColor: string; placeholder?: string; buttonText?: string }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setEmail("");
    setTimeout(() => setSubmitted(false), 4000);
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <div className="relative flex-1">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-4 rounded-full bg-white border border-stone-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition-colors"
        />
      </div>
      <button
        type="submit"
        className="px-8 py-4 rounded-full text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
        style={{ backgroundColor: brandColor }}
      >
        {submitted ? "Subscribed!" : buttonText}
      </button>
    </form>
  );
}

// ===== Animated Background: Floating Orbs =====
function FloatingOrbs({ brandColor, variant = "default" }: { brandColor: string; variant?: "default" | "subtle" | "warm" }) {
  const opacity = variant === "subtle" ? 0.08 : variant === "warm" ? 0.12 : 0.1;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full blur-3xl animate-orb-1" style={{ backgroundColor: `${brandColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-3xl animate-orb-2" style={{ backgroundColor: `${brandColor}${Math.round(opacity * 200).toString(16).padStart(2, "0")}` }} />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full blur-3xl animate-orb-3" style={{ backgroundColor: `${brandColor}${Math.round(opacity * 150).toString(16).padStart(2, "0")}` }} />
    </div>
  );
}

// ===== Animated Background: Drifting Dot Grid =====
function DotGrid({ color = "#d6d3d1", size = 24 }: { color?: string; size?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-[-50px] animate-grid-drift"
        style={{
          backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
          opacity: 0.5,
        }}
      />
    </div>
  );
}

// ===== Animated Background: Mesh Gradient =====
function MeshGradient({ brandColor }: { brandColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-0 w-full h-full animate-mesh-shift" style={{ background: `radial-gradient(ellipse at 20% 30%, ${brandColor}06, transparent 50%), radial-gradient(ellipse at 80% 70%, ${brandColor}08, transparent 50%), radial-gradient(ellipse at 50% 50%, ${brandColor}04, transparent 60%)` }} />
    </div>
  );
}

// ===== Animated Background: Shimmer Sweep =====
function ShimmerSweep({ brandColor }: { brandColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-0 w-[40%] h-full animate-bg-sweep" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}06, transparent)` }} />
    </div>
  );
}

// ===== Animated Background: Conic Glow =====
function ConicGlow({ brandColor }: { brandColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
      <div className="w-[800px] h-[800px] rounded-full opacity-[0.06] animate-conic-spin" style={{ background: `conic-gradient(from 0deg, ${brandColor}, transparent, ${brandColor}, transparent, ${brandColor})` }} />
    </div>
  );
}

// ===== Animated Background: Wave Lines =====
function WaveLines({ color = "#4f46e5" }: { color?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none">
        {/* Wave 1 — top area, slow drift */}
        <g className="animate-wave-1">
          <path
            d="M-100,180 Q200,120 480,180 T960,180 T1440,180 T1920,180"
            stroke={color}
            strokeWidth="1.5"
            className="animate-wave-pulse"
            style={{ strokeOpacity: 0.1 }}
          />
          <path
            d="M-100,220 Q200,160 480,220 T960,220 T1440,220 T1920,220"
            stroke={color}
            strokeWidth="1"
            style={{ strokeOpacity: 0.06 }}
          />
        </g>

        {/* Wave 2 — middle area, opposite drift */}
        <g className="animate-wave-2">
          <path
            d="M-100,420 Q260,360 540,420 T1020,420 T1500,420 T1980,420"
            stroke={color}
            strokeWidth="2"
            className="animate-wave-pulse"
            style={{ strokeOpacity: 0.08, animationDelay: "2s" }}
          />
          <path
            d="M-100,470 Q260,410 540,470 T1020,470 T1500,470 T1980,470"
            stroke={color}
            strokeWidth="1"
            style={{ strokeOpacity: 0.05 }}
          />
          <path
            d="M-100,520 Q260,460 540,520 T1020,520 T1500,520 T1980,520"
            stroke={color}
            strokeWidth="1"
            style={{ strokeOpacity: 0.04 }}
          />
        </g>

        {/* Wave 3 — lower area, slowest drift */}
        <g className="animate-wave-3">
          <path
            d="M-100,680 Q220,620 500,680 T980,680 T1460,680 T1940,680"
            stroke={color}
            strokeWidth="1.5"
            className="animate-wave-pulse"
            style={{ strokeOpacity: 0.09, animationDelay: "4s" }}
          />
          <path
            d="M-100,730 Q220,670 500,730 T980,730 T1460,730 T1940,730"
            stroke={color}
            strokeWidth="1"
            style={{ strokeOpacity: 0.05 }}
          />
        </g>

        {/* Subtle vertical accent lines */}
        <g style={{ opacity: 0.04 }}>
          <line x1="200" y1="0" x2="200" y2="900" stroke={color} strokeWidth="1" />
          <line x1="720" y1="0" x2="720" y2="900" stroke={color} strokeWidth="1" />
          <line x1="1240" y1="0" x2="1240" y2="900" stroke={color} strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

export function LandingPage({ bootstrap, currency, setCurrency, lang, setLang }: LandingPageProps) {
  const content = bootstrap.settings?.landing_page_content ?? DEFAULT_CONTENT;
  const brandColor = bootstrap.settings?.brand_color || "#4f46e5";
  const offers: Offer[] = bootstrap.offers || [];
  const currencyObj = getCurrencySymbol(bootstrap.currencies || [], currency);
  const categories = bootstrap.categories || [];
  const promoImage = content.promo_image_url || PROMO_FALLBACK;

  // Derive hero showcase images from content (lookbook, journal, hero image)
  const heroShowcaseImages = [
    content.hero_image_url,
    ...(content.lookbook?.items?.map((i) => i.image_url) || []),
    ...(content.journal?.articles?.map((a) => a.image_url) || []),
  ].filter(Boolean);
  const showcaseImages = heroShowcaseImages.length >= 3 ? heroShowcaseImages : HERO_SHOWCASE;

  // Scroll progress for hero parallax
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);
  const textY = useTransform(heroProgress, [0, 1], [0, -100]);

  // Scroll progress for promo parallax
  const promoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: promoProgress } = useScroll({ target: promoRef, offset: ["start end", "end start"] });
  const promoY = useTransform(promoProgress, [0, 1], [-50, 50]);

  // Fetch featured products
  const featuredQ = useQuery({
    queryKey: ["landing-featured", currency, lang],
    queryFn: () => fetchProducts({ featured: true, limit: 8, currency }, lang),
    enabled: content.show_featured_products,
  });

  // Fetch new arrivals
  const newArrivalsQ = useQuery({
    queryKey: ["landing-new", currency, lang],
    queryFn: () => fetchProducts({ limit: 4, currency }, lang),
    enabled: categories.length > 0,
  });

  const featuredProducts = featuredQ.data?.items ?? [];
  const newArrivals = newArrivalsQ.data?.items?.slice(0, 4) ?? [];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header
       
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* ===== HERO — 3D Split Layout with Rotating Showcase ===== */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden perspective-2000 bg-stone-50">
        {/* Animated background layers */}
        <motion.div style={{ opacity: heroOpacity }} className="absolute inset-0 z-0">
          <FloatingOrbs brandColor={brandColor} variant="default" />
          <WaveLines color={brandColor} />
          <ConicGlow brandColor={brandColor} />
        </motion.div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 lg:pt-20 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center min-h-[80vh]">

            {/* Left — Text content */}
            <motion.div
              style={{ y: textY }}
              className="space-y-6 lg:space-y-8 order-2 lg:order-1"
            >
              {/* Season badge */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center gap-3"
              >
                <span className="h-px w-12" style={{ backgroundColor: brandColor }} />
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-500">Autumn / Winter 2026</span>
              </motion.div>

              {/* Title */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[0.95] tracking-tight text-gray-900">
                <WordReveal text={content.hero_title} delay={0.4} />
              </h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
                className="text-lg lg:text-xl text-gray-500 max-w-lg font-light leading-relaxed"
              >
                {content.hero_subtitle}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="flex flex-wrap items-center gap-4"
              >
                <Link
                  href={`/?view=shop`}
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-medium text-base shadow-lg hover:shadow-xl hover:gap-4 transition-all duration-300"
                  style={{ backgroundColor: brandColor }}
                >
                  {content.hero_button_text}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
                <Link
                  href="#categories"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-stone-300 text-gray-700 font-medium text-base hover:border-gray-900 hover:text-gray-900 transition-all duration-300"
                >
                  Explore
                </Link>
              </motion.div>

              {/* Mini stats row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.4 }}
                className="flex items-center gap-6 lg:gap-10 pt-4 lg:pt-6"
              >
                <div>
                  <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                    <Counter to={featuredQ.data?.items?.length ?? 0} suffix="+" />
                  </p>
                  <p className="text-xs lg:text-sm text-gray-400 uppercase tracking-wider mt-1">Products</p>
                </div>
                <div className="w-px h-12 bg-stone-200" />
                <div>
                  <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                    <Counter to={categories.length} />
                  </p>
                  <p className="text-xs lg:text-sm text-gray-400 uppercase tracking-wider mt-1">Categories</p>
                </div>
                <div className="w-px h-12 bg-stone-200" />
                <div>
                  <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                    <Counter to={10} suffix="k+" />
                  </p>
                  <p className="text-xs lg:text-sm text-gray-400 uppercase tracking-wider mt-1">Customers</p>
                </div>
              </motion.div>
            </motion.div>

            {/* Right — 3D Rotating Showcase */}
            <div className="order-1 lg:order-2 perspective-2000">
              <HeroShowcase scrollProgress={heroProgress} brandColor={brandColor} images={showcaseImages} />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
        >
          <span className="text-xs text-gray-400 uppercase tracking-widest">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-px h-10 bg-gradient-to-b from-gray-400 to-transparent"
          />
        </motion.div>
      </section>

      {/* ===== Brand Marquee Ticker ===== */}
      {content.show_marquee && (content.marquee_brands?.length ?? 0) > 0 && (
        <section className="bg-stone-100 border-y border-stone-200 py-6 overflow-hidden">
          <div className="flex animate-marquee-x whitespace-nowrap">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex items-center gap-16 px-8 text-2xl lg:text-4xl font-bold text-stone-300 uppercase tracking-widest">
                {content.marquee_brands.map((brand, i) => (
                  <span key={`${dup}-${i}`} className="contents">
                    <span>{brand}</span>
                    <span className="text-stone-200">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Offer Banner ===== */}
      {offers.length > 0 && <OfferBanner offers={offers} />}

      {/* ===== Fashion Philosophy — Editorial Text ===== */}
      {content.show_philosophy && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <MeshGradient brandColor={brandColor} />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Our Philosophy</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-[1.15]">
                <WordReveal text={content.philosophy_title} />
              </h2>
              <div className="space-y-4 text-base lg:text-lg text-gray-500 leading-relaxed font-light max-w-2xl mx-auto">
                <p>
                  {content.philosophy_text1}
                </p>
                <p>
                  {content.philosophy_text2}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-4">
                <span className="h-px w-12 bg-stone-300" />
                <span className="text-sm font-medium italic text-gray-400">{content.philosophy_badge}</span>
                <span className="h-px w-12 bg-stone-300" />
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Brand Story — Parallax Editorial ===== */}
      {content.show_brand_story && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <DotGrid color="#e7e5e4" size={28} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
              {/* Image side */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-xl">
                  <Image
                    src={content.brand_story?.image_url || "https://images.unsplash.com/photo-1769255485022-f9bb6d6e8169?w=900&q=85"}
                    alt="Brand story"
                    fill
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                {/* Floating accent image */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 30 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-8 -right-4 lg:-right-8 w-40 h-52 lg:w-48 lg:h-60 rounded-2xl overflow-hidden shadow-2xl border-4 border-white"
                >
                  <Image
                    src={(content.lookbook?.items?.[1]?.image_url) || (content.journal?.articles?.[1]?.image_url) || (content.lookbook?.items?.[0]?.image_url) || "https://images.unsplash.com/photo-1514537193821-ed4955693802?w=400&q=85"}
                    alt="Detail"
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </motion.div>
                {/* Floating stat badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="absolute -top-6 -left-4 lg:-left-6 bg-white rounded-2xl shadow-xl px-5 py-4"
                >
                  <p className="text-3xl font-bold" style={{ color: brandColor }}>{content.brand_story?.stat_value}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{content.brand_story?.stat_label}</p>
                </motion.div>
              </motion.div>

              {/* Text side */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <Scissors className="w-5 h-5" style={{ color: brandColor }} />
                  <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Our Story</span>
                </div>
                <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 tracking-tight leading-[1.05]">
                  <WordReveal text={content.brand_story?.title || ""} />
                </h2>
                <p className="text-base lg:text-lg text-gray-500 leading-relaxed font-light">
                  {content.brand_story?.text1}
                </p>
                <p className="text-base lg:text-lg text-gray-500 leading-relaxed font-light">
                  {content.brand_story?.text2}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {(content.brand_story?.tags || []).map((tag) => (
                    <span key={tag} className="px-4 py-2 rounded-full bg-stone-100 border border-stone-200 text-sm font-medium text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/about`}
                  className="group inline-flex items-center gap-2 text-sm font-medium pt-2 transition-colors"
                  style={{ color: brandColor }}
                >
                  Read our full story
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Features Strip — 3D Cards ===== */}
      {content.show_features && content.features && content.features.length > 0 && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <ShimmerSweep brandColor={brandColor} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 perspective-1000"
            >
              {content.features.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TiltCard intensity={10} className="group h-full">
                    <div className="h-full bg-gradient-to-br from-stone-50 to-white border border-stone-200 rounded-2xl p-6 lg:p-8 hover:border-stone-300 hover:shadow-lg transition-all duration-300" style={{ transform: "translateZ(40px)" }}>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300"
                        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[feature.icon] || ICONS.check} />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-base lg:text-lg text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{feature.text}</p>
                    </div>
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Category Showcase — 3D Tilt Cards ===== */}
      {categories.length > 0 && (
        <section id="categories" className="relative bg-stone-50 py-20 lg:py-32 overflow-hidden">
          <FloatingOrbs brandColor={brandColor} variant="subtle" />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-end justify-between mb-10 lg:mb-16 gap-4"
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Browse by</span>
                <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                  <WordReveal text="Shop by Category" />
                </h2>
              </div>
              <Link
                href={`/?view=shop`}
                className="group text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition-colors"
              >
                View all
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
              </Link>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6 perspective-1000"
            >
              {categories.slice(0, 8).map((cat) => (
                <motion.div key={cat.id} variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                  <GlareCard intensity={12} glareColor="rgba(255,255,255,0.3)">
                    <Link href={`/?category=${cat.slug}`} className="group block">
                      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md" style={{ transform: "translateZ(30px)" }}>
                        <Image
                          src={categoryImage(cat)}
                          alt={cat.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5" style={{ transform: "translateZ(40px)" }}>
                          <h3 className="font-semibold text-base lg:text-xl text-white">{cat.name}</h3>
                          <p className="text-xs text-white/70 mt-1 line-clamp-1 hidden sm:block">{cat.description || "Explore collection"}</p>
                          <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300" style={{ transform: "translateZ(50px)" }}>
                            Shop now <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </GlareCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Featured Products ===== */}
      {content.show_featured_products && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <DotGrid color="#f5f5f4" size={30} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-end justify-between mb-10 lg:mb-16 gap-4"
            >
              <div className="min-w-0">
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Hand-picked</span>
                <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                  <WordReveal text="Featured Products" />
                </h2>
              </div>
              <Link
                href={`/?view=shop`}
                className="group text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition-colors"
              >
                View all
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
              </Link>
            </motion.div>

            {featuredQ.isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-stone-50 rounded-2xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-stone-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-stone-200 rounded w-1/3" />
                      <div className="h-4 bg-stone-200 rounded w-3/4" />
                      <div className="h-5 bg-stone-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6 perspective-1000"
              >
                {featuredProducts.map((p) => (
                  <motion.div key={p.id} variants={fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                    <ProductCard3D product={p} currency={currencyObj} brandColor={brandColor} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-16 lg:py-24 text-gray-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-stone-300" strokeWidth={1} />
                <p className="text-lg font-medium">No featured products yet</p>
                <p className="text-sm mt-1">Mark products as featured in the backoffice to show them here</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Lookbook — Editorial Grid ===== */}
      {content.show_lookbook && (content.lookbook?.items?.length ?? 0) > 0 && (
        <section className="bg-white py-20 lg:py-32">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-10 lg:mb-16"
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Lookbook</span>
              <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                <WordReveal text={content.lookbook?.title || ""} />
              </h2>
              <p className="text-base lg:text-lg text-gray-500 max-w-xl mx-auto mt-4 font-light">
                {content.lookbook?.subtitle}
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5"
            >
              {(content.lookbook?.items || []).map((item, i) => {
                const layoutClass =
                  i === 0
                    ? "row-span-2 relative group rounded-2xl overflow-hidden aspect-[3/4] lg:aspect-auto"
                    : i === 1
                    ? "col-span-2 relative group rounded-2xl overflow-hidden aspect-[16/9]"
                    : i === 4
                    ? "col-span-2 relative group rounded-2xl overflow-hidden aspect-[16/9]"
                    : "relative group rounded-2xl overflow-hidden aspect-square";
                return (
                  <motion.div key={i} variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className={layoutClass}>
                    <Image src={item.image_url} alt={item.title} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6">
                      <p className="text-xs uppercase tracking-widest text-white/60">{item.category}</p>
                      <h3 className="text-lg lg:text-2xl font-bold text-white mt-1">{item.title}</h3>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            <div className="text-center mt-10 lg:mt-14">
              <Link
                href={`/?view=shop`}
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full border border-stone-300 text-gray-700 font-medium text-base hover:border-gray-900 hover:text-gray-900 transition-all duration-300"
              >
                View Full Lookbook
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== Trend Report — Editorial Text ===== */}
      {content.show_trend_report && (content.trend_report?.trends?.length ?? 0) > 0 && (
        <section className="relative bg-stone-50 py-20 lg:py-32 overflow-hidden">
          <MeshGradient brandColor={brandColor} />
          <ShimmerSweep brandColor={brandColor} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              {/* Left — heading */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-4 lg:sticky lg:top-32 lg:self-start"
              >
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Trend Report</span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight mt-4 leading-[1.1]">
                  {content.trend_report?.title}
                </h2>
                <p className="text-sm text-gray-500 mt-4 leading-relaxed">
                  {content.trend_report?.subtitle}
                </p>
              </motion.div>

              {/* Right — trend articles */}
              <div className="lg:col-span-8 space-y-10">
                {(content.trend_report?.trends || []).map((trend, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="border-l-2 border-stone-200 pl-6 lg:pl-8 hover:border-stone-400 transition-colors duration-300"
                    style={{ borderLeftColor: i === 0 ? brandColor : undefined }}
                  >
                    <div className="flex items-baseline gap-4 mb-3">
                      <span className="text-3xl lg:text-4xl font-bold text-stone-200 tabular-nums">{trend.number}</span>
                      <h3 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">{trend.title}</h3>
                    </div>
                    <p className="text-sm lg:text-base text-gray-500 leading-relaxed">{trend.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Promo Banner — Parallax Cinematic ===== */}
      {content.show_promo && content.promo_title && (
        <section ref={promoRef} className="relative h-[60vh] min-h-[500px] overflow-hidden">
          <motion.div style={{ y: promoY }} className="absolute inset-0 scale-110">
            <Image
              src={promoImage}
              alt={content.promo_title}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
          </motion.div>

          <div className="relative h-full flex items-center max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium uppercase tracking-[0.2em] text-white">
                <Sparkles className="w-3.5 h-3.5" />
                Limited Time
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-white">
                <WordReveal text={content.promo_title} />
              </h2>
              <p className="text-lg lg:text-xl text-white/80 font-light leading-relaxed">{content.promo_text}</p>
              <Link
                href={`/?view=shop`}
                className="group inline-flex items-center gap-2 mt-4 bg-white px-8 py-4 rounded-full font-medium text-base text-gray-900 hover:gap-4 transition-all duration-300 shadow-lg"
              >
                Shop the Sale
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== New Arrivals ===== */}
      {newArrivals.length > 0 && (
        <section className="relative bg-stone-50 py-20 lg:py-32 overflow-hidden">
          <FloatingOrbs brandColor={brandColor} variant="subtle" />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-end justify-between mb-10 lg:mb-16 gap-4"
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Just In</span>
                <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                  <WordReveal text="New Arrivals" />
                </h2>
              </div>
              <Link
                href={`/?view=shop`}
                className="group text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition-colors"
              >
                View all
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
              </Link>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 perspective-1000"
            >
              {newArrivals.map((p) => (
                <motion.div key={p.id} variants={fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                  <ProductCard3D product={p} currency={currencyObj} brandColor={brandColor} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Sustainability / Values ===== */}
      {content.show_sustainability && (content.sustainability?.values?.length ?? 0) > 0 && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <ConicGlow brandColor={brandColor} />
          <DotGrid color="#f5f5f4" size={36} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-12 lg:mb-20"
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Our Values</span>
              <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                <WordReveal text={content.sustainability?.title || ""} />
              </h2>
              <p className="text-base lg:text-lg text-gray-500 max-w-2xl mx-auto mt-4 font-light">
                {content.sustainability?.subtitle}
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8"
            >
              {(content.sustainability?.values || []).map((item, i) => {
                const Icon = SUSTAINABILITY_ICONS[item.icon] || Leaf;
                return (
                  <motion.div key={i} variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                    <TiltCard intensity={8} className="group h-full">
                      <div className="h-full bg-stone-50 border border-stone-200 rounded-2xl p-6 lg:p-8 hover:shadow-lg transition-all duration-300" style={{ transform: "translateZ(30px)" }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: `${brandColor}12`, color: brandColor }}>
                          <Icon className="w-7 h-7" strokeWidth={1.5} />
                        </div>
                        <h3 className="font-semibold text-base lg:text-lg text-gray-900 mb-3">{item.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
                      </div>
                    </TiltCard>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Style Guide — Editorial Tips ===== */}
      {content.show_style_guide && (content.style_guide?.articles?.length ?? 0) > 0 && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <MeshGradient brandColor={brandColor} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-12 lg:mb-20"
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Style Guide</span>
              <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                <WordReveal text={content.style_guide?.title || ""} />
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
              {(content.style_guide?.articles || []).map((article, i) => (
                <motion.article
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                    <Image
                      src={article.image_url}
                      alt={article.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">{article.category}</span>
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">{article.title}</h3>
                  <p className="text-sm lg:text-base text-gray-500 leading-relaxed">
                    {article.text1}
                  </p>
                  <p className="text-sm lg:text-base text-gray-500 leading-relaxed">
                    {article.text2}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Stats Counter Section ===== */}
      {content.show_stats && (
        <section className="relative bg-white border-y border-stone-200 py-16 lg:py-24 overflow-hidden">
          <ConicGlow brandColor={brandColor} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {(content.stats?.items && content.stats.items.length > 0
              ? content.stats.items
              : [
                  { value: featuredQ.data?.items?.length ?? 0, suffix: "+", label: "Featured Products" },
                  { value: categories.length, suffix: "", label: "Categories" },
                  { value: offers.length, suffix: "", label: "Live Offers" },
                  { value: 10, suffix: "k+", label: "Happy Customers" },
                ]
            ).map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <p className="text-4xl lg:text-6xl font-bold tracking-tight" style={{ color: brandColor }}>
                  <Counter to={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm lg:text-base text-gray-500 mt-2 uppercase tracking-wider">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Testimonials — 3D Cards ===== */}
      {content.show_testimonials && content.testimonials && content.testimonials.length > 0 && (
        <section className="bg-white py-20 lg:py-32">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-12 lg:mb-20"
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Reviews</span>
              <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                <WordReveal text="What Our Customers Say" />
              </h2>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8 perspective-1000"
            >
              {content.testimonials.map((t, i) => (
                <motion.div key={i} variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                  <TiltCard intensity={8}>
                    <div className="relative bg-gradient-to-br from-stone-50 to-white border border-stone-200 rounded-2xl p-6 lg:p-8 hover:border-stone-300 hover:shadow-lg transition-all duration-300" style={{ transform: "translateZ(30px)" }}>
                      <Quote className="absolute top-6 right-6 w-8 h-8 text-stone-200" />
                      <div className="flex gap-1 mb-5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} className={`w-4 h-4 ${s < t.rating ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200"}`} />
                        ))}
                      </div>
                      <p className="text-base text-gray-600 leading-relaxed mb-6 font-light">&ldquo;{t.text}&rdquo;</p>
                      <div className="flex items-center gap-3 pt-4 border-t border-stone-200">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base flex-shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          {t.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Fashion Journal — Blog Preview ===== */}
      {content.show_journal && (content.journal?.articles?.length ?? 0) > 0 && (
        <section className="relative bg-stone-50 py-20 lg:py-32 overflow-hidden">
          <FloatingOrbs brandColor={brandColor} variant="warm" />
          <DotGrid color="#e7e5e4" size={32} />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 lg:mb-16"
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">The Journal</span>
                <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                  <WordReveal text={content.journal?.title || ""} />
                </h2>
              </div>
              <Link
                href="#"
                className="group inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
              >
                Read all articles
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {(content.journal?.articles || []).map((article, i) => {
                const isFeatured = article.featured || i === 0;
                return (
                  <motion.article
                    key={i}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className={`${isFeatured ? "md:col-span-2 lg:col-span-1 lg:row-span-2" : ""} group cursor-pointer`}
                  >
                    <div className={`relative ${isFeatured ? "aspect-[4/5]" : "aspect-[16/10]"} rounded-2xl overflow-hidden mb-5`}>
                      <Image
                        src={article.image_url}
                        alt={article.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full" style={{ backgroundColor: `${brandColor}12`, color: brandColor }}>{article.category}</span>
                      <span className="text-xs text-gray-400">{article.read_time}</span>
                    </div>
                    <h3 className={`${isFeatured ? "text-2xl" : "text-lg"} font-bold text-gray-900 tracking-tight ${isFeatured ? "mb-3" : "mb-2"} group-hover:text-gray-700 transition-colors`}>
                      {article.title}
                    </h3>
                    <p className={`${isFeatured ? "text-sm lg:text-base" : "text-sm"} text-gray-500 leading-relaxed`}>
                      {article.text}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== Instagram Gallery ===== */}
      {content.show_instagram && (content.instagram?.images?.length ?? 0) > 0 && (
        <section className="bg-white py-20 lg:py-32">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-10 lg:mb-16"
            >
              <div className="inline-flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5" style={{ color: brandColor }} />
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">@{content.instagram?.handle || (bootstrap.store_name?.toLowerCase().replace(/\s+/g, "") || "store")}</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 tracking-tight">
                <WordReveal text={content.instagram?.title || ""} />
              </h2>
              <p className="text-base lg:text-lg text-gray-500 max-w-xl mx-auto mt-4 font-light">
                {content.instagram?.subtitle}
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-3 md:grid-cols-6 gap-2 lg:gap-3"
            >
              {(content.instagram?.images || []).map((src, i) => (
                <motion.div key={i} variants={fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                  <a
                    href="#"
                    className="group relative block aspect-square rounded-xl overflow-hidden"
                  >
                    <Image
                      src={src}
                      alt={`Instagram post ${i + 1}`}
                      fill
                      sizes="(max-width: 768px) 33vw, 16vw"
                      className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </a>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Trust Badges Strip ===== */}
      {content.show_trust_badges && (content.trust_badges?.length ?? 0) > 0 && (
        <section className="bg-stone-50 border-y border-stone-200 py-10 lg:py-12">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            {(content.trust_badges || []).map((item, i) => {
              const Icon = TRUST_ICONS[item.icon] || ShieldCheck;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-center gap-3 justify-center text-gray-600"
                >
                  <Icon className="w-5 h-5 flex-shrink-0" style={{ color: brandColor }} strokeWidth={1.5} />
                  <span className="text-sm font-medium">{item.title}</span>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== FAQ — Accordion ===== */}
      {content.show_faq && (content.faq?.items?.length ?? 0) > 0 && (
        <section className="bg-white py-20 lg:py-32">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-10 lg:mb-16"
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Help Center</span>
              <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mt-4 tracking-tight">
                <WordReveal text={content.faq?.title || ""} />
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {(content.faq?.items || []).map((item, i) => (
                <FAQItem
                  key={i}
                  brandColor={brandColor}
                  defaultOpen={i === 0}
                  question={item.question}
                  answer={item.answer}
                />
              ))}
            </motion.div>

            <div className="text-center mt-10">
              <p className="text-sm text-gray-500">Still have questions?</p>
              <Link
                href={`/contact`}
                className="group inline-flex items-center gap-2 mt-3 text-sm font-medium transition-colors"
                style={{ color: brandColor }}
              >
                Contact our support team
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== Newsletter Signup ===== */}
      {content.show_newsletter && (
        <section className="relative bg-stone-50 border-y border-stone-200 py-20 lg:py-28 overflow-hidden">
          <FloatingOrbs brandColor={brandColor} variant="default" />
          <ShimmerSweep brandColor={brandColor} />
          <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: `${brandColor}12`, color: brandColor }}>
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">{content.newsletter?.badge}</span>
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight">
                <WordReveal text={content.newsletter?.title || ""} />
              </h2>
              <p className="text-base lg:text-lg text-gray-500 font-light leading-relaxed">
                {content.newsletter?.subtitle}
              </p>
              <div className="pt-2">
                <NewsletterForm brandColor={brandColor} placeholder={content.newsletter?.placeholder} buttonText={content.newsletter?.button_text} />
              </div>
              <p className="text-xs text-gray-400">{content.newsletter?.disclaimer}</p>
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== CTA Section — Editorial Split ===== */}
      {content.show_cta && content.cta_title && (
        <section className="relative bg-white py-20 lg:py-32 overflow-hidden">
          <WaveLines color={brandColor} />
          <FloatingOrbs brandColor={brandColor} variant="subtle" />
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center rounded-3xl overflow-hidden bg-stone-50 border border-stone-200 perspective-2000"
            >
              {/* Left — 3D tilt image */}
              <TiltCard intensity={6} className="relative h-[300px] sm:h-[400px] lg:h-[560px] rounded-3xl overflow-hidden bg-stone-200">
                <div className="absolute inset-0" style={{ transform: "translateZ(0px)" }}>
                  <Image
                    src={content.promo_image_url || content.hero_image_url || (content.lookbook?.items?.[0]?.image_url) || "https://images.unsplash.com/photo-1609074458316-3e282975bb1e?w=800&q=85"}
                    alt="Explore the collection"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>
                {/* Floating season badge */}
                <div
                  className="absolute top-6 left-6 px-4 py-2 rounded-full backdrop-blur-md bg-white/80 border border-white/60 shadow-lg"
                  style={{ transform: "translateZ(40px)" }}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">Premium Selection</span>
                </div>
                {/* Floating stat badge */}
                <div
                  className="absolute bottom-6 right-6 px-5 py-3 rounded-2xl backdrop-blur-md bg-white/80 border border-white/60 shadow-xl text-center"
                  style={{ transform: "translateZ(60px)" }}
                >
                  <p className="text-2xl font-bold text-gray-900">
                    <Counter to={content.stats?.items?.[0]?.value || 50} suffix={content.stats?.items?.[0]?.suffix || "+"} />
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">{content.stats?.items?.[0]?.label || "Products"}</p>
                </div>
              </TiltCard>

              {/* Right — text content */}
              <div className="px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20 text-center lg:text-left">
                {/* Eyebrow */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="flex items-center gap-3 mb-6 justify-center lg:justify-start"
                >
                  <span className="h-px w-12" style={{ backgroundColor: brandColor }} />
                  <span className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Start Your Journey</span>
                </motion.div>

                {/* Heading */}
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 tracking-tight leading-[1.05]">
                  <WordReveal text={content.cta_title} />
                </h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.3 }}
                  className="text-base lg:text-lg text-gray-500 max-w-md mx-auto lg:mx-0 mb-8 font-light leading-relaxed"
                >
                  {content.cta_text}
                </motion.p>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.4 }}
                  className="flex flex-wrap items-center gap-4 justify-center lg:justify-start mb-10"
                >
                  <Link
                    href={`/?view=shop`}
                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-medium text-base lg:text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:gap-4"
                    style={{ backgroundColor: brandColor }}
                  >
                    {content.cta_button_text}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                  <Link
                    href="#categories"
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-stone-300 text-gray-700 font-medium text-base hover:border-gray-900 hover:text-gray-900 transition-all duration-300"
                  >
                    Browse Categories
                  </Link>
                </motion.div>

                {/* Trust badges */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-center lg:justify-start pt-8 border-t border-stone-200"
                >
                  {[
                    { icon: Truck, label: "Free Shipping" },
                    { icon: ShieldCheck, label: "Secure Payment" },
                    { icon: RefreshCw, label: "Easy Returns" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <item.icon className="w-4 h-4" style={{ color: brandColor }} />
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{item.label}</span>
                    </div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ===== Footer ===== */}
      <footer className="bg-stone-50 border-t border-stone-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-12 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-10 lg:mb-14">
            {/* Brand column */}
            <div className="col-span-2 lg:col-span-2">
              <p className="text-2xl font-bold text-gray-900 mb-3">{bootstrap.store_name || "Store"}</p>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mb-5">
                Modern fashion for the bold and the timeless. Crafted with passion, worn with pride.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: Camera, label: "Instagram" },
                  { icon: Globe, label: "Website" },
                  { icon: Share2, label: "Social" },
                  { icon: Mail, label: "Email" },
                ].map((social, i) => (
                  <a
                    key={i}
                    href="#"
                    aria-label={social.label}
                    className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-gray-500 hover:text-white hover:border-transparent transition-all duration-300"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = brandColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                  >
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Shop column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Shop</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><Link href={`/?view=shop`} className="hover:text-gray-900 transition-colors">All Products</Link></li>
                <li><Link href={`/?view=shop&sort=newest`} className="hover:text-gray-900 transition-colors">New Arrivals</Link></li>
                <li><Link href={`/?view=shop&featured=true`} className="hover:text-gray-900 transition-colors">Featured</Link></li>
                <li><Link href="#categories" className="hover:text-gray-900 transition-colors">Categories</Link></li>
              </ul>
            </div>

            {/* Help column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Help</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><Link href={`/contact`} className="hover:text-gray-900 transition-colors">Contact Us</Link></li>
                <li><Link href={`/about`} className="hover:text-gray-900 transition-colors">About Us</Link></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Shipping Info</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Returns</a></li>
              </ul>
            </div>

            {/* Legal column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><Link href={`/privacy-policy`} className="hover:text-gray-900 transition-colors">Privacy Policy</Link></li>
                <li><Link href={`/cookie-policy`} className="hover:text-gray-900 transition-colors">Cookie Policy</Link></li>
                <li><Link href={`/terms`} className="hover:text-gray-900 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} {bootstrap.store_name || "Store"} — All rights reserved. Powered by TruCommerce.</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Secure Payments</span>
              <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> Worldwide Shipping</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
