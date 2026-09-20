package email

import (
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// SMTPConfig holds the connection details for an SMTP server.
type SMTPConfig struct {
	Host       string
	Port       int
	Username   string
	Password   string
	FromEmail  string
	FromName   string
	Encryption string // "none", "ssl", "starttls"
}

// Email represents an outgoing email message.
type Email struct {
	To      []string
	Subject string
	Body    string // HTML body
}

// SendEmail sends an email using the provided SMTP configuration.
func SendEmail(cfg SMTPConfig, msg Email) error {
	if cfg.Host == "" {
		return errors.New("SMTP host is not configured")
	}
	if len(msg.To) == 0 {
		return errors.New("no recipients specified")
	}
	if cfg.FromEmail == "" {
		return errors.New("from email is not configured")
	}
	fromName := cfg.FromName
	if fromName == "" {
		fromName = "Store"
	}

	rawMsg := buildMessage(cfg.FromEmail, fromName, msg.To, msg.Subject, msg.Body)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	var auth smtp.Auth
	if cfg.Username != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}

	enc := strings.ToLower(cfg.Encryption)
	if enc == "" {
		enc = "starttls"
	}

	if enc == "ssl" {
		return sendSSL(addr, cfg.Host, auth, cfg.FromEmail, msg.To, rawMsg)
	}
	// "none" and "starttls" both use smtp.SendMail (it auto-upgrades to STARTTLS if available)
	return smtp.SendMail(addr, auth, cfg.FromEmail, msg.To, rawMsg)
}

// sendSSL sends via implicit TLS (typically port 465).
func sendSSL(addr, host string, auth smtp.Auth, from string, to []string, msg []byte) error {
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 15 * time.Second}, "tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return fmt.Errorf("dial SMTPS: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("create SMTP client: %w", err)
	}
	defer c.Close()

	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("auth: %w", err)
		}
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	for _, r := range to {
		if err := c.Rcpt(r); err != nil {
			return fmt.Errorf("rcpt %s: %w", r, err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("write body: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("close body: %w", err)
	}
	return c.Quit()
}

func buildMessage(from, fromName string, to []string, subject, body string) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s <%s>\r\n", fromName, from)
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(to, ", "))
	fmt.Fprintf(&b, "Subject: %s\r\n", subject)
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("\r\n")
	b.WriteString(body)
	return []byte(b.String())
}
