package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type CatalogHandler struct {
	store *services.Store
}

func NewCatalogHandler(store *services.Store) *CatalogHandler {
	return &CatalogHandler{store: store}
}

// ---------------- Categories ----------------

func (h *CatalogHandler) ListCategories(c *gin.Context) {
	tid := tenantID(c)
	cats, err := h.store.ListCategories(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": cats})
}

type categoryReq struct {
	Slug        string  `json:"slug" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	ParentID    *string `json:"parent_id"`
	SortOrder   int     `json:"sort_order"`
	IsActive    bool    `json:"is_active"`
}

func (h *CatalogHandler) CreateCategory(c *gin.Context) {
	tid := tenantID(c)
	var req categoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	cat := &models.Category{TenantID: tid, Slug: req.Slug, Name: req.Name, Description: req.Description, SortOrder: req.SortOrder, IsActive: req.IsActive}
	if req.ParentID != nil && *req.ParentID != "" {
		pid, err := uuid.Parse(*req.ParentID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid parent_id")
			return
		}
		cat.ParentID = &pid
	}
	if err := h.store.CreateCategory(c.Request.Context(), cat); err != nil {
		errResponse(c, http.StatusConflict, err.Error())
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *CatalogHandler) UpdateCategory(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req categoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	cat := &models.Category{ID: id, TenantID: tid, Slug: req.Slug, Name: req.Name, Description: req.Description, SortOrder: req.SortOrder, IsActive: req.IsActive}
	if req.ParentID != nil && *req.ParentID != "" {
		pid, err := uuid.Parse(*req.ParentID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid parent_id")
			return
		}
		cat.ParentID = &pid
	}
	if err := h.store.UpdateCategory(c.Request.Context(), cat); err != nil {
		notFoundOrErr(c, err, "category not found")
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *CatalogHandler) DeleteCategory(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	if err := h.store.DeleteCategory(c.Request.Context(), tid, id); err != nil {
		notFoundOrErr(c, err, "category not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---------------- Attributes ----------------

func (h *CatalogHandler) ListAttributes(c *gin.Context) {
	tid := tenantID(c)
	attrs, err := h.store.ListAttributes(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": attrs})
}

type attributeReq struct {
	Slug         string                  `json:"slug" binding:"required"`
	Name         string                  `json:"name" binding:"required"`
	Type         string                  `json:"type"`
	IsFilterable bool                    `json:"is_filterable"`
	IsVariant    bool                    `json:"is_variant"`
	IsBatch      bool                    `json:"is_batch"`
	Options      []models.AttributeOption `json:"options"`
}

func (h *CatalogHandler) CreateAttribute(c *gin.Context) {
	tid := tenantID(c)
	var req attributeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Type == "" {
		req.Type = "text"
	}
	a := &models.Attribute{TenantID: tid, Slug: req.Slug, Name: req.Name, Type: req.Type, IsFilterable: req.IsFilterable, IsVariant: req.IsVariant, IsBatch: req.IsBatch, Options: req.Options}
	if err := h.store.CreateAttribute(c.Request.Context(), a); err != nil {
		errResponse(c, http.StatusConflict, err.Error())
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (h *CatalogHandler) DeleteAttribute(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	if err := h.store.DeleteAttribute(c.Request.Context(), tid, id); err != nil {
		notFoundOrErr(c, err, "attribute not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *CatalogHandler) UpdateAttribute(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req attributeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Type == "" {
		req.Type = "text"
	}
	a := &models.Attribute{
		ID: id, TenantID: tid, Slug: req.Slug, Name: req.Name, Type: req.Type,
		IsFilterable: req.IsFilterable, IsVariant: req.IsVariant, IsBatch: req.IsBatch, Options: req.Options,
	}
	if err := h.store.UpdateAttribute(c.Request.Context(), a); err != nil {
		notFoundOrErr(c, err, "attribute not found")
		return
	}
	c.JSON(http.StatusOK, a)
}

// ---------------- Products (admin) ----------------

func (h *CatalogHandler) ListProductsAdmin(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")
	status := c.Query("status")
	f := services.ProductFilter{TenantID: tid, Limit: limit, Offset: offset, IncludeAll: true, Status: status}
	if search != "" {
		f.Search = &search
	}
	items, total, err := h.store.ListProducts(c.Request.Context(), f)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "limit": limit, "offset": offset})
}

type productReq struct {
	Slug        string                       `json:"slug" binding:"required"`
	Name        string                       `json:"name" binding:"required"`
	Description string                       `json:"description"`
	CategoryID  *string                      `json:"category_id"`
	SKU         string                       `json:"sku"`
	Status      string                       `json:"status"`
	BasePrice   float64                      `json:"base_price"`
	CurrencyCode string                      `json:"currency_code"`
	IsFeatured  bool                         `json:"is_featured"`
	Stock       int                          `json:"stock"`
	LowStockThreshold int                    `json:"low_stock_threshold"`
	TrackInventory  bool                     `json:"track_inventory"`
	VendorID    *string                      `json:"vendor_id"`
	ImageURL    string                       `json:"image_url"`
	Images      []models.ProductImage        `json:"images"`
	Attributes  []models.ProductAttributeValue `json:"attributes"`
	Variants    []models.Variant             `json:"variants"`
	TaxClassID  *string                      `json:"tax_class_id"`
}

func (h *CatalogHandler) CreateProduct(c *gin.Context) {
	tid := tenantID(c)
	var req productReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	if req.CurrencyCode == "" {
		req.CurrencyCode = "USD"
	}
	p := &models.Product{
		TenantID: tid, Slug: req.Slug, Name: req.Name, Description: req.Description,
		SKU: req.SKU, Status: req.Status, BasePrice: req.BasePrice, CurrencyCode: req.CurrencyCode,
		IsFeatured: req.IsFeatured, Stock: req.Stock, LowStockThreshold: req.LowStockThreshold, TrackInventory: req.TrackInventory,
		ImageURL: req.ImageURL, Images: req.Images, Attributes: req.Attributes, Variants: req.Variants,
	}
	if req.CategoryID != nil && *req.CategoryID != "" {
		cid, err := uuid.Parse(*req.CategoryID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid category_id")
			return
		}
		p.CategoryID = &cid
	}
	if req.TaxClassID != nil && *req.TaxClassID != "" {
		tcid, err := uuid.Parse(*req.TaxClassID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid tax_class_id")
			return
		}
		p.TaxClassID = &tcid
	}
	if req.VendorID != nil && *req.VendorID != "" {
		vid, err := uuid.Parse(*req.VendorID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid vendor_id")
			return
		}
		p.VendorID = &vid
	}
	if err := h.store.CreateProduct(c.Request.Context(), p); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *CatalogHandler) UpdateProduct(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req productReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	p := &models.Product{
		ID: id, TenantID: tid, Slug: req.Slug, Name: req.Name, Description: req.Description,
		SKU: req.SKU, Status: req.Status, BasePrice: req.BasePrice, CurrencyCode: req.CurrencyCode,
		IsFeatured: req.IsFeatured, Stock: req.Stock, LowStockThreshold: req.LowStockThreshold, TrackInventory: req.TrackInventory,
		ImageURL: req.ImageURL, Images: req.Images, Attributes: req.Attributes, Variants: req.Variants,
	}
	if req.CategoryID != nil && *req.CategoryID != "" {
		cid, err := uuid.Parse(*req.CategoryID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid category_id")
			return
		}
		p.CategoryID = &cid
	}
	if req.TaxClassID != nil && *req.TaxClassID != "" {
		tcid, err := uuid.Parse(*req.TaxClassID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid tax_class_id")
			return
		}
		p.TaxClassID = &tcid
	}
	if req.VendorID != nil && *req.VendorID != "" {
		vid, err := uuid.Parse(*req.VendorID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid vendor_id")
			return
		}
		p.VendorID = &vid
	}
	if err := h.store.UpdateProduct(c.Request.Context(), p); err != nil {
		notFoundOrErr(c, err, "product not found")
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *CatalogHandler) DeleteProduct(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	if err := h.store.DeleteProduct(c.Request.Context(), tid, id); err != nil {
		notFoundOrErr(c, err, "product not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *CatalogHandler) GetProduct(c *gin.Context) {
	tid := tenantID(c)
	slug := c.Param("slug")
	p, err := h.store.GetProductBySlug(c.Request.Context(), tid, slug, "")
	if err != nil {
		notFoundOrErr(c, err, "product not found")
		return
	}
	c.JSON(http.StatusOK, p)
}

// GetProductByID returns a single product by ID with full details for admin editing.
func (h *CatalogHandler) GetProductByID(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	p, err := h.store.GetProductByID(c.Request.Context(), tenantID(c), id)
	if err != nil {
		notFoundOrErr(c, err, "product not found")
		return
	}
	c.JSON(http.StatusOK, p)
}

// ---------------- Offers ----------------

func (h *CatalogHandler) ListOffers(c *gin.Context) {
	tid := tenantID(c)
	offers, err := h.store.ListOffersScoped(c.Request.Context(), tid, branchFilter(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": offers})
}

func (h *CatalogHandler) GetOffer(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	o, err := h.store.GetOfferByID(c.Request.Context(), tenantID(c), id)
	if err != nil {
		notFoundOrErr(c, err, "offer not found")
		return
	}
	c.JSON(http.StatusOK, o)
}

type offerReq struct {
	Name        string               `json:"name" binding:"required"`
	Description string               `json:"description"`
	OfferType   string               `json:"offer_type" binding:"required"`
	Value       float64              `json:"value"`
	StartsAt    *string              `json:"starts_at"`
	EndsAt      *string              `json:"ends_at"`
	IsActive    bool                 `json:"is_active"`
	Targets     []models.OfferTarget `json:"targets"`
	BranchID    *string              `json:"branch_id"` // nil/"" = all branches
}

func parseTimePtr(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil
	}
	return &t
}

func (h *CatalogHandler) CreateOffer(c *gin.Context) {
	tid := tenantID(c)
	var req offerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	o := &models.Offer{
		TenantID: tid, Name: req.Name, Description: req.Description, OfferType: req.OfferType,
		Value: req.Value, StartsAt: parseTimePtr(req.StartsAt), EndsAt: parseTimePtr(req.EndsAt),
		IsActive: req.IsActive, Targets: req.Targets,
	}
	if req.BranchID != nil && *req.BranchID != "" {
		bid, perr := uuid.Parse(*req.BranchID)
		if perr != nil {
			errResponse(c, http.StatusBadRequest, "invalid branch_id")
			return
		}
		o.BranchID = &bid
	}
	if err := h.store.CreateOffer(c.Request.Context(), o); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusCreated, o)
}

func (h *CatalogHandler) UpdateOffer(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req offerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	targets := req.Targets
	if targets == nil {
		targets = []models.OfferTarget{{TargetType: "all"}}
	}
	var branchID *uuid.UUID
	if req.BranchID != nil && *req.BranchID != "" {
		bid, perr := uuid.Parse(*req.BranchID)
		if perr != nil {
			errResponse(c, http.StatusBadRequest, "invalid branch_id")
			return
		}
		branchID = &bid
	}
	if err := h.store.UpdateOffer(c.Request.Context(), tid, id,
		req.Name, req.Description, req.OfferType, req.Value,
		parseTimePtr(req.StartsAt), parseTimePtr(req.EndsAt), req.IsActive, targets, branchID); err != nil {
		notFoundOrErr(c, err, "offer not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *CatalogHandler) DeleteOffer(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	if err := h.store.DeleteOffer(c.Request.Context(), tid, id); err != nil {
		notFoundOrErr(c, err, "offer not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---------------- Discount codes ----------------

func (h *CatalogHandler) ListDiscountCodes(c *gin.Context) {
	tid := tenantID(c)
	codes, err := h.store.ListDiscountCodesScoped(c.Request.Context(), tid, branchFilter(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": codes})
}

func (h *CatalogHandler) GetDiscountCode(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	d, err := h.store.GetDiscountCodeByID(c.Request.Context(), tenantID(c), id)
	if err != nil {
		notFoundOrErr(c, err, "discount code not found")
		return
	}
	c.JSON(http.StatusOK, d)
}

type discountReq struct {
	Code         string  `json:"code" binding:"required"`
	Description  string  `json:"description"`
	DiscountType string  `json:"discount_type" binding:"required"`
	Value        float64 `json:"value"`
	MinSubtotal  float64 `json:"min_subtotal"`
	MaxUses      *int    `json:"max_uses"`
	StartsAt     *string `json:"starts_at"`
	EndsAt       *string `json:"ends_at"`
	IsActive     bool    `json:"is_active"`
	BranchID     *string `json:"branch_id"` // nil/"" = all branches
}

func (h *CatalogHandler) CreateDiscountCode(c *gin.Context) {
	tid := tenantID(c)
	var req discountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	d := &models.DiscountCode{
		TenantID: tid, Code: req.Code, Description: req.Description, DiscountType: req.DiscountType,
		Value: req.Value, MinSubtotal: req.MinSubtotal, MaxUses: req.MaxUses,
		StartsAt: parseTimePtr(req.StartsAt), EndsAt: parseTimePtr(req.EndsAt), IsActive: req.IsActive,
	}
	if req.BranchID != nil && *req.BranchID != "" {
		bid, perr := uuid.Parse(*req.BranchID)
		if perr != nil {
			errResponse(c, http.StatusBadRequest, "invalid branch_id")
			return
		}
		d.BranchID = &bid
	}
	if err := h.store.CreateDiscountCode(c.Request.Context(), d); err != nil {
		errResponse(c, http.StatusConflict, err.Error())
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *CatalogHandler) UpdateDiscountCode(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req discountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	var branchID *uuid.UUID
	if req.BranchID != nil && *req.BranchID != "" {
		bid, perr := uuid.Parse(*req.BranchID)
		if perr != nil {
			errResponse(c, http.StatusBadRequest, "invalid branch_id")
			return
		}
		branchID = &bid
	}
	if err := h.store.UpdateDiscountCode(c.Request.Context(), tid, id,
		req.Code, req.Description, req.DiscountType, req.Value, req.MinSubtotal,
		req.MaxUses, parseTimePtr(req.StartsAt), parseTimePtr(req.EndsAt), req.IsActive, branchID); err != nil {
		notFoundOrErr(c, err, "discount code not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *CatalogHandler) DeleteDiscountCode(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	if err := h.store.DeleteDiscountCode(c.Request.Context(), tid, id); err != nil {
		notFoundOrErr(c, err, "discount code not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *CatalogHandler) DiscountStats(c *gin.Context) {
	stats, err := h.store.DiscountStats(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ---------------- Currencies / languages (reference data) ----------------

func (h *CatalogHandler) ListCurrencies(c *gin.Context) {
	currencies, err := h.store.ListCurrencies(c.Request.Context())
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": currencies})
}

func (h *CatalogHandler) ListLanguages(c *gin.Context) {
	langs, err := h.store.ListLanguages(c.Request.Context())
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": langs})
}
