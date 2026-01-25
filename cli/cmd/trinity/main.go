// Package main provides the Trinity CLI entrypoint.
package main

import (
	"fmt"

	"github.com/trinity-ai-labs/trinity/core"
)

func main() {
	fmt.Printf("Trinity %s\n", core.Version)
}
