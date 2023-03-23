package collections_test

import (
	"testing"

	stack "github.com/ever0de/cov_reporter-go/coverage-project"
	"github.com/stretchr/testify/assert"
)

func TestStack(t *testing.T) {
	stack := stack.NewStack()
	stack.Push(1)
	stack.Push(2)
	stack.Push(3)

	if stack.Pop() != 3 {
		t.Error("Expected 3")
	}
	if stack.Pop() != 2 {
		t.Error("Expected 2")
	}
	if stack.Pop() != 1 {
		t.Error("Expected 1")
	}

	assert.True(t, stack.IsEmpty())
}
