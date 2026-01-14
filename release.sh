#!/bin/bash

# Configuration
APP_NAME="KubeLensy.app"
RELEASE_DIR="release/mac-arm64"
INSTALL_PATH="/Applications/$APP_NAME"

echo "🚀 Starting KubeLensy Build & Release process..."

# 1. Build project
echo "📦 Building application (frontend, backend, and electron)..."
npm run electron:build

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

echo "✅ Success! KubeLensy is now installed in your Applications folder."
echo "👉 You can open it with: open -a KubeLensy"
