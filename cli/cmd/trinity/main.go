// Package main is the entrypoint for the Trinity CLI.
package main

import (
	"fmt"

	"github.com/trinity-ai-labs/trinity/core"
)

func main() {
	fmt.Printf("Trinity CLI - Core version: %s\n", core.Version)
}
