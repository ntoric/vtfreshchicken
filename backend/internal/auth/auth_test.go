package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
)

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("hunter2")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if hash == "hunter2" {
		t.Fatal("hash should not equal plaintext")
	}
	if err := VerifyPassword(hash, "hunter2"); err != nil {
		t.Fatalf("VerifyPassword correct: %v", err)
	}
	if err := VerifyPassword(hash, "wrong"); err == nil {
		t.Fatal("VerifyPassword wrong should fail")
	}
}

func TestHashPasswordUnique(t *testing.T) {
	a, _ := HashPassword("same")
	b, _ := HashPassword("same")
	if a == b {
		t.Fatal("bcrypt hashes should differ due to salt")
	}
}

func TestIssueAndParseAccessToken(t *testing.T) {
	secret := []byte("test-secret-key-at-least-32-bytes-long!!")
	svc := NewService(secret, time.Minute, time.Hour, nil)
	uid := uuid.New()
	tid := uuid.New()
	user := &models.User{ID: uid, TenantID: &tid, Email: "u@example.com", Role: models.RoleCustomer}

	tok, err := svc.IssueAccessToken(user)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	if tok == "" {
		t.Fatal("token empty")
	}

	claims, err := svc.ParseAccessToken(tok)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if claims.UserID != uid {
		t.Fatalf("uid = %v, want %v", claims.UserID, uid)
	}
	if claims.Email != "u@example.com" {
		t.Fatalf("email = %q", claims.Email)
	}
	if claims.Role != models.RoleCustomer {
		t.Fatalf("role = %q", claims.Role)
	}
	if claims.TenantID == nil || *claims.TenantID != tid {
		t.Fatalf("tid mismatch")
	}
}

func TestParseAccessTokenInvalid(t *testing.T) {
	svc := NewService([]byte("test-secret-key-at-least-32-bytes-long!!"), time.Minute, time.Hour, nil)
	if _, err := svc.ParseAccessToken("not-a-jwt"); err == nil {
		t.Fatal("expected error parsing garbage")
	}
}

func TestParseAccessTokenWrongSecret(t *testing.T) {
	svc1 := NewService([]byte("secret-one-at-least-32-bytes-long!!!!!"), time.Minute, time.Hour, nil)
	svc2 := NewService([]byte("secret-two-at-least-32-bytes-long!!!!!"), time.Minute, time.Hour, nil)
	uid := uuid.New()
	user := &models.User{ID: uid, Email: "u@example.com", Role: models.RoleCustomer}
	tok, _ := svc1.IssueAccessToken(user)
	if _, err := svc2.ParseAccessToken(tok); err == nil {
		t.Fatal("expected error when validating with wrong secret")
	}
}

func TestParseAccessTokenExpired(t *testing.T) {
	svc := NewService([]byte("test-secret-key-at-least-32-bytes-long!!"), -time.Minute, time.Hour, nil)
	uid := uuid.New()
	user := &models.User{ID: uid, Email: "u@example.com", Role: models.RoleCustomer}
	tok, _ := svc.IssueAccessToken(user)
	if _, err := svc.ParseAccessToken(tok); err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestRefreshKey(t *testing.T) {
	uid := uuid.New()
	k := refreshKey(uid, "abc")
	if k != "refresh:"+uid.String()+":abc" {
		t.Fatalf("unexpected key: %q", k)
	}
}
