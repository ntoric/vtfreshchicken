package services

import (
	"fmt"
	"testing"
)

func TestDateRangeClauseBothBounds(t *testing.T) {
	dr := DateRangeFilter{From: "2024-01-01", To: "2024-12-31"}
	clause, args, idx := dateRangeClause("created_at", dr, nil, 1)
	want := " AND created_at >= $1 AND created_at <= $2"
	if clause != want {
		t.Fatalf("clause = %q, want %q", clause, want)
	}
	if len(args) != 2 || args[0] != "2024-01-01" || args[1] != "2024-12-31" {
		t.Fatalf("args = %v", args)
	}
	if idx != 3 {
		t.Fatalf("idx = %d, want 3", idx)
	}
}

func TestDateRangeClauseFromOnly(t *testing.T) {
	dr := DateRangeFilter{From: "2024-01-01"}
	clause, args, idx := dateRangeClause("o.created_at", dr, nil, 5)
	want := " AND o.created_at >= $5"
	if clause != want {
		t.Fatalf("clause = %q, want %q", clause, want)
	}
	if len(args) != 1 || args[0] != "2024-01-01" {
		t.Fatalf("args = %v", args)
	}
	if idx != 6 {
		t.Fatalf("idx = %d, want 6", idx)
	}
}

func TestDateRangeClauseToOnly(t *testing.T) {
	dr := DateRangeFilter{To: "2024-12-31"}
	clause, args, idx := dateRangeClause("t.created_at", dr, nil, 1)
	want := " AND t.created_at <= $1"
	if clause != want {
		t.Fatalf("clause = %q, want %q", clause, want)
	}
	if len(args) != 1 || args[0] != "2024-12-31" {
		t.Fatalf("args = %v", args)
	}
	if idx != 2 {
		t.Fatalf("idx = %d, want 2", idx)
	}
}

func TestDateRangeClauseEmpty(t *testing.T) {
	dr := DateRangeFilter{}
	clause, args, idx := dateRangeClause("created_at", dr, nil, 1)
	if clause != "" {
		t.Fatalf("clause = %q, want empty", clause)
	}
	if len(args) != 0 {
		t.Fatalf("args = %v, want empty", args)
	}
	if idx != 1 {
		t.Fatalf("idx = %d, want 1", idx)
	}
}

func TestDateRangeClauseAppendsToArgs(t *testing.T) {
	dr := DateRangeFilter{From: "2024-01-01", To: "2024-12-31"}
	existing := []interface{}{"tenant-id"}
	clause, args, idx := dateRangeClause("created_at", dr, existing, 2)
	if len(args) != 3 {
		t.Fatalf("args = %v, want 3 elements", args)
	}
	if args[0] != "tenant-id" {
		t.Fatalf("first arg should be preserved, got %v", args[0])
	}
	if args[1] != "2024-01-01" || args[2] != "2024-12-31" {
		t.Fatalf("date args = %v", args)
	}
	if idx != 4 {
		t.Fatalf("idx = %d, want 4", idx)
	}
	// Verify the placeholder indices in the clause are correct
	want := " AND created_at >= $2 AND created_at <= $3"
	if clause != want {
		t.Fatalf("clause = %q, want %q", clause, want)
	}
}

func TestDateRangeFilterZeroValue(t *testing.T) {
	var dr DateRangeFilter
	if dr.From != "" || dr.To != "" {
		t.Fatalf("zero value should have empty strings, got %+v", dr)
	}
}

func TestDateRangeClausePlaceholderIndexing(t *testing.T) {
	// Verify that consecutive calls produce correct placeholder indices.
	dr1 := DateRangeFilter{From: "a"}
	dr2 := DateRangeFilter{From: "b", To: "c"}
	args := []interface{}{}
	idx := 1
	_, args, idx = dateRangeClause("col1", dr1, args, idx)
	_, args, idx = dateRangeClause("col2", dr2, args, idx)
	if len(args) != 3 {
		t.Fatalf("args = %v", args)
	}
	if idx != 4 {
		t.Fatalf("idx = %d, want 4", idx)
	}
	// Verify the values are in order
	if fmt.Sprintf("%v", args) != "[a b c]" {
		t.Fatalf("args order = %v", args)
	}
}
