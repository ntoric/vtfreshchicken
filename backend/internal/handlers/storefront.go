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
	offers, _ := h.store.ListOffers(c.Request.Context(), tid)
	// filter to active offers only for the storefront
	var activeOffers []models.Offer
	now := time.Now()
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
	shippingMethods, _ := h.store.ListActiveShippingMethods(c.Request.Context(), tid)

	// Include the store name so the storefront can display it instead of the slug
	storeName := ""
	if t, err := h.store.GetTenantByID(c.Request.Context(), tid); err == nil {
		storeName = t.Name
	}

	c.JSON(http.StatusOK, gin.H{
		"settings":         ts,
		"store_name":       storeName,
		"currencies":       currencies,
		"languages":        langs,
		"categories":       cats,
		"attributes":       attrs,
		"offers":           activeOffers,
		"shipping_methods": shippingMethods,
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
	// attribute filters: ?attr=size:s&attr=size:m&attr=color:red
	attrFilters := map[string][]string{}
	for _, pair := range c.QueryArray("attr") {
		parts := strings.SplitN(pair, ":", 2)
		if len(parts) == 2 {
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

	for i := range items {
		p := &items[i]
		// effective price in target currency
		conv, err := h.currency.Convert(c.Request.Context(), p.BasePrice, p.CurrencyCode, targetCur)
		if err == nil {
			p.EffectivePrice = conv
		} else {
			p.EffectivePrice = p.BasePrice
		}
		// offers
		offer, err := h.store.ActiveOfferForProduct(c.Request.Context(), tid, p.ID, p.CategoryID)
		if err == nil && offer != nil && offer.OfferType == "percentage" {
			p.DiscountPct = offer.Value
			p.DiscountedPrice = p.EffectivePrice * (1 - offer.Value/100)
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

func supportedLangs(ts *models.TenantSettings) []string {
	if ts == nil {
		return []string{"en"}
	}
	return ts.SupportedLanguages
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
	offer, err := h.store.ActiveOfferForProduct(c.Request.Context(), tid, p.ID, p.CategoryID)
	if err == nil && offer != nil && offer.OfferType == "percentage" {
		p.DiscountPct = offer.Value
		p.DiscountedPrice = p.EffectivePrice * (1 - offer.Value/100)
	}
	c.JSON(http.StatusOK, gin.H{"product": p, "currency": targetCur, "language": lang})
}

// ValidateDiscount: public endpoint to preview a discount code.
func (h *StorefrontHandler) ValidateDiscount(c *gin.Context) {
	tid := tenantID(c)
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
	d, err := h.store.ValidateDiscountCode(c.Request.Context(), tid, code, subtotal)
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
