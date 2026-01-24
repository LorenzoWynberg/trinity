// Package main is the entrypoint for the Trinity CLI.
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/trinity-ai-labs/trinity/core"
)

var rootCmd = &cobra.Command{
	Use:   "trinity",
	Short: "Autonomous AI development loops",
	Long: `Trinity is a CLI tool for running autonomous AI development loops.
It points at a project, reads stories from a PRD, and uses Claude Code
to implement them autonomously while the developer is AFK.

Get started:
  trinity init              Initialize Trinity for your project
  trinity analyze           Analyze your codebase
  trinity plan add          Create or extend your PRD
  trinity run               Execute the development loop

For more information, visit: https://github.com/trinity-ai-labs/trinity`,
	Version: core.Version,
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
