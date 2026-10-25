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
//   MCP_AUTH_EMAIL    - optional: auto-login email at startup
//   MCP_AUTH_PASSWORD - optional: auto-login password at startup
//   MCP_AUTH_PLATFORM - optional: "true" to auto-login as platform superadmin
//                       (default: store user login)
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

	client := trumcp.NewClient(baseURL)
	slog.Info("MCP server starting", "api_url", baseURL, "transport", *transport)

	// Optional auto-login
	if email := os.Getenv("MCP_AUTH_EMAIL"); email != "" {
		password := os.Getenv("MCP_AUTH_PASSWORD")
		ctx := context.Background()
		var err error
		if os.Getenv("MCP_AUTH_PLATFORM") == "true" {
			err = client.Login(ctx, email, password)
		} else {
			err = client.StoreLogin(ctx, email, password)
		}
		if err != nil {
			slog.Warn("auto-login failed", "err", err)
		} else {
			slog.Info("auto-login succeeded")
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
