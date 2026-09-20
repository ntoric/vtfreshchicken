package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/mark3labs/mcp-go/mcp"
)

// argString extracts a string argument from the tool request.
func argString(args map[string]any, key string) string {
	if v, ok := args[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// argInt extracts an int argument from the tool request.
func argInt(args map[string]any, key string) int {
	if v, ok := args[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		case int64:
			return int(n)
		}
	}
	return 0
}

// argBool extracts a bool argument from the tool request.
func argBool(args map[string]any, key string) bool {
	if v, ok := args[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

// argMap extracts a map[string]any argument from the tool request.
func argMap(args map[string]any, key string) map[string]any {
	if v, ok := args[key]; ok {
		if m, ok := v.(map[string]any); ok {
			return m
		}
	}
	return nil
}

// argArray extracts a []any argument from the tool request.
func argArray(args map[string]any, key string) []any {
	if v, ok := args[key]; ok {
		if a, ok := v.([]any); ok {
			return a
		}
	}
	return nil
}

// textResult creates a text content result from any value (JSON-encoded if not a string).
func textResult(v interface{}, err error) (*mcp.CallToolResult, error) {
	if err != nil {
		return errorResult(err), nil
	}
	var text string
	if s, ok := v.(string); ok {
		text = s
	} else {
		b, _ := json.MarshalIndent(v, "", "  ")
		text = string(b)
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{Type: "text", Text: text},
		},
	}, nil
}

// errorResult creates an error text content result.
func errorResult(err error) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{
			mcp.TextContent{Type: "text", Text: fmt.Sprintf("Error: %v", err)},
		},
	}
}

// buildQuery builds a url.Values from a map of string arguments.
func buildQuery(args map[string]any, keys ...string) url.Values {
	q := url.Values{}
	for _, k := range keys {
		if v := argString(args, k); v != "" {
			q.Set(k, v)
		}
	}
	return q
}

// buildQueryFromArgs builds a url.Values from all non-empty string args.
func buildQueryFromArgs(args map[string]any) url.Values {
	q := url.Values{}
	for k, v := range args {
		switch val := v.(type) {
		case string:
			if val != "" {
				q.Set(k, val)
			}
		case float64:
			if val != 0 {
				q.Set(k, fmt.Sprintf("%v", val))
			}
		case int:
			if val != 0 {
				q.Set(k, fmt.Sprintf("%d", val))
			}
		case bool:
			q.Set(k, fmt.Sprintf("%t", val))
		}
	}
	return q
}

// callGet performs a GET request and returns a text result.
func callGet(ctx context.Context, c *Client, path string, query url.Values) (*mcp.CallToolResult, error) {
	var out interface{}
	return textResult(out, c.Get(ctx, path, query, &out))
}

// callPost performs a POST request and returns a text result.
func callPost(ctx context.Context, c *Client, path string, body interface{}) (*mcp.CallToolResult, error) {
	var out interface{}
	return textResult(out, c.Post(ctx, path, body, &out))
}

// callPut performs a PUT request and returns a text result.
func callPut(ctx context.Context, c *Client, path string, body interface{}) (*mcp.CallToolResult, error) {
	var out interface{}
	return textResult(out, c.Put(ctx, path, body, &out))
}

// callDelete performs a DELETE request and returns a text result.
func callDelete(ctx context.Context, c *Client, path string) (*mcp.CallToolResult, error) {
	var out interface{}
	return textResult(out, c.Delete(ctx, path, &out))
}

// bodyFromArgs builds a request body map from selected args.
func bodyFromArgs(args map[string]any, keys ...string) map[string]any {
	body := map[string]any{}
	for _, k := range keys {
		if v, ok := args[k]; ok {
			body[k] = v
		}
	}
	return body
}
