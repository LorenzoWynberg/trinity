module github.com/trinity-ai-labs/trinity/cli

go 1.23

require (
	github.com/spf13/cobra v1.10.2
	github.com/trinity-ai-labs/trinity/core v0.0.0
)

require (
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/spf13/pflag v1.0.9 // indirect
)

replace github.com/trinity-ai-labs/trinity/core => ../core
