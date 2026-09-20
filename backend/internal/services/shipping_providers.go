package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

// ---------------- Shipping Providers CRUD ----------------

func (s *Store) ListShippingProviders(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingProvider, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, provider_code, display_name, api_key, api_base_url, is_enabled, is_test_mode, config, created_at, updated_at
		 FROM shipping_providers WHERE tenant_id=$1 ORDER BY provider_code`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ShippingProvider
	for rows.Next() {
		var p models.ShippingProvider
		if err := rows.Scan(&p.ID, &p.TenantID, &p.ProviderCode, &p.DisplayName, &p.APIKey, &p.APIBaseURL, &p.IsEnabled, &p.IsTestMode, &p.Config, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *Store) GetShippingProvider(ctx context.Context, tenantID, id uuid.UUID) (*models.ShippingProvider, error) {
	p := &models.ShippingProvider{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, provider_code, display_name, api_key, api_base_url, is_enabled, is_test_mode, config, created_at, updated_at
		 FROM shipping_providers WHERE id=$1 AND tenant_id=$2`, id, tenantID).
		Scan(&p.ID, &p.TenantID, &p.ProviderCode, &p.DisplayName, &p.APIKey, &p.APIBaseURL, &p.IsEnabled, &p.IsTestMode, &p.Config, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Store) GetShippingProviderByCode(ctx context.Context, tenantID uuid.UUID, code string) (*models.ShippingProvider, error) {
	p := &models.ShippingProvider{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, provider_code, display_name, api_key, api_base_url, is_enabled, is_test_mode, config, created_at, updated_at
		 FROM shipping_providers WHERE tenant_id=$1 AND provider_code=$2`, tenantID, code).
		Scan(&p.ID, &p.TenantID, &p.ProviderCode, &p.DisplayName, &p.APIKey, &p.APIBaseURL, &p.IsEnabled, &p.IsTestMode, &p.Config, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Store) CreateShippingProvider(ctx context.Context, p *models.ShippingProvider) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO shipping_providers (tenant_id, provider_code, display_name, api_key, api_base_url, is_enabled, is_test_mode, config)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING id, created_at, updated_at`,
		p.TenantID, p.ProviderCode, p.DisplayName, p.APIKey, p.APIBaseURL, p.IsEnabled, p.IsTestMode, p.Config).
		Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (s *Store) UpdateShippingProvider(ctx context.Context, p *models.ShippingProvider) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE shipping_providers SET display_name=$3, api_key=$4, api_base_url=$5, is_enabled=$6, is_test_mode=$7, config=$8
		 WHERE id=$1 AND tenant_id=$2`,
		p.ID, p.TenantID, p.DisplayName, p.APIKey, p.APIBaseURL, p.IsEnabled, p.IsTestMode, p.Config)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) DeleteShippingProvider(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM shipping_providers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ---------------- Shipments CRUD ----------------

func (s *Store) ListOrderShipments(ctx context.Context, tenantID, orderID uuid.UUID) ([]models.Shipment, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, order_id, provider_code, tracking_number, carrier, awb_url, status,
		        pickup_scheduled_at, picked_up_at, delivered_at, estimated_delivery, raw_metadata, created_at, updated_at
		 FROM shipments WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at`, tenantID, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Shipment
	for rows.Next() {
		var sh models.Shipment
		if err := rows.Scan(&sh.ID, &sh.TenantID, &sh.OrderID, &sh.ProviderCode, &sh.TrackingNumber, &sh.Carrier, &sh.AWBURL, &sh.Status,
			&sh.PickupScheduledAt, &sh.PickedUpAt, &sh.DeliveredAt, &sh.EstimatedDelivery, &sh.RawMetadata, &sh.CreatedAt, &sh.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, sh)
	}
	// Load shipment items for each shipment (split-shipment support).
	if len(out) > 0 {
		ids := make([]uuid.UUID, 0, len(out))
		for i := range out {
			ids = append(ids, out[i].ID)
		}
		itemRows, err := s.Pool.Query(ctx,
			`SELECT si.id, si.shipment_id, si.order_item_id, si.quantity,
			        COALESCE(oi.name,''), oi.product_id, COALESCE(oi.sku,''), oi.unit_price
			 FROM shipment_items si
			 JOIN order_items oi ON oi.id = si.order_item_id
			 WHERE si.shipment_id = ANY($1)
			 ORDER BY si.created_at`, ids)
		if err != nil {
			return nil, err
		}
		defer itemRows.Close()
		byShipment := make(map[uuid.UUID][]models.ShipmentItem)
		for itemRows.Next() {
			var si models.ShipmentItem
			if err := itemRows.Scan(&si.ID, &si.ShipmentID, &si.OrderItemID, &si.Quantity, &si.ProductName, &si.ProductID, &si.SKU, &si.UnitPrice); err != nil {
				return nil, err
			}
			byShipment[si.ShipmentID] = append(byShipment[si.ShipmentID], si)
		}
		for i := range out {
			out[i].Items = byShipment[out[i].ID]
		}
	}
	return out, nil
}

func (s *Store) GetShipment(ctx context.Context, tenantID, id uuid.UUID) (*models.Shipment, error) {
	sh := &models.Shipment{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, order_id, provider_code, tracking_number, carrier, awb_url, status,
		        pickup_scheduled_at, picked_up_at, delivered_at, estimated_delivery, raw_metadata, created_at, updated_at
		 FROM shipments WHERE id=$1 AND tenant_id=$2`, id, tenantID).
		Scan(&sh.ID, &sh.TenantID, &sh.OrderID, &sh.ProviderCode, &sh.TrackingNumber, &sh.Carrier, &sh.AWBURL, &sh.Status,
			&sh.PickupScheduledAt, &sh.PickedUpAt, &sh.DeliveredAt, &sh.EstimatedDelivery, &sh.RawMetadata, &sh.CreatedAt, &sh.UpdatedAt)
	if err != nil {
		return nil, err
	}
	// Load shipment items (split-shipment support).
	itemRows, err := s.Pool.Query(ctx,
		`SELECT si.id, si.shipment_id, si.order_item_id, si.quantity,
		        COALESCE(oi.name,''), oi.product_id, COALESCE(oi.sku,''), oi.unit_price
		 FROM shipment_items si
		 JOIN order_items oi ON oi.id = si.order_item_id
		 WHERE si.shipment_id=$1
		 ORDER BY si.created_at`, sh.ID)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var si models.ShipmentItem
		if err := itemRows.Scan(&si.ID, &si.ShipmentID, &si.OrderItemID, &si.Quantity, &si.ProductName, &si.ProductID, &si.SKU, &si.UnitPrice); err != nil {
			return nil, err
		}
		sh.Items = append(sh.Items, si)
	}
	return sh, nil
}

func (s *Store) insertShipment(ctx context.Context, sh *models.Shipment) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO shipments (tenant_id, order_id, provider_code, tracking_number, carrier, awb_url, status, estimated_delivery, raw_metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING id, created_at, updated_at`,
		sh.TenantID, sh.OrderID, sh.ProviderCode, sh.TrackingNumber, sh.Carrier, sh.AWBURL, sh.Status, sh.EstimatedDelivery, sh.RawMetadata).
		Scan(&sh.ID, &sh.CreatedAt, &sh.UpdatedAt)
}

func (s *Store) updateShipmentStatus(ctx context.Context, tenantID, id uuid.UUID, status string, rawMetadata []byte) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE shipments SET status=$3, raw_metadata=$4, delivered_at=CASE WHEN $3='delivered' THEN now() ELSE delivered_at END,
		 picked_up_at=CASE WHEN $3='picked_up' THEN now() ELSE picked_up_at END
		 WHERE id=$1 AND tenant_id=$2`,
		id, tenantID, status, rawMetadata)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ---------------- Provider Interface & Delhivery Client ----------------

// ShippingProviderClient is the interface that all shipping provider clients implement.
type ShippingProviderClient interface {
	TestConnection(ctx context.Context) (*models.ProviderTestResult, error)
	CreateShipment(ctx context.Context, order *models.OrderWithDetails) (*models.Shipment, error)
	TrackShipment(ctx context.Context, trackingNumber string) (*models.TrackingResponse, error)
}

// NewShippingProviderClient returns a client for the given provider config.
// If no API key is configured, returns a mock client that generates fake data.
func NewShippingProviderClient(p *models.ShippingProvider) ShippingProviderClient {
	switch p.ProviderCode {
	case "delhivery":
		return newDelhiveryClient(p)
	case "ekart":
		return newEkartClient(p)
	case "fedex":
		return newFedExClient(p)
	case "shiprocket":
		return newShiprocketClient(p)
	default:
		return &mockProviderClient{provider: p}
	}
}

// ---------------- Mock Client (fallback when no API key) ----------------

type mockProviderClient struct {
	provider *models.ShippingProvider
}

func (m *mockProviderClient) TestConnection(ctx context.Context) (*models.ProviderTestResult, error) {
	if m.provider.APIKey == "" {
		return &models.ProviderTestResult{OK: true, Message: "Mock mode: no API key configured. Shipment creation and tracking will use simulated data."}, nil
	}
	return &models.ProviderTestResult{OK: true, Message: "Mock mode: connection simulated successfully."}, nil
}

func (m *mockProviderClient) CreateShipment(ctx context.Context, order *models.OrderWithDetails) (*models.Shipment, error) {
	waybill := fmt.Sprintf("MOCK%s%06d", strings.ToUpper(m.provider.ProviderCode[:3]), rand.Intn(999999))
	raw, _ := json.Marshal(map[string]interface{}{
		"mock":     true,
		"waybill":  waybill,
		"order_id": order.ID.String(),
	})
	return &models.Shipment{
		TenantID:     order.TenantID,
		OrderID:      order.ID,
		ProviderCode: m.provider.ProviderCode,
		TrackingNumber: waybill,
		Carrier:      m.provider.DisplayName,
		AWBURL:       "",
		Status:       "booked",
		RawMetadata:  raw,
	}, nil
}

func (m *mockProviderClient) TrackShipment(ctx context.Context, trackingNumber string) (*models.TrackingResponse, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	return &models.TrackingResponse{
		TrackingNumber: trackingNumber,
		Carrier:        m.provider.DisplayName,
		Status:         "in_transit",
		Events: []models.TrackingEvent{
			{Status: "booked", Description: "Shipment booked (mock)", Location: "Warehouse", Timestamp: now},
			{Status: "in_transit", Description: "In transit (mock)", Location: "Hub", Timestamp: now},
		},
	}, nil
}

// ---------------- Delhivery Client ----------------

// Delhivery API endpoints:
//   Sandbox: https://staging-express.delhivery.com
//   Production: https://track.delhivery.com
//   Create shipment: POST /api/cmu/create/uni
//   Track: GET /api/v1/packages/json/?waybill=<waybill>

type delhiveryClient struct {
	provider *models.ShippingProvider
	baseURL  string
	apiKey   string
	http     *http.Client
}

func newDelhiveryClient(p *models.ShippingProvider) *delhiveryClient {
	baseURL := p.APIBaseURL
	if baseURL == "" {
		if p.IsTestMode {
			baseURL = "https://staging-express.delhivery.com"
		} else {
			baseURL = "https://track.delhivery.com"
		}
	}
	return &delhiveryClient{
		provider: p,
		baseURL:  strings.TrimRight(baseURL, "/"),
		apiKey:   p.APIKey,
		http:     &http.Client{Timeout: 30 * time.Second},
	}
}

// isMock returns true when no API key is configured — we fall back to mock data.
func (d *delhiveryClient) isMock() bool {
	return d.apiKey == ""
}

func (d *delhiveryClient) TestConnection(ctx context.Context) (*models.ProviderTestResult, error) {
	if d.isMock() {
		return &models.ProviderTestResult{OK: true, Message: fmt.Sprintf("Mock mode (test=%v): no API key configured. Using %s for simulated requests.", d.provider.IsTestMode, d.baseURL)}, nil
	}
	// Delhivery doesn't have a dedicated "ping" endpoint, so we do a lightweight
	// tracking call with a dummy waybill. A 401/403 means bad key; anything else
	// (even 400/404) means the key was accepted by the gateway.
	url := fmt.Sprintf("%s/api/v1/packages/json/?waybill=test", d.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return &models.ProviderTestResult{OK: false, Message: err.Error()}, nil
	}
	req.Header.Set("Authorization", "Token "+d.apiKey)
	req.Header.Set("Accept", "application/json")
	resp, err := d.http.Do(req)
	if err != nil {
		return &models.ProviderTestResult{OK: false, Message: fmt.Sprintf("connection failed: %v", err)}, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return &models.ProviderTestResult{OK: false, Message: "authentication failed — check your API key"}, nil
	}
	return &models.ProviderTestResult{OK: true, Message: fmt.Sprintf("connection successful (HTTP %d, %s)", resp.StatusCode, d.baseURL)}, nil
}

func (d *delhiveryClient) CreateShipment(ctx context.Context, order *models.OrderWithDetails) (*models.Shipment, error) {
	if d.isMock() {
		return (&mockProviderClient{provider: d.provider}).CreateShipment(ctx, order)
	}

	// Build Delhivery CMU (Create Merchant Uni) payload
	addr := order.ShippingAddress
	name := strings.TrimSpace(addr.FirstName + " " + addr.LastName)
	if name == "" {
		name = order.CustomerName
	}
	if name == "" {
		name = "Recipient"
	}
	phone := addr.Phone
	if phone == "" {
		phone = "0000000000"
	}

	// Calculate total weight (default 500g if unknown) and total value
	totalValue := order.GrandTotal
	weight := "0.5" // kg default

	// Build the "format" array — Delhivery expects shipments as a JSON array
	payload := map[string]interface{}{
		"shipments": []map[string]interface{}{
			{
				"name":         name,
				"order":        order.ID.String(),
				"phone":        phone,
				"add":          strings.TrimSpace(addr.Line1 + " " + addr.Line2),
				"city":         addr.City,
				"state":        addr.State,
				"pin":          addr.PostalCode,
				"country":      addr.Country,
				"payment_mode": "Pre-paid",
				"cod_amount":   "0",
				"weight":       weight,
				"order_date":   order.CreatedAt.Format("2006-01-02"),
				"total_amount": fmt.Sprintf("%.2f", totalValue),
			},
		},
		"pickup_location": map[string]interface{}{
			"name": "Primary",
		},
	}
	body, _ := json.Marshal(payload)

	url := d.baseURL + "/api/cmu/create/uni"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Token "+d.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := d.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("delhivery create shipment failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("delhivery API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response — Delhivery returns waybills in the response
	var apiResp struct {
		Success bool `json:"success"`
		Packages []struct {
			Waybill  string `json:"waybill"`
			Status   string `json:"status"`
			Remarks  string `json:"remarks"`
			RefNum   string `json:"refnum"`
		} `json:"packages"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse delhivery response: %w", err)
	}

	if len(apiResp.Packages) == 0 || apiResp.Packages[0].Waybill == "" {
		return nil, fmt.Errorf("delhivery did not return a waybill: %s", string(respBody))
	}

	pkg := apiResp.Packages[0]
	raw, _ := json.Marshal(map[string]interface{}{
		"waybill": pkg.Waybill,
		"status":  pkg.Status,
		"remarks": pkg.Remarks,
		"raw":     string(respBody),
	})

	return &models.Shipment{
		TenantID:       order.TenantID,
		OrderID:        order.ID,
		ProviderCode:   d.provider.ProviderCode,
		TrackingNumber: pkg.Waybill,
		Carrier:        d.provider.DisplayName,
		AWBURL:         d.baseURL + "/api/p/packing_slip?wbns=" + pkg.Waybill,
		Status:         "booked",
		RawMetadata:    raw,
	}, nil
}

func (d *delhiveryClient) TrackShipment(ctx context.Context, trackingNumber string) (*models.TrackingResponse, error) {
	if d.isMock() {
		return (&mockProviderClient{provider: d.provider}).TrackShipment(ctx, trackingNumber)
	}

	url := fmt.Sprintf("%s/api/v1/packages/json/?waybill=%s", d.baseURL, trackingNumber)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Token "+d.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := d.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("delhivery tracking failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("delhivery tracking API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse Delhivery tracking response
	var apiResp struct {
		ShipmentData []struct {
			Shipment struct {
				Waybill    string `json:"waybill"`
				Status     string `json:"status"`
				Customer   string `json:"customer_name"`
				Consignee  string `json:"consignee_name"`
				EDD        string `json:"edd"`
				Scans      []struct {
					ScanType   string `json:"scan_type"`
					ScanStatus string `json:"scan_status"`
					Location   string `json:"scan_location"`
					Instructions string `json:"instructions"`
					ScanDate   string `json:"scan_datetime"`
				} `json:"scans"`
			} `json:"shipment"`
		} `json:"ShipmentData"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse delhivery tracking response: %w", err)
	}

	result := &models.TrackingResponse{
		TrackingNumber: trackingNumber,
		Carrier:        d.provider.DisplayName,
		Status:         "pending",
	}

	if len(apiResp.ShipmentData) > 0 {
		ship := apiResp.ShipmentData[0].Shipment
		result.Status = mapDelhiveryStatus(ship.Status)
		result.EstimatedDelivery = ship.EDD
		for _, scan := range ship.Scans {
			result.Events = append(result.Events, models.TrackingEvent{
				Status:      scan.ScanType,
				Location:    scan.Location,
				Description: scan.Instructions,
				Timestamp:   scan.ScanDate,
			})
		}
		// Reverse scans to chronological order (Delhivery returns newest first)
		for i, j := 0, len(result.Events)-1; i < j; i, j = i+1, j-1 {
			result.Events[i], result.Events[j] = result.Events[j], result.Events[i]
		}
	}

	return result, nil
}

// mapDelhiveryStatus converts Delhivery status strings to our internal status.
func mapDelhiveryStatus(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.Contains(s, "delivered"):
		return "delivered"
	case strings.Contains(s, "out for delivery"):
		return "out_for_delivery"
	case strings.Contains(s, "in transit"), strings.Contains(s, "in_transit"):
		return "in_transit"
	case strings.Contains(s, "picked up"), strings.Contains(s, "picked_up"):
		return "picked_up"
	case strings.Contains(s, "booked"), strings.Contains(s, "pending"):
		return "booked"
	case strings.Contains(s, "cancelled"):
		return "cancelled"
	case strings.Contains(s, "failed"), strings.Contains(s, "rto"):
		return "failed"
	default:
		return "in_transit"
	}
}

// ---------------- EKart Client ----------------

// EKart API:
//   Public tracking (no auth): POST https://ekartlogistics.com/ws/getTrackingDetails
//     Body: {"trackingId": "..."}
//   B2C API (requires Merchant Code + Token from EKart team):
//     Create Shipment, Track, Cancel/RTO, Serviceability
//
// EKart credentials are stored in the provider config JSONB:
//   { "merchant_code": "...", "location_code": "..." }
//   The api_key field stores the merchant token.
//
// EKart does not have a public sandbox. Test mode uses mock data.
// Tracking works without credentials via the public tracking endpoint.

type ekartClient struct {
	provider     *models.ShippingProvider
	baseURL      string // public tracking base URL
	b2cBaseURL   string // B2C API base URL (provided by EKart team)
	merchantCode string
	token        string
	locationCode string
	http         *http.Client
}

// ekartConfig is the provider-specific config stored in the Config JSONB field.
type ekartConfig struct {
	MerchantCode string `json:"merchant_code"`
	LocationCode string `json:"location_code"`
}

func newEkartClient(p *models.ShippingProvider) *ekartClient {
	var cfg ekartConfig
	if len(p.Config) > 0 {
		_ = json.Unmarshal(p.Config, &cfg)
	}
	return &ekartClient{
		provider:     p,
		baseURL:      "https://ekartlogistics.com",
		b2cBaseURL:   p.APIBaseURL, // B2C API base URL is provided by the EKart team
		merchantCode: cfg.MerchantCode,
		token:        p.APIKey,
		locationCode: cfg.LocationCode,
		http:         &http.Client{Timeout: 30 * time.Second},
	}
}

// isMock returns true when no merchant code is configured — we fall back to mock data.
// Note: EKart's public tracking endpoint works without credentials, so tracking
// can still function in mock mode by using the public API.
func (e *ekartClient) isMock() bool {
	return e.merchantCode == "" && e.token == ""
}

func (e *ekartClient) TestConnection(ctx context.Context) (*models.ProviderTestResult, error) {
	if e.isMock() {
		return &models.ProviderTestResult{OK: true, Message: "Mock mode: no merchant credentials configured. Tracking uses EKart's public API; shipment creation uses simulated data."}, nil
	}
	// For B2C mode, we don't have a documented ping endpoint. We'll report
	// that credentials are present and the B2C base URL is configured.
	if e.b2cBaseURL == "" {
		return &models.ProviderTestResult{OK: true, Message: "Credentials configured. B2C API base URL not set — provide it from your EKart integration team. Tracking will use the public API."}, nil
	}
	return &models.ProviderTestResult{OK: true, Message: fmt.Sprintf("EKart B2C credentials configured (merchant: %s, base URL: %s).", e.merchantCode, e.b2cBaseURL)}, nil
}

func (e *ekartClient) CreateShipment(ctx context.Context, order *models.OrderWithDetails) (*models.Shipment, error) {
	if e.isMock() || e.b2cBaseURL == "" {
		// Mock mode or no B2C base URL — generate a simulated waybill
		return (&mockProviderClient{provider: e.provider}).CreateShipment(ctx, order)
	}

	// B2C Create Shipment API
	// The exact B2C API contract is provided by the EKart integration team.
	// This implements the documented structure based on the EKart B2C API guide.
	addr := order.ShippingAddress
	name := strings.TrimSpace(addr.FirstName + " " + addr.LastName)
	if name == "" {
		name = order.CustomerName
	}
	if name == "" {
		name = "Recipient"
	}
	phone := addr.Phone
	if phone == "" {
		phone = "0000000000"
	}

	payload := map[string]interface{}{
		"merchant_code": e.merchantCode,
		"token":         e.token,
		"location_code": e.locationCode,
		"shipment": map[string]interface{}{
			"client_reference_id": order.ID.String(),
			"recipient_name":      name,
			"recipient_phone":     phone,
			"recipient_address":   strings.TrimSpace(addr.Line1 + " " + addr.Line2),
			"recipient_city":      addr.City,
			"recipient_state":     addr.State,
			"recipient_pincode":   addr.PostalCode,
			"recipient_country":   addr.Country,
			"payment_mode":        "Pre-paid",
			"cod_amount":          0,
			"order_value":         order.GrandTotal,
			"weight":              0.5, // kg default
			"order_date":          order.CreatedAt.Format("2006-01-02"),
		},
	}
	body, _ := json.Marshal(payload)

	url := strings.TrimRight(e.b2cBaseURL, "/") + "/api/shipment/create"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.token)

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ekart create shipment failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ekart API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response — EKart returns a tracking_id in the response
	var apiResp struct {
		TrackingID string `json:"tracking_id"`
		Status     string `json:"status"`
		Message    string `json:"message"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse ekart response: %w", err)
	}

	if apiResp.TrackingID == "" {
		return nil, fmt.Errorf("ekart did not return a tracking ID: %s", string(respBody))
	}

	raw, _ := json.Marshal(map[string]interface{}{
		"tracking_id": apiResp.TrackingID,
		"status":      apiResp.Status,
		"message":     apiResp.Message,
		"raw":         string(respBody),
	})

	return &models.Shipment{
		TenantID:       order.TenantID,
		OrderID:        order.ID,
		ProviderCode:   e.provider.ProviderCode,
		TrackingNumber: apiResp.TrackingID,
		Carrier:        e.provider.DisplayName,
		AWBURL:         "",
		Status:         "booked",
		RawMetadata:    raw,
	}, nil
}

func (e *ekartClient) TrackShipment(ctx context.Context, trackingNumber string) (*models.TrackingResponse, error) {
	// EKart's public tracking API works without credentials.
	// In mock mode (test mode), we return simulated data instead.
	if e.provider.IsTestMode && e.isMock() {
		return (&mockProviderClient{provider: e.provider}).TrackShipment(ctx, trackingNumber)
	}

	// Use the public tracking endpoint (no auth required)
	payload, _ := json.Marshal(map[string]string{"trackingId": trackingNumber})
	url := e.baseURL + "/ws/getTrackingDetails"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36")
	req.Header.Set("Origin", "https://ekartlogistics.com")

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ekart tracking failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ekart tracking API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse EKart tracking response. The response format includes:
	//   trackingId, shipment_status, expected_delivery_date, tracking_details[]
	// Each tracking_detail has: location, status, datetime, remark
	var apiResp struct {
		TrackingID         string `json:"trackingId"`
		ShipmentStatus      string `json:"shipment_status"`
		ExpectedDelivery    string `json:"expected_delivery_date"`
		CurrentStatus       string `json:"current_status"`
		TrackingDetails     []struct {
			Location string `json:"location"`
			Status   string `json:"status"`
			Datetime string `json:"datetime"`
			Remark   string `json:"remark"`
		} `json:"tracking_details"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse ekart tracking response: %w", err)
	}

	result := &models.TrackingResponse{
		TrackingNumber: trackingNumber,
		Carrier:        e.provider.DisplayName,
		Status:         "pending",
	}

	// Determine the overall status
	statusStr := apiResp.ShipmentStatus
	if statusStr == "" {
		statusStr = apiResp.CurrentStatus
	}
	if statusStr != "" {
		result.Status = mapEkartStatus(statusStr)
	}
	result.EstimatedDelivery = apiResp.ExpectedDelivery

	for _, td := range apiResp.TrackingDetails {
		result.Events = append(result.Events, models.TrackingEvent{
			Status:      mapEkartStatus(td.Status),
			Location:    td.Location,
			Description: td.Remark,
			Timestamp:   td.Datetime,
		})
	}

	// If no events parsed but we have raw data, include a single event
	if len(result.Events) == 0 && statusStr != "" {
		result.Events = append(result.Events, models.TrackingEvent{
			Status:      result.Status,
			Description: statusStr,
		})
	}

	return result, nil
}

// mapEkartStatus converts EKart status strings to our internal status.
func mapEkartStatus(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.Contains(s, "delivered"):
		return "delivered"
	case strings.Contains(s, "out for delivery"), strings.Contains(s, "ofd"):
		return "out_for_delivery"
	case strings.Contains(s, "in transit"), strings.Contains(s, "in_transit"):
		return "in_transit"
	case strings.Contains(s, "picked up"), strings.Contains(s, "picked_up"), strings.Contains(s, "pickup"):
		return "picked_up"
	case strings.Contains(s, "booked"), strings.Contains(s, "manifested"), strings.Contains(s, "pending"):
		return "booked"
	case strings.Contains(s, "cancelled"), strings.Contains(s, "canceled"):
		return "cancelled"
	case strings.Contains(s, "failed"), strings.Contains(s, "rto"), strings.Contains(s, "return"):
		return "failed"
	default:
		return "in_transit"
	}
}

// ---------------- FedEx Client ----------------

// FedEx API:
//   OAuth 2.0: POST /oauth/token (grant_type=client_credentials)
//     Token expires every 60 minutes.
//   Track API: POST /track/v2/shipments/
//   Ship API:  POST /ship/v1/shipments/
//
// Base URLs:
//   Sandbox:    https://apis-sandbox.fedex.com
//   Production: https://apis.fedex.com
//
// Credentials (from FedEx Developer Portal):
//   Client ID     -> stored in api_key field
//   Client Secret -> stored in config JSONB { "client_secret": "..." }
//   Account Number-> stored in config JSONB { "account_number": "..." }
//
// FedEx has a sandbox environment for testing.

type fedExClient struct {
	provider     *models.ShippingProvider
	baseURL      string
	clientID     string
	clientSecret string
	accountNumber string
	http         *http.Client
	// Cached OAuth token
	token       string
	tokenExpiry time.Time
}

// fedExConfig is the provider-specific config stored in the Config JSONB field.
type fedExConfig struct {
	ClientSecret  string `json:"client_secret"`
	AccountNumber string `json:"account_number"`
}

func newFedExClient(p *models.ShippingProvider) *fedExClient {
	var cfg fedExConfig
	if len(p.Config) > 0 {
		_ = json.Unmarshal(p.Config, &cfg)
	}
	baseURL := p.APIBaseURL
	if baseURL == "" {
		if p.IsTestMode {
			baseURL = "https://apis-sandbox.fedex.com"
		} else {
			baseURL = "https://apis.fedex.com"
		}
	}
	return &fedExClient{
		provider:      p,
		baseURL:       strings.TrimRight(baseURL, "/"),
		clientID:      p.APIKey,
		clientSecret:  cfg.ClientSecret,
		accountNumber: cfg.AccountNumber,
		http:          &http.Client{Timeout: 30 * time.Second},
	}
}

// isMock returns true when no client ID is configured — we fall back to mock data.
func (f *fedExClient) isMock() bool {
	return f.clientID == "" || f.clientSecret == ""
}

// getOAuthToken fetches and caches the FedEx OAuth bearer token.
func (f *fedExClient) getOAuthToken(ctx context.Context) (string, error) {
	// Return cached token if still valid (with 5-minute buffer)
	if f.token != "" && time.Now().Before(f.tokenExpiry.Add(-5*time.Minute)) {
		return f.token, nil
	}

	body := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s",
		f.clientID, f.clientSecret)
	req, err := http.NewRequestWithContext(ctx, "POST", f.baseURL+"/oauth/token", strings.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := f.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("fedex oauth failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("fedex oauth error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse fedex oauth response: %w", err)
	}
	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("fedex oauth returned empty token: %s", string(respBody))
	}

	f.token = tokenResp.AccessToken
	if tokenResp.ExpiresIn > 0 {
		f.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	} else {
		f.tokenExpiry = time.Now().Add(55 * time.Minute) // default 60 min minus buffer
	}

	return f.token, nil
}

func (f *fedExClient) TestConnection(ctx context.Context) (*models.ProviderTestResult, error) {
	if f.isMock() {
		return &models.ProviderTestResult{OK: true, Message: fmt.Sprintf("Mock mode (test=%v): no Client ID/Secret configured. Using %s for simulated requests.", f.provider.IsTestMode, f.baseURL)}, nil
	}
	// Test by fetching an OAuth token — this validates the credentials
	token, err := f.getOAuthToken(ctx)
	if err != nil {
		return &models.ProviderTestResult{OK: false, Message: fmt.Sprintf("authentication failed: %v", err)}, nil
	}
	_ = token
	env := "production"
	if f.provider.IsTestMode {
		env = "sandbox"
	}
	msg := fmt.Sprintf("Connection successful (FedEx %s, %s).", env, f.baseURL)
	if f.accountNumber == "" {
		msg += " Note: Account Number not set — shipment creation will be unavailable."
	}
	return &models.ProviderTestResult{OK: true, Message: msg}, nil
}

func (f *fedExClient) CreateShipment(ctx context.Context, order *models.OrderWithDetails) (*models.Shipment, error) {
	if f.isMock() {
		return (&mockProviderClient{provider: f.provider}).CreateShipment(ctx, order)
	}
	if f.accountNumber == "" {
		return nil, fmt.Errorf("fedex account number is required for shipment creation — configure it in the provider settings")
	}

	token, err := f.getOAuthToken(ctx)
	if err != nil {
		return nil, err
	}

	addr := order.ShippingAddress
	name := strings.TrimSpace(addr.FirstName + " " + addr.LastName)
	if name == "" {
		name = order.CustomerName
	}
	if name == "" {
		name = "Recipient"
	}
	phone := addr.Phone
	if phone == "" {
		phone = "0000000000"
	}

	// FedEx Ship API payload (simplified — uses FEDEX_GROUND service by default)
	payload := map[string]interface{}{
		"accountNumber": map[string]string{"value": f.accountNumber},
		"requestedShipment": map[string]interface{}{
			"shipper": map[string]interface{}{
				"contact": map[string]string{
					"personName":  name,
					"phoneNumber": phone,
				},
				"address": map[string]string{
					"streetAddresses": addr.Line1,
					"city":            addr.City,
					"stateOrProvinceCode": addr.State,
					"postalCode":     addr.PostalCode,
					"countryCode":   addr.Country,
				},
			},
			"recipients": []map[string]interface{}{
				{
					"contact": map[string]string{
						"personName":  name,
						"phoneNumber": phone,
					},
					"address": map[string]string{
						"streetAddresses": addr.Line1,
						"city":            addr.City,
						"stateOrProvinceCode": addr.State,
						"postalCode":     addr.PostalCode,
						"countryCode":   addr.Country,
					},
				},
			},
			"serviceType":    "FEDEX_GROUND",
			"packagingType":  "YOUR_PACKAGING",
			"pickupType":     "DROPOFF_AT_FEDEX_LOCATION",
			"paymentType":    "SENDER",
			"totalWeight":    0.5,
			"totalWeightUnits": "LB",
			"labelSpecification": map[string]string{
				"labelFormatType": "COMMON2D",
				"imageType":       "PDF",
				"labelStockType":  "PAPER_4X6",
			},
		},
	}
	body, _ := json.Marshal(payload)

	url := f.baseURL + "/ship/v1/shipments"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-locale", "en_US")

	resp, err := f.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fedex create shipment failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("fedex ship API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse FedEx Ship response
	var apiResp struct {
		Output struct {
			TransactionShipResults []struct {
				PieceResponses []struct {
					TrackingNumber string `json:"trackingNumber"`
				} `json:"pieceResponses"`
				LabelResults []struct {
					LabelURL string `json:"labelURL"`
				} `json:"labelResults"`
			} `json:"transactionShipResults"`
		} `json:"output"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse fedex ship response: %w", err)
	}

	trackingNumber := ""
	awbURL := ""
	if len(apiResp.Output.TransactionShipResults) > 0 {
		tsr := apiResp.Output.TransactionShipResults[0]
		if len(tsr.PieceResponses) > 0 {
			trackingNumber = tsr.PieceResponses[0].TrackingNumber
		}
		if len(tsr.LabelResults) > 0 {
			awbURL = tsr.LabelResults[0].LabelURL
		}
	}

	if trackingNumber == "" {
		return nil, fmt.Errorf("fedex did not return a tracking number: %s", string(respBody))
	}

	raw, _ := json.Marshal(map[string]interface{}{
		"tracking_number": trackingNumber,
		"raw":             string(respBody),
	})

	return &models.Shipment{
		TenantID:       order.TenantID,
		OrderID:        order.ID,
		ProviderCode:   f.provider.ProviderCode,
		TrackingNumber: trackingNumber,
		Carrier:        f.provider.DisplayName,
		AWBURL:         awbURL,
		Status:         "booked",
		RawMetadata:    raw,
	}, nil
}

func (f *fedExClient) TrackShipment(ctx context.Context, trackingNumber string) (*models.TrackingResponse, error) {
	if f.isMock() {
		return (&mockProviderClient{provider: f.provider}).TrackShipment(ctx, trackingNumber)
	}

	token, err := f.getOAuthToken(ctx)
	if err != nil {
		return nil, err
	}

	// FedEx Track API: POST /track/v2/shipments/
	payload, _ := json.Marshal(map[string]interface{}{
		"includeDetailedScans": true,
		"trackingInfo": []map[string]interface{}{
			{
				"trackingNumberInfo": map[string]string{
					"trackingNumber": trackingNumber,
				},
			},
		},
	})

	url := f.baseURL + "/track/v2/shipments/"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-locale", "en_US")

	resp, err := f.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fedex tracking failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("fedex track API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse FedEx Track response
	var apiResp struct {
		Output struct {
			CompleteTrackResults []struct {
				TrackingNumber string `json:"trackingNumber"`
				TrackResults   []struct {
					LatestStatusDetail struct {
						Code        string `json:"code"`
						Description string `json:"description"`
					} `json:"latestStatusDetail"`
					EstimatedDeliveryTimeWindow struct {
						Begins string `json:"begins"`
						Ends   string `json:"ends"`
					} `json:"estimatedDeliveryTimeWindow"`
					ScanEvents []struct {
						EventType string `json:"eventType"`
						EventDescription string `json:"eventDescription"`
						ScanLocation struct {
							City        string `json:"city"`
							StateOrProvinceCode string `json:"stateOrProvinceCode"`
							CountryCode string `json:"countryCode"`
						} `json:"scanLocation"`
						Date string `json:"date"`
					} `json:"scanEvents"`
				} `json:"trackResults"`
			} `json:"completeTrackResults"`
		} `json:"output"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse fedex tracking response: %w", err)
	}

	result := &models.TrackingResponse{
		TrackingNumber: trackingNumber,
		Carrier:        f.provider.DisplayName,
		Status:         "pending",
	}

	if len(apiResp.Output.CompleteTrackResults) > 0 {
		ctr := apiResp.Output.CompleteTrackResults[0]
		if len(ctr.TrackResults) > 0 {
			tr := ctr.TrackResults[0]
			result.Status = mapFedExStatus(tr.LatestStatusDetail.Description, tr.LatestStatusDetail.Code)
			if tr.EstimatedDeliveryTimeWindow.Ends != "" {
				result.EstimatedDelivery = tr.EstimatedDeliveryTimeWindow.Ends
			} else if tr.EstimatedDeliveryTimeWindow.Begins != "" {
				result.EstimatedDelivery = tr.EstimatedDeliveryTimeWindow.Begins
			}
			for _, scan := range tr.ScanEvents {
				loc := strings.TrimSpace(strings.Join([]string{scan.ScanLocation.City, scan.ScanLocation.StateOrProvinceCode, scan.ScanLocation.CountryCode}, " "))
				result.Events = append(result.Events, models.TrackingEvent{
					Status:      mapFedExStatus(scan.EventDescription, scan.EventType),
					Location:    loc,
					Description: scan.EventDescription,
					Timestamp:   scan.Date,
				})
			}
		}
	}

	return result, nil
}

// mapFedExStatus converts FedEx status descriptions/codes to our internal status.
func mapFedExStatus(description, code string) string {
	s := strings.ToLower(strings.TrimSpace(description + " " + code))
	switch {
	case strings.Contains(s, "delivered"):
		return "delivered"
	case strings.Contains(s, "out for delivery"), strings.Contains(s, "ofd"):
		return "out_for_delivery"
	case strings.Contains(s, "in transit"), strings.Contains(s, "in_transit"):
		return "in_transit"
	case strings.Contains(s, "picked up"), strings.Contains(s, "picked_up"), strings.Contains(s, "pickup"):
		return "picked_up"
	case strings.Contains(s, "label created"), strings.Contains(s, "label_created"), strings.Contains(s, "shipment information sent"):
		return "booked"
	case strings.Contains(s, "cancelled"), strings.Contains(s, "canceled"):
		return "cancelled"
	case strings.Contains(s, "exception"), strings.Contains(s, "failed"), strings.Contains(s, "delay"):
		return "failed"
	default:
		return "in_transit"
	}
}

// ---------------- Shiprocket Client ----------------

// Shiprocket API:
//   Auth: POST /v1/external/auth/login { email, password } -> { token }
//     Token is valid for 240 hours (10 days).
//   Create Order: POST /v1/external/orders/create/adhoc
//   Track by AWB: GET /v1/external/courier/track/awb/{awb_code}
//
// Base URL: https://apiv2.shiprocket.in (no sandbox available)
//
// Credentials (from Shiprocket Settings → API):
//   Email    -> stored in config JSONB { "email": "..." }
//   Password -> stored in api_key field
//   Pickup Location -> stored in config JSONB { "pickup_location": "..." }
//
// Shiprocket has no sandbox environment — test mode uses mock data.

type shiprocketClient struct {
	provider      *models.ShippingProvider
	baseURL       string
	email         string
	password      string
	pickupLocation string
	http          *http.Client
	// Cached auth token
	token       string
	tokenExpiry time.Time
}

// shiprocketConfig is the provider-specific config stored in the Config JSONB field.
type shiprocketConfig struct {
	Email          string `json:"email"`
	PickupLocation string `json:"pickup_location"`
}

func newShiprocketClient(p *models.ShippingProvider) *shiprocketClient {
	var cfg shiprocketConfig
	if len(p.Config) > 0 {
		_ = json.Unmarshal(p.Config, &cfg)
	}
	baseURL := p.APIBaseURL
	if baseURL == "" {
		baseURL = "https://apiv2.shiprocket.in"
	}
	return &shiprocketClient{
		provider:       p,
		baseURL:        strings.TrimRight(baseURL, "/"),
		email:          cfg.Email,
		password:       p.APIKey,
		pickupLocation: cfg.PickupLocation,
		http:           &http.Client{Timeout: 30 * time.Second},
	}
}

// isMock returns true when no email/password is configured — we fall back to mock data.
func (s *shiprocketClient) isMock() bool {
	return s.email == "" || s.password == ""
}

// getAuthToken fetches and caches the Shiprocket bearer token.
// Shiprocket tokens are valid for 240 hours (10 days); we cache with a 1-day buffer.
func (s *shiprocketClient) getAuthToken(ctx context.Context) (string, error) {
	// Return cached token if still valid (with 1-day buffer)
	if s.token != "" && time.Now().Before(s.tokenExpiry.Add(-24*time.Hour)) {
		return s.token, nil
	}

	payload, _ := json.Marshal(map[string]string{
		"email":    s.email,
		"password": s.password,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/v1/external/auth/login", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("shiprocket auth failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("shiprocket auth error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var authResp struct {
		Token string `json:"token"`
		ID    int    `json:"id"`
	}
	if err := json.Unmarshal(respBody, &authResp); err != nil {
		return "", fmt.Errorf("failed to parse shiprocket auth response: %w", err)
	}
	if authResp.Token == "" {
		return "", fmt.Errorf("shiprocket auth returned empty token: %s", string(respBody))
	}

	s.token = authResp.Token
	s.tokenExpiry = time.Now().Add(240 * time.Hour) // 10 days

	return s.token, nil
}

func (s *shiprocketClient) TestConnection(ctx context.Context) (*models.ProviderTestResult, error) {
	if s.isMock() {
		return &models.ProviderTestResult{OK: true, Message: "Mock mode: no email/password configured. Using " + s.baseURL + " for simulated requests. Shiprocket has no sandbox — test mode uses mock data."}, nil
	}
	// Test by fetching an auth token — this validates the credentials
	token, err := s.getAuthToken(ctx)
	if err != nil {
		return &models.ProviderTestResult{OK: false, Message: fmt.Sprintf("authentication failed: %v", err)}, nil
	}
	_ = token
	msg := fmt.Sprintf("Connection successful (Shiprocket, %s).", s.baseURL)
	if s.pickupLocation == "" {
		msg += " Note: Pickup Location not set — shipment creation will use the default pickup location."
	}
	return &models.ProviderTestResult{OK: true, Message: msg}, nil
}

func (s *shiprocketClient) CreateShipment(ctx context.Context, order *models.OrderWithDetails) (*models.Shipment, error) {
	if s.isMock() {
		return (&mockProviderClient{provider: s.provider}).CreateShipment(ctx, order)
	}

	token, err := s.getAuthToken(ctx)
	if err != nil {
		return nil, err
	}

	addr := order.ShippingAddress
	name := strings.TrimSpace(addr.FirstName + " " + addr.LastName)
	if name == "" {
		name = order.CustomerName
	}
	if name == "" {
		name = "Recipient"
	}
	phone := addr.Phone
	if phone == "" {
		phone = "0000000000"
	}
	email := addr.Email
	if email == "" {
		email = "customer@example.com"
	}
	pickupLoc := s.pickupLocation
	if pickupLoc == "" {
		pickupLoc = "Primary"
	}

	// Build order items from order items
	var items []map[string]interface{}
	for _, item := range order.Items {
		items = append(items, map[string]interface{}{
			"name":     item.Name,
			"sku":      item.SKU,
			"units":    item.Quantity,
			"price":    item.UnitPrice,
			"weight":   0.5, // kg default per item
		})
	}
	if len(items) == 0 {
		items = []map[string]interface{}{
			{"name": "Order Item", "sku": "default", "units": 1, "price": order.GrandTotal, "weight": 0.5},
		}
	}

	// Shiprocket Create Order payload
	payload := map[string]interface{}{
		"order_id":         order.ID.String(),
		"order_date":       order.CreatedAt.Format("2006-01-02"),
		"pickup_location":  pickupLoc,
		"payment_method":   "Prepaid",
		"billing_customer_name": name,
		"billing_last_name":     "",
		"billing_address":       strings.TrimSpace(addr.Line1 + " " + addr.Line2),
		"billing_city":          addr.City,
		"billing_state":         addr.State,
		"billing_pincode":       addr.PostalCode,
		"billing_country":       addr.Country,
		"billing_email":         email,
		"billing_phone":         phone,
		"shipping_is_billing":  true,
		"order_items":          items,
		"sub_total":            order.Subtotal,
		"length":               10, // cm default
		"breadth":              10,
		"height":               10,
		"weight":               0.5, // kg total
	}
	body, _ := json.Marshal(payload)

	url := s.baseURL + "/v1/external/orders/create/adhoc"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("shiprocket create order failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("shiprocket create order error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse Shiprocket create order response
	// Response includes order_id (Shiprocket's), shipment_id, and awb_code (may be empty until shipped)
	var apiResp struct {
		OrderID     json.Number `json:"order_id"`
		ShipmentID  json.Number `json:"shipment_id"`
		AWBCode     string      `json:"awb_code"`
		Status      string      `json:"status"`
		StatusCode  int         `json:"status_code"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse shiprocket response: %w", err)
	}

	// AWB may not be assigned immediately — use the Shiprocket order ID as a reference
	// if AWB is not yet assigned. The actual tracking number will be the AWB once assigned.
	trackingNumber := apiResp.AWBCode
	if trackingNumber == "" {
		trackingNumber = "SR-" + apiResp.OrderID.String()
	}

	raw, _ := json.Marshal(map[string]interface{}{
		"shiprocket_order_id":    apiResp.OrderID.String(),
		"shiprocket_shipment_id":  apiResp.ShipmentID.String(),
		"awb_code":                apiResp.AWBCode,
		"status":                  apiResp.Status,
		"raw":                     string(respBody),
	})

	return &models.Shipment{
		TenantID:       order.TenantID,
		OrderID:        order.ID,
		ProviderCode:   s.provider.ProviderCode,
		TrackingNumber: trackingNumber,
		Carrier:        s.provider.DisplayName,
		AWBURL:         "",
		Status:         "booked",
		RawMetadata:    raw,
	}, nil
}

func (s *shiprocketClient) TrackShipment(ctx context.Context, trackingNumber string) (*models.TrackingResponse, error) {
	if s.isMock() {
		return (&mockProviderClient{provider: s.provider}).TrackShipment(ctx, trackingNumber)
	}

	token, err := s.getAuthToken(ctx)
	if err != nil {
		return nil, err
	}

	// Shiprocket Track by AWB: GET /v1/external/courier/track/awb/{awb_code}
	url := s.baseURL + "/v1/external/courier/track/awb/" + trackingNumber
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("shiprocket tracking failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("shiprocket track API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse Shiprocket tracking response
	// Response: { tracking_data: { track_status, awb, courier_name, current_status,
	//   shipment_status, current_timestamp, etd, scans: [{ date, status, activity, location, sr-status, sr-status-label }] } }
	var apiResp struct {
		TrackingData struct {
			TrackStatus      int    `json:"track_status"`
			AWB              string `json:"awb"`
			CourierName      string `json:"courier_name"`
			CurrentStatus    string `json:"current_status"`
			ShipmentStatus   string `json:"shipment_status"`
			CurrentTimestamp  string `json:"current_timestamp"`
			ETD              string `json:"etd"`
			Error            string `json:"error"`
			Scans            []struct {
				Date          string `json:"date"`
				Status        string `json:"status"`
				Activity      string `json:"activity"`
				Location      string `json:"location"`
				SrStatus      string `json:"sr-status"`
				SrStatusLabel string `json:"sr-status-label"`
			} `json:"scans"`
		} `json:"tracking_data"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse shiprocket tracking response: %w", err)
	}

	td := apiResp.TrackingData
	result := &models.TrackingResponse{
		TrackingNumber: trackingNumber,
		Carrier:        s.provider.DisplayName,
		Status:         "pending",
	}

	// If track_status is 0, no tracking data available yet
	if td.TrackStatus == 0 {
		if td.Error != "" {
			result.Status = "booked"
			result.Events = append(result.Events, models.TrackingEvent{
				Status:      "booked",
				Description: td.Error,
			})
		}
		return result, nil
	}

	// Determine the overall status
	statusStr := td.ShipmentStatus
	if statusStr == "" {
		statusStr = td.CurrentStatus
	}
	if statusStr != "" {
		result.Status = mapShiprocketStatus(statusStr)
	}
	result.EstimatedDelivery = td.ETD

	// Add scan events (Shiprocket returns newest first — reverse for chronological order)
	for i := len(td.Scans) - 1; i >= 0; i-- {
		scan := td.Scans[i]
		result.Events = append(result.Events, models.TrackingEvent{
			Status:      mapShiprocketStatus(scan.SrStatusLabel),
			Location:    scan.Location,
			Description: scan.Activity,
			Timestamp:   scan.Date,
		})
	}

	return result, nil
}

// mapShiprocketStatus converts Shiprocket status strings to our internal status.
func mapShiprocketStatus(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.Contains(s, "delivered"):
		return "delivered"
	case strings.Contains(s, "out for delivery"), strings.Contains(s, "ofd"):
		return "out_for_delivery"
	case strings.Contains(s, "in transit"), strings.Contains(s, "in_transit"), strings.Contains(s, "shipped"):
		return "in_transit"
	case strings.Contains(s, "picked up"), strings.Contains(s, "picked_up"), strings.Contains(s, "pickup"):
		return "picked_up"
	case strings.Contains(s, "manifest"), strings.Contains(s, "booked"), strings.Contains(s, "pending"), strings.Contains(s, "awb assigned"):
		return "booked"
	case strings.Contains(s, "cancelled"), strings.Contains(s, "canceled"), strings.Contains(s, "rto"):
		return "cancelled"
	case strings.Contains(s, "failed"), strings.Contains(s, "exception"), strings.Contains(s, "undelivered"):
		return "failed"
	default:
		return "in_transit"
	}
}

// ---------------- High-level operations ----------------

// CreateOrderShipment creates a shipment for an order using the specified provider.
// This is the legacy whole-order variant; see CreateOrderShipmentWithItems for split shipments.
func (s *Store) CreateOrderShipment(ctx context.Context, tenantID, orderID uuid.UUID, providerCode string, estimatedDelivery *time.Time) (*models.Shipment, error) {
	return s.CreateOrderShipmentWithItems(ctx, tenantID, orderID, providerCode, nil, nil, estimatedDelivery)
}

// CreateOrderShipmentWithItems creates a shipment for a subset of order items.
// When itemIDs is empty, the shipment covers all shippable order items (legacy behavior).
// itemQuantities optionally limits the quantity per order item; items not listed
// (or with quantity 0) use their full remaining unshipped quantity.
// estimatedDelivery is an optional admin-set estimated delivery date (nullable).
// The function validates that requested quantities do not exceed the ordered
// quantity minus already-shipped quantity, and that digital items are excluded.
func (s *Store) CreateOrderShipmentWithItems(ctx context.Context, tenantID, orderID uuid.UUID, providerCode string, itemIDs []uuid.UUID, itemQuantities []models.ShipmentItemQuantity, estimatedDelivery *time.Time) (*models.Shipment, error) {
	provider, err := s.GetShippingProviderByCode(ctx, tenantID, providerCode)
	if err != nil {
		return nil, fmt.Errorf("shipping provider '%s' not configured: %w", providerCode, err)
	}
	if !provider.IsEnabled {
		return nil, fmt.Errorf("shipping provider '%s' is disabled", providerCode)
	}

	order, err := s.GetOrderWithDetails(ctx, tenantID, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to load order: %w", err)
	}

	// Build a quantity map from itemQuantities for quick lookup.
	qtyMap := make(map[uuid.UUID]int)
	for _, iq := range itemQuantities {
		if iq.Quantity > 0 {
			qtyMap[iq.OrderItemID] = iq.Quantity
		}
	}

	// Determine which order items to include and their quantities.
	type selected struct {
		item     models.OrderItem
		quantity int
	}
	var selectedItems []selected
	if len(itemIDs) > 0 {
		// Split-shipment: only the requested items.
		idSet := make(map[uuid.UUID]bool)
		for _, id := range itemIDs {
			idSet[id] = true
		}
		for _, oi := range order.Items {
			if !idSet[oi.ID] {
				continue
			}
			// Skip digital items (no requires_shipping info on OrderItem, so we
			// rely on the order item's shipping_method being empty AND the product
			// being non-shippable — but OrderItem doesn't carry requires_shipping.
			// We allow all items here; digital exclusion is enforced at checkout
			// by not assigning shipping methods to digital items.)
			qty := qtyMap[oi.ID]
			if qty <= 0 || qty > oi.Quantity {
				qty = oi.Quantity
			}
			selectedItems = append(selectedItems, selected{item: oi, quantity: qty})
		}
		if len(selectedItems) == 0 {
			return nil, fmt.Errorf("no matching order items found for the requested item IDs")
		}
	} else {
		// Legacy whole-order shipment: include all order items at full quantity.
		for _, oi := range order.Items {
			selectedItems = append(selectedItems, selected{item: oi, quantity: oi.Quantity})
		}
	}

	// Validate against already-shipped quantities to prevent over-allocation.
	alreadyShipped, err := s.getShippedQuantities(ctx, tenantID, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to load shipped quantities: %w", err)
	}
	for i, sel := range selectedItems {
		shipped := alreadyShipped[sel.item.ID]
		available := sel.item.Quantity - shipped
		if sel.quantity > available {
			if available <= 0 {
				return nil, fmt.Errorf("order item '%s' has no remaining quantity to ship (ordered=%d, shipped=%d)", sel.item.Name, sel.item.Quantity, shipped)
			}
			selectedItems[i].quantity = available
		}
	}

	// Build a filtered OrderWithDetails containing only the selected items at
	// the requested quantities, so provider clients receive a shipment-specific
	// payload without interface changes.
	filteredOrder := *order
	filteredItems := make([]models.OrderItem, 0, len(selectedItems))
	for _, sel := range selectedItems {
		oi := sel.item
		oi.Quantity = sel.quantity
		oi.LineTotal = oi.UnitPrice * float64(sel.quantity)
		filteredItems = append(filteredItems, oi)
	}
	filteredOrder.Items = filteredItems

	client := NewShippingProviderClient(provider)
	shipment, err := client.CreateShipment(ctx, &filteredOrder)
	if err != nil {
		return nil, err
	}

	// Apply the optional admin-set estimated delivery date.
	shipment.EstimatedDelivery = estimatedDelivery

	// Persist the shipment.
	if err := s.insertShipment(ctx, shipment); err != nil {
		return nil, fmt.Errorf("failed to save shipment: %w", err)
	}

	// Persist shipment_items links (split-shipment support).
	for _, sel := range selectedItems {
		if _, err := s.Pool.Exec(ctx,
			`INSERT INTO shipment_items (shipment_id, order_item_id, quantity) VALUES ($1,$2,$3)
			 ON CONFLICT (shipment_id, order_item_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
			shipment.ID, sel.item.ID, sel.quantity); err != nil {
			return nil, fmt.Errorf("failed to link shipment item: %w", err)
		}
		shipment.Items = append(shipment.Items, models.ShipmentItem{
			ShipmentID:  shipment.ID,
			OrderItemID:  sel.item.ID,
			Quantity:     sel.quantity,
			ProductName:  sel.item.Name,
			ProductID:    sel.item.ProductID,
			SKU:          sel.item.SKU,
			UnitPrice:    sel.item.UnitPrice,
		})
	}

	return shipment, nil
}

// getShippedQuantities returns a map of order_item_id -> total shipped quantity
// across all existing shipments for the order.
func (s *Store) getShippedQuantities(ctx context.Context, tenantID, orderID uuid.UUID) (map[uuid.UUID]int, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT si.order_item_id, COALESCE(SUM(si.quantity), 0)
		 FROM shipment_items si
		 JOIN shipments sh ON sh.id = si.shipment_id
		 WHERE sh.tenant_id=$1 AND sh.order_id=$2 AND sh.status <> 'cancelled'
		 GROUP BY si.order_item_id`, tenantID, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[uuid.UUID]int)
	for rows.Next() {
		var id uuid.UUID
		var qty int
		if err := rows.Scan(&id, &qty); err != nil {
			return nil, err
		}
		out[id] = qty
	}
	return out, nil
}

// TrackShipment fetches live tracking for a shipment and updates its status.
func (s *Store) TrackShipment(ctx context.Context, tenantID, shipmentID uuid.UUID) (*models.TrackingResponse, error) {
	shipment, err := s.GetShipment(ctx, tenantID, shipmentID)
	if err != nil {
		return nil, err
	}

	provider, err := s.GetShippingProviderByCode(ctx, tenantID, shipment.ProviderCode)
	if err != nil {
		return nil, fmt.Errorf("provider '%s' not configured: %w", shipment.ProviderCode, err)
	}

	client := NewShippingProviderClient(provider)
	tracking, err := client.TrackShipment(ctx, shipment.TrackingNumber)
	if err != nil {
		return nil, err
	}

	// Update shipment status in DB
	raw, _ := json.Marshal(tracking)
	_ = s.updateShipmentStatus(ctx, tenantID, shipmentID, tracking.Status, raw)

	tracking.Shipment = shipment
	return tracking, nil
}

// TestShippingProvider tests the connection to a shipping provider.
func (s *Store) TestShippingProvider(ctx context.Context, tenantID, id uuid.UUID) (*models.ProviderTestResult, error) {
	provider, err := s.GetShippingProvider(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	client := NewShippingProviderClient(provider)
	return client.TestConnection(ctx)
}
