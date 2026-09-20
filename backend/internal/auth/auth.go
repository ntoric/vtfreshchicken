package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/trucommerce/backend/internal/models"
)

type Service struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
	rdb        *goredis.Client
}

func NewService(secret []byte, accessTTL, refreshTTL time.Duration, rdb *goredis.Client) *Service {
	return &Service{secret: secret, accessTTL: accessTTL, refreshTTL: refreshTTL, rdb: rdb}
}

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func VerifyPassword(hash, pw string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw))
}

type Claims struct {
	UserID   uuid.UUID       `json:"uid"`
	TenantID *uuid.UUID      `json:"tid,omitempty"`
	Email    string          `json:"email"`
	Role     models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

func (s *Service) IssueAccessToken(u *models.User) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   u.ID,
		TenantID: u.TenantID,
		Email:    u.Email,
		Role:     u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
			Subject:   u.ID.String(),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(s.secret)
}

func (s *Service) IssueRefreshToken(u *models.User) (string, error) {
	raw := uuid.NewString()
	key := refreshKey(u.ID, raw)
	if err := s.rdb.Set(context.Background(), key, "1", s.refreshTTL).Err(); err != nil {
		return "", err
	}
	return raw, nil
}

func (s *Service) ValidateRefreshToken(userID uuid.UUID, token string) error {
	key := refreshKey(userID, token)
	n, err := s.rdb.Exists(context.Background(), key).Result()
	if err != nil {
		return err
	}
	if n == 0 {
		return errors.New("invalid or expired refresh token")
	}
	return nil
}

func (s *Service) RevokeRefreshToken(userID uuid.UUID, token string) error {
	return s.rdb.Del(context.Background(), refreshKey(userID, token)).Err()
}

func (s *Service) ParseAccessToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !tok.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func refreshKey(userID uuid.UUID, token string) string {
	return fmt.Sprintf("refresh:%s:%s", userID.String(), token)
}
