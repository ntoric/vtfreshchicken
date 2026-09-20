package payment

import (
	"context"
	"os"
	"time"
)

// Thin wrappers around stdlib functions so testcards.go stays focused on
// test card definitions and scenario logic without import noise.

type Duration = time.Duration

const (
	Millisecond = time.Millisecond
)

func after(d Duration) <-chan time.Time       { return time.After(d) }
func ctxDone(ctx context.Context) <-chan struct{} { return ctx.Done() }
func ctxErr(ctx context.Context) error       { return ctx.Err() }
func osGetenv(key string) string             { return os.Getenv(key) }
func nowNano() int64                         { return time.Now().UnixNano() }
