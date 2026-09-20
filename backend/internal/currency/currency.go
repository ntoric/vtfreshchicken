package currency

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
	mu   sync.RWMutex
	cache map[string]float64 // "USD->EUR" -> rate
	ttl  time.Duration
	lastLoad time.Time
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, cache: map[string]float64{}, ttl: 5 * time.Minute}
}

func (s *Service) load(ctx context.Context) error {
	rows, err := s.pool.Query(ctx, `SELECT base_code, quote_code, rate FROM exchange_rates`)
	if err != nil {
		return err
	}
	defer rows.Close()
	m := map[string]float64{}
	for rows.Next() {
		var base, quote string
		var rate float64
		if err := rows.Scan(&base, &quote, &rate); err != nil {
			return err
		}
		m[base+"->"+quote] = rate
	}
	s.mu.Lock()
	s.cache = m
	s.lastLoad = time.Now()
	s.mu.Unlock()
	return nil
}

func (s *Service) ensureLoaded(ctx context.Context) error {
	s.mu.RLock()
	stale := time.Since(s.lastLoad) > s.ttl
	s.mu.RUnlock()
	if !stale && len(s.cache) > 0 {
		return nil
	}
	return s.load(ctx)
}

// Convert converts an amount from base currency to target currency.
func (s *Service) Convert(ctx context.Context, amount float64, baseCode, targetCode string) (float64, error) {
	if strings.EqualFold(baseCode, targetCode) {
		return amount, nil
	}
	if err := s.ensureLoaded(ctx); err != nil {
		return 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	key := strings.ToUpper(baseCode) + "->" + strings.ToUpper(targetCode)
	rate, ok := s.cache[key]
	if !ok {
		return 0, fmt.Errorf("no exchange rate %s->%s", baseCode, targetCode)
	}
	return amount * rate, nil
}

// FormatWithSymbol returns a formatted price string with the currency symbol.
func FormatWithSymbol(amount float64, symbol string, decimals int) string {
	return fmt.Sprintf("%s%.*f", symbol, decimals, amount)
}
