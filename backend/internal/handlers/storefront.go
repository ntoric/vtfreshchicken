package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/currency"
	"github.com/trucommerce/backend/internal/i18n"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type StorefrontHandler struct {
	store    *services.Store
	currency *currency.Service
}

func NewStorefrontHandler(store *services.Store, cur *currency.Service) *StorefrontHandler {
	return &StorefrontHandler{store: store, currency: cur}
}

// Public tenant info + settings + currencies + languages + categories + attributes (for storefront bootstrap).
func (h *StorefrontHandler) Bootstrap(c *gin.Context) {
	tid := tenantID(c)
	ts, _ := h.store.GetTenantSettings(c.Request.Context(), tid)
	currencies, _ := h.store.ListCurrencies(c.Request.Context())
	langs, _ := h.store.ListLanguages(c.Request.Context())
	cats, _ := h.store.ListCategories(c.Request.Context(), tid)
	attrs, _ := h.store.ListAttributes(c.Request.Context(), tid)
	// Internal attributes are admin-only — never expose their definitions to
	// the storefront (keeps them out of filters and spec displays).
	publicAttrs := make([]models.Attribute, 0, len(attrs))
	for _, a := range attrs {
		if !a.IsInternal {
			publicAttrs = append(publicAttrs, a)
		}
	}

	// Module feature flags — disabled modules hide their storefront surface.
	mods, _ := h.store.ModuleEnabledMap(c.Request.Context(), tid)
	promotionsEnabled := moduleOn(mods, services.ModulePromotions)
	shippingEnabled := moduleOn(mods, services.ModuleShipping)
	discountsEnabledModule := moduleOn(mods, services.ModuleDiscounts)

	// filter to active offers only for the storefront (promotions module)
	var activeOffers []models.Offer
	now := time.Now()
	if promotionsEnabled {
		offers, _ := h.store.ListOffers(c.Request.Context(), tid)
		for _, o := range offers {
			if !o.IsActive {
				continue
			}
			if o.StartsAt != nil && now.Before(*o.StartsAt) {
				continue
			}
			if o.EndsAt != nil && now.After(*o.EndsAt) {
				continue
			}
			activeOffers = append(activeOffers, o)
		}
	}
	var shippingMethods []models.ShippingMethod
	if shippingEnabled {
		shippingMethods, _ = h.store.ListActiveShippingMethods(c.Request.Context(), tid)
	}

	// Coupon field at checkout is shown only when at least one discount code
	// is active and within its validity window (discounts module).
	discountsEnabled := false
	if discountsEnabledModule {
		discounts, _ := h.store.ListDiscountCodes(c.Request.Context(), tid)
		for _, d := range discounts {
			if !d.IsActive {
				continue
			}
			if d.StartsAt != nil && now.Before(*d.StartsAt) {
				continue
			}
			if d.EndsAt != nil && now.After(*d.EndsAt) {
				continue
			}
			discountsEnabled = true
			break
		}
	}

	// Include the store name so the storefront can display it instead of the slug
	storeName := ""
	if t, err := h.store.GetTenantByID(c.Request.Context(), tid); err == nil {
		storeName = t.Name
	}

	// Active branches with their service areas — drives the location picker.
	branches, _ := h.store.ListActiveBranches(c.Request.Context(), tid)
	if branches == nil {
		branches = []models.Branch{}
	}

	c.JSON(http.StatusOK, gin.H{
		"settings":          ts,
		"store_name":        storeName,
		"branches":          branches,
		"currencies":        currencies,
		"languages":         langs,
		"categories":        cats,
		"attributes":        publicAttrs,
		"offers":            activeOffers,
		"shipping_methods":  shippingMethods,
		"discounts_enabled": discountsEnabled,
		"modules":           mods,
	})
}

// ListProducts: public storefront listing with filters, currency, language.
func (h *StorefrontHandler) ListProducts(c *gin.Context) {
	tid := tenantID(c)
	ts, _ := h.store.GetTenantSettings(c.Request.Context(), tid)
	defaultLang := "en"
	if ts != nil && ts.DefaultLanguage != "" {
		defaultLang = ts.DefaultLanguage
	}
	lang := i18n.ResolveLanguage(c.GetHeader("Accept-Language"), supportedLangs(ts), defaultLang)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "24"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")
	category := c.Query("category")
	featured := c.Query("featured") == "true"

	f := services.ProductFilter{
		TenantID: tid, Limit: limit, Offset: offset, Language: lang, FeaturedOnly: featured,
		BranchIDs: queryBranchIDs(c), // products available at any serviceable branch
	}
	if search != "" {
		f.Search = &search
	}
	if category != "" {
		f.CategorySlug = &category
	}
	if exclude := c.Query("exclude"); exclude != "" {
		if eid, err := uuid.Parse(exclude); err == nil {
			f.ExcludeProductID = &eid
		}
	}
	// product_ids: comma-separated UUIDs for page builder product picker
	if ids := c.Query("product_ids"); ids != "" {
		for _, idStr := range strings.Split(ids, ",") {
			if pid, err := uuid.Parse(strings.TrimSpace(idStr)); err == nil {
				f.ProductIDs = append(f.ProductIDs, pid)
			}
		}
	}
	if min := c.Query("min_price"); min != "" {
		if v, err := strconv.ParseFloat(min, 64); err == nil {
			f.MinPrice = &v
		}
	}
	if max := c.Query("max_price"); max != "" {
		if v, err := strconv.ParseFloat(max, 64); err == nil {
			f.MaxPrice = &v
		}
	}
	// Internal attributes are admin-only — strip their values from the public
	// payloads below and ignore filter params targeting them.
	internalAttrs, _ := h.store.InternalAttributeSlugs(c.Request.Context(), tid)

	// attribute filters: ?attr=size:s&attr=size:m&attr=color:red
	attrFilters := map[string][]string{}
	for _, pair := range c.QueryArray("attr") {
		parts := strings.SplitN(pair, ":", 2)
		if len(parts) == 2 && !internalAttrs[parts[0]] {
			attrFilters[parts[0]] = append(attrFilters[parts[0]], parts[1])
		}
	}
	if len(attrFilters) > 0 {
		f.AttributeFilters = attrFilters
	}

	items, total, err := h.store.ListProducts(c.Request.Context(), f)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Enrich each product with images, variants, and attributes so the
	// storefront listing can render product images and variant pricing
	// without a separate fetch per product.
	h.store.EnrichProducts(c.Request.Context(), items)
	if len(internalAttrs) > 0 {
		for i := range items {
			stripInternalAttributes(&items[i], internalAttrs)
		}
	}

	// currency conversion + offer application
	targetCur := c.Query("currency")
	if targetCur == "" && ts != nil && ts.DefaultCurrencyID != nil {
		// resolve default currency code
		currencies, _ := h.store.ListCurrencies(c.Request.Context())
		for _, cu := range currencies {
			if ts.DefaultCurrencyID != nil && cu.ID == *ts.DefaultCurrencyID {
				targetCur = cu.Code
				break
			}
		}
	}
	if targetCur == "" {
		targetCur = "USD"
	}

	promotionsOn := h.store.IsModuleEnabled(c.Request.Context(), tid, services.ModulePromotions)
	for i := range items {
		p := &items[i]
		// effective price in target currency
		conv, err := h.currency.Convert(c.Request.Context(), p.BasePrice, p.CurrencyCode, targetCur)
		if err == nil {
			p.EffectivePrice = conv
		} else {
			p.EffectivePrice = p.BasePrice
		}
		// offers (promotions module)
		if promotionsOn {
			offer, err := h.store.ActiveOfferForProduct(c.Request.Context(), tid, p.ID, p.CategoryID, queryBranchID(c))
			if err == nil && offer != nil && offer.OfferType == "percentage" {
				p.DiscountPct = offer.Value
				p.DiscountedPrice = p.EffectivePrice * (1 - offer.Value/100)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"items":    items,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"currency": targetCur,
		"language": lang,
	})
}

// stripInternalAttributes removes values of internal attributes (e.g. expiry,
// manufacturing dates) from a product payload so they never reach storefront
// responses. Variant selection on the storefront only sees public attributes.
func stripInternalAttributes(p *models.Product, internal map[string]bool) {
	if len(p.Attributes) > 0 {
		kept := p.Attributes[:0]
		for _, a := range p.Attributes {
			if !internal[a.AttributeSlug] {
				kept = append(kept, a)
			}
		}
		p.Attributes = kept
	}
	for i := range p.Variants {
		if len(p.Variants[i].Attributes) == 0 {
			continue
		}
		kept := p.Variants[i].Attributes[:0]
		for _, a := range p.Variants[i].Attributes {
			if !internal[a.AttributeSlug] {
				kept = append(kept, a)
			}
		}
		p.Variants[i].Attributes = kept
	}
}

// moduleOn reports whether a module is enabled given the enabled-state map.
// A nil map (lookup failure) or an absent code means enabled — feature flags
// fail open so a storage hiccup never silently disables storefront features.
func moduleOn(mods map[string]bool, code string) bool {
	enabled, ok := mods[code]
	return !ok || enabled
}

func supportedLangs(ts *models.TenantSettings) []string {
	if ts == nil {
		return []string{"en"}
	}
	return ts.SupportedLanguages
}

// queryBranchID parses the optional ?branch_id= query parameter used to give
// public endpoints a branch context (pricing offers, discount validation).
func queryBranchID(c *gin.Context) *uuid.UUID {
	raw := c.Query("branch_id")
	if raw == "" {
		return nil
	}
	if id, err := uuid.Parse(raw); err == nil {
		return &id
	}
	return nil
}

// queryBranchIDs parses a comma-separated ?branch_id= list — used by the
// storefront to request products available at any serviceable branch.
func queryBranchIDs(c *gin.Context) []uuid.UUID {
	raw := c.Query("branch_id")
	if raw == "" {
		return nil
	}
	var out []uuid.UUID
	for _, part := range strings.Split(raw, ",") {
		if id, err := uuid.Parse(strings.TrimSpace(part)); err == nil {
			out = append(out, id)
		}
	}
	return out
}

// GetProduct: public product detail with currency + language.
func (h *StorefrontHandler) GetProduct(c *gin.Context) {
	tid := tenantID(c)
	ts, _ := h.store.GetTenantSettings(c.Request.Context(), tid)
	defaultLang := "en"
	if ts != nil && ts.DefaultLanguage != "" {
		defaultLang = ts.DefaultLanguage
	}
	lang := i18n.ResolveLanguage(c.GetHeader("Accept-Language"), supportedLangs(ts), defaultLang)

	slug := c.Param("slug")
	p, err := h.store.GetProductBySlug(c.Request.Context(), tid, slug, lang)
	if err != nil {
		notFoundOrErr(c, err, "product not found")
		return
	}
	// Branch-exclusive products are hidden when the request carries branch
	// context (?branch_id= list from the location picker) that excludes it.
	if bids := queryBranchIDs(c); len(bids) > 0 && p.BranchID != nil {
		allowed := false
		for _, b := range bids {
			if *p.BranchID == b {
				allowed = true
				break
			}
		}
		if !allowed {
			errResponse(c, http.StatusNotFound, "product not found")
			return
		}
	}
	if internalAttrs, _ := h.store.InternalAttributeSlugs(c.Request.Context(), tid); len(internalAttrs) > 0 {
		stripInternalAttributes(p, internalAttrs)
	}
	targetCur := c.Query("currency")
	if targetCur == "" && ts != nil && ts.DefaultCurrencyID != nil {
		currencies, _ := h.store.ListCurrencies(c.Request.Context())
		for _, cu := range currencies {
			if ts.DefaultCurrencyID != nil && cu.ID == *ts.DefaultCurrencyID {
				targetCur = cu.Code
				break
			}
		}
	}
	if targetCur == "" {
		targetCur = "USD"
	}
	conv, err := h.currency.Convert(c.Request.Context(), p.BasePrice, p.CurrencyCode, targetCur)
	if err == nil {
		p.EffectivePrice = conv
	} else {
		p.EffectivePrice = p.BasePrice
	}
	// Convert variant prices to the target currency so the detail page
	// and add-to-cart use the correct currency, not the raw base price.
	for i := range p.Variants {
		v := &p.Variants[i]
		vc, verr := h.currency.Convert(c.Request.Context(), v.Price, p.CurrencyCode, targetCur)
		if verr == nil {
			v.Price = vc
		}
	}
	if h.store.IsModuleEnabled(c.Request.Context(), tid, services.ModulePromotions) {
		offer, err := h.store.ActiveOfferForProduct(c.Request.Context(), tid, p.ID, p.CategoryID, queryBranchID(c))
		if err == nil && offer != nil && offer.OfferType == "percentage" {
			p.DiscountPct = offer.Value
			p.DiscountedPrice = p.EffectivePrice * (1 - offer.Value/100)
		}
	}
	c.JSON(http.StatusOK, gin.H{"product": p, "currency": targetCur, "language": lang})
}

// ValidateDiscount: public endpoint to preview a discount code.
func (h *StorefrontHandler) ValidateDiscount(c *gin.Context) {
	tid := tenantID(c)
	if !h.store.IsModuleEnabled(c.Request.Context(), tid, services.ModuleDiscounts) {
		errResponse(c, http.StatusNotFound, "invalid or expired discount code")
		return
	}
	code := c.Query("code")
	subtotalStr := c.Query("subtotal")
	if code == "" || subtotalStr == "" {
		errResponse(c, http.StatusBadRequest, "code and subtotal required")
		return
	}
	subtotal, err := strconv.ParseFloat(subtotalStr, 64)
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid subtotal")
		return
	}
	d, err := h.store.ValidateDiscountCode(c.Request.Context(), tid, code, subtotal, queryBranchID(c))
	if err != nil {
		errResponse(c, http.StatusNotFound, "invalid or expired discount code")
		return
	}
	var discount float64
	if d.DiscountType == "percentage" {
		discount = subtotal * (d.Value / 100)
	} else {
		discount = d.Value
	}
	c.JSON(http.StatusOK, gin.H{
		"valid":          true,
		"discount":       discount,
		"discount_type":  d.DiscountType,
		"value":          d.Value,
		"new_subtotal":   subtotal - discount,
	})
}
