// Command mcp-server runs the TruCommerce MCP server exposing all platform
// functionalities to AI clients via the Model Context Protocol.
//
// The server supports two transports:
//   - stdio (default): for local AI client integration (e.g. Claude Desktop)
//   - sse: for remote/networked AI clients (HTTP+SSE)
//
// Authentication: the server authenticates against the running backend API
// using configured credentials (env vars) or per-call via the platform_login
// and tenant_login tools.
//
// Usage:
//   mcp-server                          # stdio transport (default)
//   mcp-server --transport sse --addr :9100   # SSE transport on port 9100
//
// Environment variables:
//   MCP_API_BASE_URL  - backend API URL (default: http://localhost:18080)
//   MCP_DEFAULT_TENANT - default tenant slug for tenant-scoped calls (default: demo)
//   MCP_AUTH_EMAIL    - optional: auto-login email at startup
//   MCP_AUTH_PASSWORD - optional: auto-login password at startup
//   MCP_AUTH_TENANT   - optional: tenant slug for auto-login (empty = superadmin)
//   MCP_TRANSPORT     - transport: "stdio" or "sse" (default: stdio)
//   MCP_ADDR          - listen address for SSE transport (default: :9100)
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/mark3labs/mcp-go/server"

	trumcp "github.com/trucommerce/backend/internal/mcp"
)

func main() {
	transport := flag.String("transport", envOrDefault("MCP_TRANSPORT", "stdio"), `Transport: "stdio" or "sse"`)
	addr := flag.String("addr", envOrDefault("MCP_ADDR", ":9100"), "Listen address for SSE transport")
	flag.Parse()

	// Configure logging to stderr so stdio transport output is clean JSON-RPC.
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo})))

	baseURL := envOrDefault("MCP_API_BASE_URL", "http://localhost:18080")
	defaultTenant := envOrDefault("MCP_DEFAULT_TENANT", "demo")

	client := trumcp.NewClient(baseURL, defaultTenant)
	slog.Info("MCP server starting", "api_url", baseURL, "default_tenant", defaultTenant, "transport", *transport)

	// Optional auto-login
	if email := os.Getenv("MCP_AUTH_EMAIL"); email != "" {
		password := os.Getenv("MCP_AUTH_PASSWORD")
		tenant := os.Getenv("MCP_AUTH_TENANT")
		ctx := context.Background()
		var err error
		if tenant != "" {
			err = client.TenantLogin(ctx, tenant, email, password)
			client.Tenant = tenant
		} else {
			err = client.Login(ctx, email, password)
		}
		if err != nil {
			slog.Warn("auto-login failed", "err", err)
		} else {
			slog.Info("auto-login succeeded", "tenant", tenant)
		}
	}

	mcpServer := trumcp.NewMCPServer(client)

	switch *transport {
	case "stdio":
		if err := server.ServeStdio(mcpServer); err != nil {
			slog.Error("stdio server failed", "err", err)
			os.Exit(1)
		}
	case "sse":
		sseServer := server.NewSSEServer(mcpServer, server.WithBaseURL(fmt.Sprintf("http://localhost%s", *addr)))
		slog.Info("SSE server starting", "addr", *addr, "sse_endpoint", "/sse", "message_endpoint", "/message")

		// Handle shutdown gracefully
		go func() {
			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
			<-sigCh
			slog.Info("shutting down...")
			os.Exit(0)
		}()

		if err := sseServer.Start(*addr); err != nil {
			slog.Error("SSE server failed", "err", err)
			os.Exit(1)
		}
	default:
		slog.Error("invalid transport", "transport", *transport)
		os.Exit(1)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
