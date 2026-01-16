#!/bin/bash

# Configuration
APP_NAME="KubeLensy.app"
RELEASE_DIR="release/mac-arm64"
INSTALL_PATH="/Applications/$APP_NAME"
CACHE_FILE=".release-last-build"
FAST_MODE=${FAST_MODE:-false}
CURRENT_REV=$(git rev-parse HEAD 2>/dev/null || date +%s)
SKIP_BUILD=false

echo "🚀 Starting KubeLensy Build & Release process..."

# 1. Build project
echo "📦 Building application (frontend, backend, and electron)..."

if [ "$FAST_MODE" = "true" ] && [ -f "$CACHE_FILE" ] && [ -d "$RELEASE_DIR/$APP_NAME" ]; then
    LAST_REV=$(cat "$CACHE_FILE")
    if [ "$LAST_REV" = "$CURRENT_REV" ]; then
        echo "⚡ Fast mode: skipping rebuild (no changes detected since $LAST_REV)."
        SKIP_BUILD=true
    fi
fi

if [ "$SKIP_BUILD" = "false" ]; then
    npm run electron:build
else
    echo "♻️ Reusing existing build artifacts from $RELEASE_DIR"
fi

# 2. Check if build was successful
if [ ! -d "$RELEASE_DIR/$APP_NAME" ]; then
    echo "❌ Error: Build failed. Application not found in $RELEASE_DIR"
    exit 1
fi

# 3. Clean existing installation
if [ -d "$INSTALL_PATH" ]; then
    echo "🗑️ Removing old version from Applications..."
    rm -rf "$INSTALL_PATH"
fi

# 4. Install to Applications
echo "🚚 Copying $APP_NAME to Applications..."
cp -R "$RELEASE_DIR/$APP_NAME" /Applications/

# 5. Clear quarantine (fix "unidentified developer" issues)
echo "🛡️  Clearing Mac security quarantine..."
xattr -cr "$INSTALL_PATH"

echo "$CURRENT_REV" > "$CACHE_FILE"

echo "✅ Success! KubeLensy is now installed in your Applications folder."
echo "👉 You can open it with: open -a KubeLensy"
