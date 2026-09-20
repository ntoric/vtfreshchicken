package handlers

import (
	"net/http"
	"strconv"

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
	authorName := req.AuthorName
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
	}
	if uid := getUserID(c); uid != nil {
		r.UserID = uid
		r.IsVerified = true
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
	if err := h.store.CreateReview(c.Request.Context(), r, images); err != nil {
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

// Admin: list all reviews (including unapproved) for a product
func (h *ReviewHandler) AdminListReviews(c *gin.Context) {
	tid := tenantID(c)
	productIDStr := c.Query("product_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if productIDStr != "" {
		productID, err := uuid.Parse(productIDStr)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid product_id")
			return
		}
		rows, err := h.store.Pool.Query(c.Request.Context(),
			`SELECT id, tenant_id, product_id, user_id, author_name, rating, title, body, is_verified, is_approved, created_at
			 FROM product_reviews WHERE tenant_id=$1 AND product_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
			tid, productID, limit, offset)
		if err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		var out []models.Review
		for rows.Next() {
			var r models.Review
			if err := rows.Scan(&r.ID, &r.TenantID, &r.ProductID, &r.UserID, &r.AuthorName, &r.Rating, &r.Title, &r.Body, &r.IsVerified, &r.IsApproved, &r.CreatedAt); err != nil {
				errResponse(c, http.StatusInternalServerError, err.Error())
				return
			}
			out = append(out, r)
		}
		c.JSON(http.StatusOK, gin.H{"items": out, "total": len(out)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": []models.Review{}, "total": 0})
}
