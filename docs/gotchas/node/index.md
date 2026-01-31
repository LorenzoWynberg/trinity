# Node.js Gotchas

Common pitfalls with Node.js native modules.

## node-pty Build Issues

If you get `posix_spawnp failed` error, rebuild from source:
```bash
rm -rf node_modules/node-pty && npm install node-pty --build-from-source
```

The prebuilt binary may be compiled for a different Node ABI version. Building from source compiles it for your exact Node version. Works on Node 20 and 22.

---
<!-- updatedAt: 2026-01-27 -->
<!-- lastCompactedAt: 2026-01-27 -->
