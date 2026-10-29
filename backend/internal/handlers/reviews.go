package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type ReviewHandler struct {
	store *services.Store
}

func NewReviewHandler(store *services.Store) *ReviewHandler {
	return &ReviewHandler{store: store}
}

type createReviewReq struct {
	Rating     int             `json:"rating" binding:"required,min=1,max=5"`
	Title      string          `json:"title"`
	Body       string          `json:"body"`
	AuthorName string          `json:"author_name"`
	Images     []reviewImgIn   `json:"images"`
}

type reviewImgIn struct {
	URL string `json:"url"`
	Alt string `json:"alt"`
}

func (h *ReviewHandler) ListReviews(c *gin.Context) {
	tid := tenantID(c)
	productID, ok := pathUUID(c, "productId")
	if !ok {
		return
	}
	reviews, err := h.store.ListReviews(c.Request.Context(), tid, productID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	summary, err := h.store.GetReviewSummary(c.Request.Context(), tid, productID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items":   reviews,
		"summary": summary,
		"total":   len(reviews),
	})
}

func (h *ReviewHandler) CreateReview(c *gin.Context) {
	tid := tenantID(c)
	productID, ok := pathUUID(c, "productId")
	if !ok {
		return
	}
	var req createReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	ctx := c.Request.Context()
	// Route middleware (RequireAuth + RequireRole customer) guarantees a uid.
	uid := userID(c)
	// One review per customer per product.
	existing, err := h.store.GetUserReview(ctx, tid, uid, productID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if existing != nil {
		errResponse(c, http.StatusConflict, "you have already reviewed this product")
		return
	}
	// Reviews are limited to items the customer received in a delivered order.
	delivered, err := h.store.HasDeliveredOrderItem(ctx, tid, uid, productID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !delivered {
		errResponse(c, http.StatusForbidden, "you can only review items from delivered orders")
		return
	}
	authorName := req.AuthorName
	if authorName == "" {
		if u, err := h.store.GetUserByID(ctx, uid); err == nil && u.FullName != "" {
			authorName = u.FullName
		}
	}
	if authorName == "" {
		authorName = "Anonymous"
	}
	r := &models.Review{
		TenantID:   tid,
		ProductID:  productID,
		AuthorName: authorName,
		Rating:     req.Rating,
		Title:      req.Title,
		Body:       req.Body,
		IsApproved: true,
		UserID:     &uid,
		IsVerified: true,
	}
	// Convert image inputs to models, capping at 8 images.
	var images []models.ReviewImage
	for i, img := range req.Images {
		if img.URL == "" {
			continue
		}
		if i >= 8 {
			break
		}
		images = append(images, models.ReviewImage{
			URL:       img.URL,
			Alt:       img.Alt,
			SortOrder: i,
		})
	}
	if err := h.store.CreateReview(ctx, r, images); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, r)
}

// ListPurchasedProducts returns products the authenticated customer has bought,
// with whether they've already reviewed each one.
func (h *ReviewHandler) ListPurchasedProducts(c *gin.Context) {
	tid := tenantID(c)
	uid := getUserID(c)
	if uid == nil {
		errResponse(c, http.StatusUnauthorized, "login required")
		return
	}
	products, err := h.store.ListPurchasedProducts(c.Request.Context(), tid, *uid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if products == nil {
		products = []models.PurchasedProduct{}
	}
	c.JSON(http.StatusOK, gin.H{"items": products, "total": len(products)})
}

// GetMyReview returns the authenticated customer's review for a product.
func (h *ReviewHandler) GetMyReview(c *gin.Context) {
	tid := tenantID(c)
	uid := getUserID(c)
	if uid == nil {
		errResponse(c, http.StatusUnauthorized, "login required")
		return
	}
	productID, ok := pathUUID(c, "productId")
	if !ok {
		return
	}
	r, err := h.store.GetUserReview(c.Request.Context(), tid, *uid, productID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if r == nil {
		c.JSON(http.StatusOK, gin.H{"review": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"review": r})
}

// ListMyReviews returns all reviews written by the authenticated customer.
func (h *ReviewHandler) ListMyReviews(c *gin.Context) {
	tid := tenantID(c)
	uid := getUserID(c)
	if uid == nil {
		errResponse(c, http.StatusUnauthorized, "login required")
		return
	}
	reviews, err := h.store.ListUserReviews(c.Request.Context(), tid, *uid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if reviews == nil {
		reviews = []models.Review{}
	}
	c.JSON(http.StatusOK, gin.H{"items": reviews, "total": len(reviews)})
}

func (h *ReviewHandler) GetSummary(c *gin.Context) {
	tid := tenantID(c)
	productID, ok := pathUUID(c, "productId")
	if !ok {
		return
	}
	summary, err := h.store.GetReviewSummary(c.Request.Context(), tid, productID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, summary)
}

// AdminListReviews lists all reviews (approved + pending) for the store, with
// product info and optional filters: product_id, rating, status
// (approved|pending), search, limit, offset. Also returns aggregate stats.
func (h *ReviewHandler) AdminListReviews(c *gin.Context) {
	tid := tenantID(c)
	f := services.AdminReviewFilter{
		Status: c.Query("status"),
		Search: strings.TrimSpace(c.Query("search")),
	}
	f.Limit, _ = strconv.Atoi(c.DefaultQuery("limit", "50"))
	f.Offset, _ = strconv.Atoi(c.DefaultQuery("offset", "0"))
	f.Rating, _ = strconv.Atoi(c.Query("rating"))
	if s := c.Query("product_id"); s != "" {
		pid, err := uuid.Parse(s)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid product_id")
			return
		}
		f.ProductID = &pid
	}
	items, total, err := h.store.AdminListReviews(c.Request.Context(), tid, f)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	stats, err := h.store.AdminReviewStats(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "stats": stats})
}

type updateReviewReq struct {
	IsApproved *bool `json:"is_approved" binding:"required"`
}

// AdminUpdateReview toggles a review's approval (storefront visibility).
func (h *ReviewHandler) AdminUpdateReview(c *gin.Context) {
	tid := tenantID(c)
	reviewID, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req updateReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	r, err := h.store.SetReviewApproval(c.Request.Context(), tid, reviewID, *req.IsApproved)
	if err != nil {
		notFoundOrErr(c, err, "review not found")
		return
	}
	c.JSON(http.StatusOK, r)
}

// AdminDeleteReview permanently deletes a review. Route-level middleware
// restricts this to superadmin.
func (h *ReviewHandler) AdminDeleteReview(c *gin.Context) {
	tid := tenantID(c)
	reviewID, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteReview(c.Request.Context(), tid, reviewID); err != nil {
		notFoundOrErr(c, err, "review not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
