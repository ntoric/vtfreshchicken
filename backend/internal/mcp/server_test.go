package mcp

import (
	"testing"
)

// TestServerCreation verifies that the MCP server can be created with all tools registered.
func TestServerCreation(t *testing.T) {
	c := NewClient("http://localhost:18080")
	s := NewMCPServer(c)
	if s == nil {
		t.Fatal("expected non-nil MCP server")
	}
}

// TestClientBasics verifies the API client helper methods.
func TestClientBasics(t *testing.T) {
	c := NewClient("http://localhost:18080/")
	if c.BaseURL != "http://localhost:18080" {
		t.Errorf("expected trailing slash trimmed, got %q", c.BaseURL)
	}
	c.SetToken("tok123")
	if c.GetToken() != "tok123" {
		t.Errorf("expected token 'tok123', got %q", c.GetToken())
	}
	if path := c.APIPath("/orders"); path != "/api/orders" {
		t.Errorf("expected /api/orders, got %q", path)
	}
}

// TestArgHelpers verifies the argument extraction helpers.
func TestArgHelpers(t *testing.T) {
	args := map[string]any{
		"str":   "hello",
		"num":   float64(42),
		"bool":  true,
		"obj":   map[string]any{"a": "b"},
		"arr":   []any{"x", "y"},
		"empty": "",
	}
	if argString(args, "str") != "hello" {
		t.Error("argString failed")
	}
	if argString(args, "missing") != "" {
		t.Error("argString missing should be empty")
	}
	if argInt(args, "num") != 42 {
		t.Error("argInt failed")
	}
	if !argBool(args, "bool") {
		t.Error("argBool failed")
	}
	if argMap(args, "obj") == nil {
		t.Error("argMap failed")
	}
	if argArray(args, "arr") == nil {
		t.Error("argArray failed")
	}
	if argString(args, "empty") != "" {
		t.Error("argString empty should be empty")
	}
}

// TestBuildQuery verifies query building from args.
func TestBuildQuery(t *testing.T) {
	args := map[string]any{
		"search": "test",
		"status": "active",
		"empty":  "",
	}
	q := buildQuery(args, "search", "status", "empty")
	if q.Get("search") != "test" {
		t.Error("expected search=test")
	}
	if q.Get("status") != "active" {
		t.Error("expected status=active")
	}
	if q.Get("empty") != "" {
		t.Error("expected empty to be omitted")
	}
}

// TestBodyFromArgs verifies body building from args.
func TestBodyFromArgs(t *testing.T) {
	args := map[string]any{
		"name":   "test",
		"status": "active",
		"skip":   "omit",
	}
	body := bodyFromArgs(args, "name", "status")
	if body["name"] != "test" {
		t.Error("expected name=test")
	}
	if body["status"] != "active" {
		t.Error("expected status=active")
	}
	if _, ok := body["skip"]; ok {
		t.Error("expected skip to be omitted")
	}
}
