package payment

import (
	"sync"
	"time"
)

// TestTransaction is a logged test payment for debugging during development.
type TestTransaction struct {
	ID            string       `json:"id"`
	Gateway       string       `json:"gateway"`        // "card", "paypal", "razorpay", "cod"
	Amount        float64      `json:"amount"`
	Currency      string       `json:"currency"`
	Scenario      TestScenario `json:"scenario"`        // which test scenario was triggered
	CardNumber    string       `json:"card_number"`     // masked, e.g. "4242****4242"
	CardBrand     string       `json:"card_brand"`
	Success       bool         `json:"success"`
	Status        string       `json:"status"`          // "paid", "failed", "pending"
	TransactionID string       `json:"transaction_id"`  // gateway transaction ID
	Message       string       `json:"message"`
	CustomerName  string       `json:"customer_name"`
	CustomerEmail string       `json:"customer_email"`
	Timestamp     time.Time    `json:"timestamp"`
	DurationMs    int64        `json:"duration_ms"`     // processing time
}

// testStore is an in-memory log of test transactions.
// It's only populated when the system is in test mode.
type testStore struct {
	mu      sync.RWMutex
	records []TestTransaction
	maxSize int
}

var testLog = &testStore{maxSize: 200}

// LogTestTransaction records a test payment for debugging.
func LogTestTransaction(tx TestTransaction) {
	if !IsTestMode() {
		return
	}
	testLog.mu.Lock()
	defer testLog.mu.Unlock()

	if tx.Timestamp.IsZero() {
		tx.Timestamp = time.Now()
	}
	testLog.records = append(testLog.records, tx)
	// Trim to maxSize (keep most recent)
	if len(testLog.records) > testLog.maxSize {
		testLog.records = testLog.records[len(testLog.records)-testLog.maxSize:]
	}
}

// ListTestTransactions returns all logged test transactions (newest first).
func ListTestTransactions() []TestTransaction {
	testLog.mu.RLock()
	defer testLog.mu.RUnlock()

	out := make([]TestTransaction, len(testLog.records))
	copy(out, testLog.records)

	// Reverse to newest-first
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

// ClearTestTransactions removes all logged test transactions.
func ClearTestTransactions() {
	testLog.mu.Lock()
	defer testLog.mu.Unlock()
	testLog.records = nil
}

// MaskCardNumber masks the middle digits of a card number, keeping first 4 and last 4.
func MaskCardNumber(digits string) string {
	if len(digits) <= 8 {
		return digits
	}
	return digits[:4] + "****" + digits[len(digits)-4:]
}
