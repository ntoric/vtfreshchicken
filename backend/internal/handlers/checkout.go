package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/email"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/payment"
	"github.com/trucommerce/backend/internal/services"
)

type CheckoutHandler struct {
	store    *services.Store
	registry *payment.Registry
	emailH   *EmailHandler
}

func NewCheckoutHandler(store *services.Store, registry *payment.Registry, emailH *EmailHandler) *CheckoutHandler {
	return &CheckoutHandler{store: store, registry: registry, emailH: emailH}
}

// PlaceOrder converts the current cart into an order.
// Payment is processed through the gateway registry before the order is created.
func (h *CheckoutHandler) PlaceOrder(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	uid := getUserID(c)

	var req models.CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid checkout request: "+err.Error())
		return
	}

	if req.ShippingAddress.Line1 == "" || req.ShippingAddress.City == "" || req.ShippingAddress.Country == "" {
		errResponse(c, http.StatusBadRequest, "shipping address is incomplete")
		return
	}
	if req.PaymentMethod == "" {
		errResponse(c, http.StatusBadRequest, "payment method is required")
		return
	}

	// Enforce anonymous checkout setting: if disabled, require authentication
	if uid == nil {
		settings, sErr := h.store.GetTenantSettings(c.Request.Context(), tid)
		if sErr == nil && settings != nil && !settings.AnonymousCheckout {
			errResponse(c, http.StatusUnauthorized, "login required to checkout")
			return
		}
	}

	// Look up the payment gateway from the registry
	// Wallet payments are handled specially — the debit happens via the wallet
	// service using the authenticated user ID, not via a gateway.
	var gateway payment.Gateway
	var ok bool
	isWalletPayment := req.PaymentMethod == "wallet"

	if isWalletPayment {
		// Wallet payment requires authentication
		if uid == nil {
			errResponse(c, http.StatusUnauthorized, "login required to pay with wallet")
			return
		}
		// Verify the wallet gateway is registered (so it appears in methods)
		_, ok = h.registry.Get("wallet")
		if !ok {
			errResponse(c, http.StatusBadRequest, "wallet payment is not available")
			return
		}
	} else {
		gateway, ok = h.registry.Get(req.PaymentMethod)
		if !ok {
			errResponse(c, http.StatusBadRequest, "unsupported payment method: "+req.PaymentMethod)
			return
		}
	}

	currency := req.CurrencyCode
	if currency == "" {
		currency = "USD"
	}

	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, uid, sessionID, currency)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if len(cart.Items) == 0 {
		errResponse(c, http.StatusBadRequest, "cart is empty")
		return
	}

	// Calculate the grand total for the payment gateway
	// (must match what CreateOrderFromCart will compute)
	subtotal := services.CartSubtotal(cart)

	// Calculate shipping using the shipping module (replaces hardcoded rates)
	shippingTotal := 0.0
	if len(req.ItemShippingMethods) > 0 {
		// Per-item shipping methods (split-shipment support): compute cost per item.
		shipItems := make([]models.ShippingCalculationItem, 0, len(cart.Items))
		for _, ci := range cart.Items {
			shipItems = append(shipItems, models.ShippingCalculationItem{
				ProductID:        ci.ProductID,
				Quantity:         ci.Quantity,
				LineTotal:        ci.LineTotal,
				RequiresShipping: ci.RequiresShipping,
				Weight:           ci.Weight,
				FreeShipping:     ci.FreeShipping,
			})
		}
		itemMethod := make(map[int]string)
		for _, ism := range req.ItemShippingMethods {
			itemMethod[ism.CartItemIndex] = ism.MethodCode
		}
		for i, ci := range cart.Items {
			methodCode := itemMethod[i]
			if methodCode == "" || !ci.RequiresShipping {
				continue
			}
			st, sErr := h.store.ResolveShippingRateForItem(c.Request.Context(), tid, methodCode, shipItems[i])
			if sErr == nil {
				shippingTotal += st
			}
		}
	} else if req.ShippingMethod != "" {
		// Order-level shipping method (legacy / single-shipment path)
		shipItems := make([]models.ShippingCalculationItem, 0, len(cart.Items))
		for _, ci := range cart.Items {
			shipItems = append(shipItems, models.ShippingCalculationItem{
				ProductID:        ci.ProductID,
				Quantity:         ci.Quantity,
				LineTotal:        ci.LineTotal,
				RequiresShipping: ci.RequiresShipping,
				Weight:           ci.Weight,
				FreeShipping:     ci.FreeShipping,
			})
		}
		st, sErr := h.store.ResolveShippingRate(c.Request.Context(), tid, req.ShippingMethod, subtotal, req.ShippingAddress, shipItems)
		if sErr == nil {
			shippingTotal = st
		} else {
			// Fall back to legacy hardcoded rates if method not found
			if req.ShippingMethod == "express" {
				shippingTotal = 15.00
			} else if subtotal >= 50 {
				shippingTotal = 0
			} else {
				shippingTotal = 5.99
			}
		}
	}
	discountTotal := 0.0
	if req.DiscountCode != "" {
		dc, derr := h.store.ValidateDiscountCode(c.Request.Context(), cart.TenantID, req.DiscountCode, subtotal)
		if derr == nil && dc != nil {
			if dc.DiscountType == "percentage" {
				discountTotal = subtotal * dc.Value / 100
			} else {
				discountTotal = dc.Value
			}
			if discountTotal > subtotal {
				discountTotal = subtotal
			}
		}
	}

	// Calculate tax using the tax module (replaces hardcoded 8%)
	taxTotal := 0.0
	settings, sErr := h.store.GetTenantSettings(c.Request.Context(), tid)
	if sErr == nil && settings != nil {
		// Build tax calculation items from cart (tax_class_id is loaded with cart items)
		taxItems := make([]models.TaxCalculationItem, 0, len(cart.Items))
		for _, ci := range cart.Items {
			taxItems = append(taxItems, models.TaxCalculationItem{
				ProductID:   ci.ProductID,
				ProductName: ci.ProductName,
				Quantity:    ci.Quantity,
				UnitPrice:   ci.UnitPrice,
				LineTotal:   ci.LineTotal,
				TaxClassID:  ci.TaxClassID,
			})
		}
		taxReq := &models.TaxCalculationRequest{
			Items:           taxItems,
			ShippingAddress: req.ShippingAddress,
			ShippingTotal:   shippingTotal,
			DiscountTotal:   discountTotal,
		}
		taxResult, tErr := h.store.CalculateTax(c.Request.Context(), tid, taxReq, settings)
		if tErr == nil && taxResult != nil {
			taxTotal = taxResult.TaxTotal
		}
	}
	if taxTotal < 0 {
		taxTotal = 0
	}

	grandTotal := subtotal - discountTotal + shippingTotal + taxTotal
	if grandTotal < 0 {
		grandTotal = 0
	}

	// Convert PaymentDetails to a map for the gateway
	detailsMap := make(map[string]interface{})
	if req.PaymentDetails != nil {
		if req.PaymentDetails.CardNumber != "" {
			detailsMap["card_number"] = req.PaymentDetails.CardNumber
		}
		if req.PaymentDetails.CardName != "" {
			detailsMap["card_name"] = req.PaymentDetails.CardName
		}
		if req.PaymentDetails.CardExpiry != "" {
			detailsMap["card_expiry"] = req.PaymentDetails.CardExpiry
		}
		if req.PaymentDetails.CardCVV != "" {
			detailsMap["card_cvv"] = req.PaymentDetails.CardCVV
		}
		if req.PaymentDetails.CardLast4 != "" {
			detailsMap["card_last4"] = req.PaymentDetails.CardLast4
		}
		if req.PaymentDetails.CardBrand != "" {
			detailsMap["card_brand"] = req.PaymentDetails.CardBrand
		}
		if req.PaymentDetails.PaypalEmail != "" {
			detailsMap["paypal_email"] = req.PaymentDetails.PaypalEmail
		}
		if req.PaymentDetails.RazorpayOrderID != "" {
			detailsMap["razorpay_order_id"] = req.PaymentDetails.RazorpayOrderID
		}
		if req.PaymentDetails.RazorpayPaymentID != "" {
			detailsMap["razorpay_payment_id"] = req.PaymentDetails.RazorpayPaymentID
		}
		if req.PaymentDetails.RazorpaySignature != "" {
			detailsMap["razorpay_signature"] = req.PaymentDetails.RazorpaySignature
		}
	}

	// Process payment through the gateway (or wallet service for wallet payments)
	customerName := req.ShippingAddress.FirstName + " " + req.ShippingAddress.LastName

	var payResult *payment.PaymentResult
	var walletTxnID string

	if isWalletPayment {
		// Wallet payment: check balance and debit atomically
		walletTxn, wErr := h.store.DebitWallet(c.Request.Context(), tid, *uid, grandTotal, "purchase",
			"Payment for order", "", nil)
		if wErr != nil {
			if wErr == services.ErrInsufficientBalance {
				errResponse(c, http.StatusPaymentRequired, "insufficient wallet balance")
				return
			}
			if wErr == services.ErrWalletNotFound {
				errResponse(c, http.StatusPaymentRequired, "wallet not found — please add money to your wallet first")
				return
			}
			errResponse(c, http.StatusInternalServerError, "wallet payment failed: "+wErr.Error())
			return
		}
		walletTxnID = walletTxn.ID.String()
		payResult = &payment.PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: "wallet_" + walletTxn.ID.String()[:8],
			Message:       "Paid with wallet balance",
		}
	} else {
		pr, err := gateway.ProcessPayment(c.Request.Context(), payment.PaymentRequest{
			Amount:        grandTotal,
			Currency:      currency,
			OrderRef:      cart.ID.String(),
			CustomerName:  customerName,
			CustomerEmail: req.ShippingAddress.Email,
			Details:       detailsMap,
		})
		if err != nil {
			errResponse(c, http.StatusPaymentRequired, "payment processing failed: "+err.Error())
			return
		}
		payResult = pr
	}

	if !payResult.Success {
		// Record the failed payment transaction (order not created yet, so no order_id)
		// We use a nil order_id — the transaction is still tracked for analytics
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":          payResult.Message,
			"payment_status": payResult.Status,
		})
		return
	}

	// Set the order status from the payment result
	req.PaymentStatus = payResult.Status
	req.TransactionID = payResult.TransactionID

	order, err := h.store.CreateOrderFromCart(c.Request.Context(), cart, &req, uid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to create order: "+err.Error())
		return
	}

	// For wallet payments, link the wallet transaction to the created order
	if isWalletPayment && walletTxnID != "" {
		if wTxnID, pErr := uuid.Parse(walletTxnID); pErr == nil {
			_ = h.store.SetWalletTransactionOrder(c.Request.Context(), wTxnID, order.ID)
		}
	}

	// Record the payment transaction
	txnStatus := "success"
	if payResult.Status == "pending" {
		txnStatus = "pending"
	} else if payResult.Status == "failed" {
		txnStatus = "failed"
	}
	_ = h.store.RecordPaymentTransaction(c.Request.Context(), &models.PaymentTransaction{
		TenantID:      tid,
		OrderID:       order.ID,
		UserID:        uid,
		Gateway:       req.PaymentMethod,
		GatewayTxnID:  payResult.TransactionID,
		Type:          "capture",
		Status:        txnStatus,
		Amount:        grandTotal,
		CurrencyCode:  currency,
		CustomerEmail: req.ShippingAddress.Email,
		CustomerName:  customerName,
		GatewayResponse: map[string]interface{}{
			"message": payResult.Message,
		},
	})

	// Build response
	billingAddr := req.ShippingAddress
	if req.BillingAddress != nil {
		billingAddr = *req.BillingAddress
	}

	// Auto-save the shipping address to the customer's address book
	// (only for authenticated users, and only if not already saved)
	if uid != nil {
		shipAddr := &models.Address{
			UserID:     *uid,
			TenantID:   tid,
			Label:      "Shipping",
			FirstName:  req.ShippingAddress.FirstName,
			LastName:   req.ShippingAddress.LastName,
			Email:      req.ShippingAddress.Email,
			Line1:      req.ShippingAddress.Line1,
			Line2:      req.ShippingAddress.Line2,
			City:       req.ShippingAddress.City,
			State:      req.ShippingAddress.State,
			PostalCode: req.ShippingAddress.PostalCode,
			Country:    req.ShippingAddress.Country,
			Phone:      req.ShippingAddress.Phone,
			IsDefault:  false,
		}
		// Check if this address already exists to avoid duplicates
		_, matchErr := h.store.FindMatchingAddress(c.Request.Context(), tid, *uid, shipAddr)
		if matchErr != nil {
			// No match found — save it. Mark as default if the user has no addresses yet.
			existing, _ := h.store.ListAddresses(c.Request.Context(), tid, *uid)
			if len(existing) == 0 {
				shipAddr.IsDefault = true
			}
			_ = h.store.SaveAddress(c.Request.Context(), shipAddr)
		}

		// Also auto-save the billing address if it differs from shipping
		if req.BillingAddress != nil {
			billAddr := &models.Address{
				UserID:     *uid,
				TenantID:   tid,
				Label:      "Billing",
				FirstName:  req.BillingAddress.FirstName,
				LastName:   req.BillingAddress.LastName,
				Email:      req.BillingAddress.Email,
				Line1:      req.BillingAddress.Line1,
				Line2:      req.BillingAddress.Line2,
				City:       req.BillingAddress.City,
				State:      req.BillingAddress.State,
				PostalCode: req.BillingAddress.PostalCode,
				Country:    req.BillingAddress.Country,
				Phone:      req.BillingAddress.Phone,
				IsDefault:  false,
			}
			_, billMatchErr := h.store.FindMatchingAddress(c.Request.Context(), tid, *uid, billAddr)
			if billMatchErr != nil {
				_ = h.store.SaveAddress(c.Request.Context(), billAddr)
			}
		}
	}

	// Send order confirmation email (best-effort, never blocks the response)
	if order.CustomerEmail != "" {
		go h.sendOrderConfirmationEmail(tid, order, req.ShippingAddress, req.ShippingMethod, payResult.TransactionID)
	}

	c.JSON(http.StatusCreated, models.OrderResponse{
		Order:           *order,
		ShippingAddress: req.ShippingAddress,
		BillingAddress:  billingAddr,
		PaymentMethod:   req.PaymentMethod,
		PaymentDetails:  req.PaymentDetails,
		ShippingMethod:  req.ShippingMethod,
		TransactionID:   payResult.TransactionID,
	})
}

// sendOrderConfirmationEmail sends a transactional order confirmation email to the customer.
// Runs in a goroutine so it never blocks the checkout response. Errors are logged only.
func (h *CheckoutHandler) sendOrderConfirmationEmail(tid uuid.UUID, order *models.Order, shipAddr models.AddressInput, shipMethod, txnID string) {
	if h.emailH == nil {
		return
	}
	cfg := h.emailH.ResolveSMTPConfig(nil, tid)
	if cfg.Host == "" {
		return // SMTP not configured — skip silently
	}

	// Build a simple HTML email body
	items := ""
	if order.Items != nil {
		var rows strings.Builder
		for _, it := range order.Items {
			fmt.Fprintf(&rows, `<tr><td style="padding:8px;border-bottom:1px solid #eee">%s ×%d</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">%s %.2f</td></tr>`,
				escapeHTML(it.Name), it.Quantity, order.CurrencyCode, it.LineTotal)
		}
		items = rows.String()
	}

	body := fmt.Sprintf(`<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
<h1 style="color:#4f46e5">Thank you for your order!</h1>
<p>Hi %s,</p>
<p>We've received your order <strong>#%s</strong> and it's being processed.</p>
<table style="width:100%%;border-collapse:collapse;margin:16px 0">
<tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px;text-align:right">Total</th></tr>
%s
</table>
<table style="width:100%%;margin:16px 0">
<tr><td style="padding:4px 0">Subtotal</td><td style="text-align:right">%s %.2f</td></tr>
<tr><td style="padding:4px 0">Shipping</td><td style="text-align:right">%s %.2f</td></tr>
<tr><td style="padding:4px 0">Tax</td><td style="text-align:right">%s %.2f</td></tr>
<tr style="font-weight:bold;border-top:2px solid #ddd"><td style="padding:8px 0">Total</td><td style="text-align:right">%s %.2f</td></tr>
</table>
<p style="margin-top:24px;color:#666;font-size:12px">Shipping to: %s, %s, %s %s, %s</p>
<p style="color:#666;font-size:12px">Payment: %s (Txn: %s)</p>
<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
<p style="color:#999;font-size:12px">This is an automated email. Please don't reply.</p>
</body></html>`,
		escapeHTML(order.CustomerName),
		order.ID.String()[:8],
		items,
		order.CurrencyCode, order.Subtotal,
		order.CurrencyCode, order.ShippingTotal,
		order.CurrencyCode, order.TaxTotal,
		order.CurrencyCode, order.GrandTotal,
		escapeHTML(shipAddr.Line1), escapeHTML(shipAddr.City), escapeHTML(shipAddr.State), shipAddr.PostalCode, escapeHTML(shipAddr.Country),
		shipMethod, txnID,
	)

	if err := email.SendEmail(cfg, email.Email{
		To:      []string{order.CustomerEmail},
		Subject: fmt.Sprintf("Order Confirmation #%s", order.ID.String()[:8]),
		Body:    body,
	}); err != nil {
		slog.Warn("failed to send order confirmation email", "order_id", order.ID, "error", err)
	}
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}

// GetOrder returns a single order by ID with full details (for status pages).
func (h *CheckoutHandler) GetOrder(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	order, err := h.store.GetOrderWithDetails(c.Request.Context(), tid, orderID)
	if err != nil {
		notFoundOrErr(c, err, "order not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"order": order})
}

// ListMyOrders returns the authenticated customer's own order history.
func (h *CheckoutHandler) ListMyOrders(c *gin.Context) {
	tid := tenantID(c)
	uid := getUserID(c)
	if uid == nil {
		errResponse(c, http.StatusUnauthorized, "login required")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	orders, total, err := h.store.ListOrdersFiltered(c.Request.Context(), tid, services.OrderListFilter{
		Status: status,
		UserID: uid,
	}, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if orders == nil {
		orders = []models.Order{}
	}
	c.JSON(http.StatusOK, gin.H{"items": orders, "total": total, "limit": limit, "offset": offset})
}

// ============================================================
// Addresses (authenticated users only)
// ============================================================

type AddressHandler struct {
	store *services.Store
}

func NewAddressHandler(store *services.Store) *AddressHandler {
	return &AddressHandler{store: store}
}

func (h *AddressHandler) List(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)
	addrs, err := h.store.ListAddresses(c.Request.Context(), tid, uid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if addrs == nil {
		addrs = []models.Address{}
	}
	c.JSON(http.StatusOK, gin.H{"items": addrs, "total": len(addrs)})
}

type saveAddrReq struct {
	ID         string `json:"id,omitempty"`
	Label      string `json:"label"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Email      string `json:"email"`
	Line1      string `json:"line1" binding:"required"`
	Line2      string `json:"line2"`
	City       string `json:"city" binding:"required"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country" binding:"required"`
	Phone      string `json:"phone"`
	IsDefault  bool   `json:"is_default"`
}

func (h *AddressHandler) Save(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)

	var req saveAddrReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	var addrID uuid.UUID
	if req.ID != "" {
		id, err := uuid.Parse(req.ID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid address id")
			return
		}
		addrID = id
	}

	addr := models.Address{
		ID:         addrID,
		UserID:     uid,
		TenantID:   tid,
		Label:      req.Label,
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		Email:      req.Email,
		Line1:      req.Line1,
		Line2:      req.Line2,
		City:       req.City,
		State:      req.State,
		PostalCode: req.PostalCode,
		Country:    req.Country,
		Phone:      req.Phone,
		IsDefault:  req.IsDefault,
	}

	if err := h.store.SaveAddress(c.Request.Context(), &addr); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, addr)
}

func (h *AddressHandler) Delete(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)
	addrID, ok := pathUUID(c, "addressId")
	if !ok {
		return
	}
	if err := h.store.DeleteAddress(c.Request.Context(), tid, uid, addrID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
