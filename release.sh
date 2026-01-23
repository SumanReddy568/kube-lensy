#!/bin/bash

# Configuration
APP_NAME="KubeLensy.app"
RELEASE_DIR="release/mac-arm64"
INSTALL_PATH="/Applications/$APP_NAME"
CACHE_FILE=".release-last-build"
FAST_MODE=${FAST_MODE:-false}

# Use short hash for cleaner tags and UI
FULL_REV=$(git rev-parse HEAD 2>/dev/null || date +%s)
SHORT_REV=$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
CURRENT_TAG="v$SHORT_REV"

# Extract repo name from git remote to avoid account mismatch issues
REPO_NAME=$(git remote get-url origin 2>/dev/null | sed -E 's/.*github.com[:\/](.*)\.git/\1/')
GH_REPO_ARG=""
if [ ! -z "$REPO_NAME" ]; then
    GH_REPO_ARG="--repo $REPO_NAME"
fi

SKIP_BUILD=false

echo "--------------------------------------------------"
echo "🚀 KubeLensy Build & Release: $SHORT_REV"
echo "--------------------------------------------------"

# 1. Build project
echo "📦 Building application..."

if [ "$FAST_MODE" = "true" ] && [ -f "$CACHE_FILE" ] && [ -d "$RELEASE_DIR/$APP_NAME" ]; then
    LAST_REV=$(cat "$CACHE_FILE")
    if [ "$LAST_REV" = "$FULL_REV" ]; then
        echo "⚡ No changes detected. Skipping rebuild/version bump."
        SKIP_BUILD=true
    fi
fi

if [ "$SKIP_BUILD" = "false" ]; then
    echo "🆙 Bumping version..."
    npm version patch --no-git-tag-version
    
    # Refresh current revision after version change
    FULL_REV=$(git rev-parse HEAD 2>/dev/null || date +%s)
    
    npm run electron:build || { echo "❌ Build failed"; exit 1; }
else
    echo "♻️  Reusing existing build artifacts."
fi

# 2. Check build artifacts
PACKAGE_VERSION=$(node -p "require('./package.json').version")
DMG_PATH="release/KubeLensy-${PACKAGE_VERSION}-arm64.dmg"

# Fallback if specific version DMG is not found
if [ ! -f "$DMG_PATH" ]; then
    DMG_PATH=$(ls release/*.dmg | head -n 1)
fi

if [ ! -d "$RELEASE_DIR/$APP_NAME" ]; then
    echo "❌ Error: Build failed. Application not found in $RELEASE_DIR"
    exit 1
fi

# 3. Local Installation
echo "🚚 Installing to Applications folder..."
if [ -d "$INSTALL_PATH" ]; then
    rm -rf "$INSTALL_PATH"
fi
cp -R "$RELEASE_DIR/$APP_NAME" /Applications/
xattr -cr "$INSTALL_PATH"

echo "$FULL_REV" > "$CACHE_FILE"

echo "✅ Success! KubeLensy is now installed."
echo "👉 Open with: open -a KubeLensy"

# 4. GitHub Release (Optional)
if command -v gh &> /dev/null; then
    echo "--------------------------------------------------"
    echo "🌐 Preparing GitHub Release ($CURRENT_TAG)..."
    
    # Check if release already exists
    if gh release view "$CURRENT_TAG" $GH_REPO_ARG &>/dev/null; then
        echo "🔄 Release $CURRENT_TAG already exists. Updating assets..."
        gh release upload "$CURRENT_TAG" "$DMG_PATH" $GH_REPO_ARG --clobber
    else
        echo "✨ Creating new release: $CURRENT_TAG"
        gh release create "$CURRENT_TAG" "$DMG_PATH" $GH_REPO_ARG \
            --title "KubeLensy v$PACKAGE_VERSION ($SHORT_REV)" \
            --notes "Automated build for version $PACKAGE_VERSION (commit $SHORT_REV)" \
            --latest
    fi
    echo "🔗 View release at: $(gh release view "$CURRENT_TAG" $GH_REPO_ARG --json url -q .url)"
else
    echo "⚠️  GitHub CLI (gh) not found. Skipping cloud upload."
fi
echo "--------------------------------------------------"