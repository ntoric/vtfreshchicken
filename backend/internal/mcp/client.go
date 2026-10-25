package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Client is an HTTP client for the TruCommerce backend API.
// It handles JWT authentication for the single store.
type Client struct {
	BaseURL    string // e.g. "http://localhost:18080"
	Token      string // JWT access token
	HTTPClient *http.Client
	mu         sync.RWMutex
}

// NewClient creates a new API client.
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetToken sets the JWT token (thread-safe).
func (c *Client) SetToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Token = token
}

// GetToken returns the current JWT token (thread-safe).
func (c *Client) GetToken() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Token
}

// Login authenticates with the platform and stores the token.
// Use this for superadmin login.
func (c *Client) Login(ctx context.Context, email, password string) error {
	body := map[string]string{"email": email, "password": password}
	var resp struct {
		AccessToken string `json:"access_token"`
	}
	if err := c.do(ctx, "POST", "/api/platform/auth/login", body, nil, &resp); err != nil {
		return err
	}
	c.SetToken(resp.AccessToken)
	return nil
}

// StoreLogin authenticates a store user (business_admin, staff, or customer)
// and stores the token.
func (c *Client) StoreLogin(ctx context.Context, email, password string) error {
	body := map[string]string{"email": email, "password": password}
	var resp struct {
		AccessToken string `json:"access_token"`
	}
	if err := c.do(ctx, "POST", "/api/auth/login", body, nil, &resp); err != nil {
		return err
	}
	c.SetToken(resp.AccessToken)
	return nil
}

// do performs an HTTP request to the backend API.
// If out is non-nil, the response body is JSON-decoded into it.
// If query is non-nil, the query params are appended to the URL.
// If body is non-nil, it's JSON-encoded and sent as the request body.
func (c *Client) do(ctx context.Context, method, path string, body interface{}, query url.Values, out interface{}) error {
	fullURL := c.BaseURL + path
	if query != nil && len(query) > 0 {
		fullURL += "?" + query.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if tok := c.GetToken(); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(respBody, &errResp)
		if errResp.Error != "" {
			return fmt.Errorf("API error (%d): %s", resp.StatusCode, errResp.Error)
		}
		return fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

// Get performs a GET request.
func (c *Client) Get(ctx context.Context, path string, query url.Values, out interface{}) error {
	return c.do(ctx, "GET", path, nil, query, out)
}

// Post performs a POST request.
func (c *Client) Post(ctx context.Context, path string, body interface{}, out interface{}) error {
	return c.do(ctx, "POST", path, body, nil, out)
}

// Put performs a PUT request.
func (c *Client) Put(ctx context.Context, path string, body interface{}, out interface{}) error {
	return c.do(ctx, "PUT", path, body, nil, out)
}

// Delete performs a DELETE request.
func (c *Client) Delete(ctx context.Context, path string, out interface{}) error {
	return c.do(ctx, "DELETE", path, nil, nil, out)
}

// APIPath returns a store-scoped API path.
func (c *Client) APIPath(path string) string {
	return "/api" + path
}
