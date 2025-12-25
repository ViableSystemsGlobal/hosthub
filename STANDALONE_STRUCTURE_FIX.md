# Standalone Build Structure Fix

## The Problem

The error shows Next.js is looking for files at:
```
/app/.next/standalone/.next/server/middleware-manifest.json
```

This suggests the standalone build structure isn't being copied correctly.

## How Next.js Standalone Works

When you build with `output: 'standalone'`, Next.js creates:
```
.next/standalone/
  server.js
  .next/
    server/
      middleware-manifest.json
      ...
    static/ (might be empty)
  node_modules/ (minimal, only what's needed)
```

## The Fix

The Dockerfile should:
1. Copy `.next/standalone` to `/app` (this gives us `/app/server.js` and `/app/.next/`)
2. Copy `.next/static` to `/app/.next/static` (merge static files)
3. **Don't** copy `.next/server` separately - it's already in standalone!

## Updated Dockerfile Structure

```dockerfile
# Copy standalone build (contains server.js and .next/server)
COPY --from=builder /app/.next/standalone ./

# Copy static files (standalone doesn't include these)
COPY --from=builder /app/.next/static ./.next/static
```

## Verification

After building, the structure should be:
```
/app/
  server.js
  .next/
    server/
      middleware-manifest.json ✓
    static/
      chunks/ ✓
      media/ ✓
  public/
  node_modules/
    .prisma/
    @prisma/
```

## If Still Not Working

The issue might be that EasyPanel/Nixpacks is using a different build process. Check:
1. Which Dockerfile is being used (`.nixpacks/Dockerfile` or root `Dockerfile`)
2. If Nixpacks is overriding the build, you might need to disable it and use Dockerfile directly

