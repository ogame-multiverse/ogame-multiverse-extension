#!/bin/bash

TMP_DIR="./dist/temp"
BUILD_DIR="./dist/build"
CHROME_DIR="./dist/ogame-multiverse_chrome"
FIREFOX_DIR="./dist/ogame-multiverse_firefox"

# --- ARGUMENT PARSING ---
IS_RELEASE=false
IS_PACKAGE=false
VERSION_NUMBER=""

while [ $# -gt 0 ]; do
    case "$1" in
        release)
            IS_RELEASE=true
            shift
            ;;
        package)
            IS_PACKAGE=true
            shift
            ;;
        version)
            VERSION_NUMBER="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done
# ------------------------------

# Git hooks configuration if in a Git repository
if [ -d ".git" ]; then
    git config core.hooksPath .githooks
    echo "🔗 Git hooks configured to .githooks"
fi

# Clean up previous builds
rm -rf "$TMP_DIR" "$BUILD_DIR" "$CHROME_DIR" "$FIREFOX_DIR" ./dist/*.zip

# Create output directories
mkdir -p "$TMP_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$CHROME_DIR"
mkdir -p "$FIREFOX_DIR"

# Copy sources to temp directory
echo "📂 Copying sources to $TMP_DIR..."
cp -r src/* "$TMP_DIR/"

# Define path to globalConstants.ts
GLOBAL_CONSTANTS_FILE="$TMP_DIR/app/globalConstants.ts"

# TypeScript bundling function
bundle_ts() {
    local ENTRY_FILE="$1"
    local OUTPUT_FILE="$2"
    shift 2
    local EXTRA_ARGS="$@"

    echo "▶️ TypeScript Bundling (esbuild): $ENTRY_FILE to $OUTPUT_FILE..."

    if npx esbuild "$ENTRY_FILE" --bundle --outfile="$OUTPUT_FILE" --target=es2020 --platform=browser $EXTRA_ARGS; then
        echo "✅ Bundling ($ENTRY_FILE) successful."
    else
        echo "❌ Bundling ($ENTRY_FILE) failed."
        exit 1
    fi
}

# SCSS compilation function
compile_scss() {
    local SCSS_SOURCE="$1"
    local CSS_TARGET="$2"

    echo "▶️ SCSS Compilation: $SCSS_SOURCE to $CSS_TARGET..."
    
    local CSS_OUT_DIR=$(dirname "$CSS_TARGET")
    mkdir -p "$CSS_OUT_DIR"

    if ./node_modules/.bin/sass "$SCSS_SOURCE":"$CSS_TARGET" --style=expanded --no-source-map --quiet; then
        echo "✅ SCSS Compilation successful."
    else
        echo "❌ SCSS Compilation failed."
        exit 1
    fi
}

# 1. Dependencies & Type checking
npm i -D

echo "▶️ Type checking..."
if ! npx tsc --noEmit -p tsconfig.app.content.json; then
    echo "❌ Type checking failed for content app."
    exit 1
fi
if ! npx tsc --noEmit -p tsconfig.app.serviceWorker.json; then
    echo "❌ Type checking failed for serviceWorker app."
    exit 1
fi
if ! npx tsc --noEmit -p tsconfig.app.sidePanel.json; then
    echo "❌ Type checking failed for sidePanel app."
    exit 1
fi

# --- VERSION NUMBER INJECTION ---
if [ -n "$VERSION_NUMBER" ]; then
    echo "🏷️ Specified version: $VERSION_NUMBER"

    # Replace version in manifests
    sed -i "s/\"version\": \"0.0.0\"/\"version\": \"$VERSION_NUMBER\"/g" "$TMP_DIR/manifest.json"
    sed -i "s/\"version\": \"0.0.0\"/\"version\": \"$VERSION_NUMBER\"/g" "$TMP_DIR/manifest_firefox.json"

    # Replace version in TS code
    if [ -f "$GLOBAL_CONSTANTS_FILE" ]; then
        sed -i "s/__VERSION__/$VERSION_NUMBER/g" "$GLOBAL_CONSTANTS_FILE"
        echo "✅ Version injected into globalConstants.ts"
    else
        echo "⚠️ Warning: $GLOBAL_CONSTANTS_FILE not found."
    fi
fi
# ------------------------------------------

# 2. Build loop for both target browsers
for TARGET in chrome firefox; do

    OUT_DIR="$CHROME_DIR"
    MANIFEST_SRC="$TMP_DIR/manifest.json"
    if [ "$TARGET" = "firefox" ]; then
        OUT_DIR="$FIREFOX_DIR"
        MANIFEST_SRC="$TMP_DIR/manifest_firefox.json"
    fi

    echo "🚀 Building extension for target: $TARGET into $OUT_DIR..."

    # Use sources from temp directory
    mkdir -p "$OUT_DIR"
    cp -r "$TMP_DIR/assets" "$OUT_DIR/"
    cp -r "$TMP_DIR/views" "$OUT_DIR/"
    
    mkdir -p "$OUT_DIR/assets/fonts"
    cp node_modules/@fontsource/material-symbols-outlined/files/material-symbols-outlined-latin-400-normal.woff2 "$OUT_DIR/assets/fonts/"
    
    if [ -f "$MANIFEST_SRC" ]; then
        cp "$MANIFEST_SRC" "$OUT_DIR/manifest.json"
    else
        echo "❌ $MANIFEST_SRC missing."
        exit 1
    fi

    # JS bundling from TEMP
    bundle_ts "$TMP_DIR/app/contexts/content.entry.ts" "$OUT_DIR/app.content.js" --minify
    bundle_ts "$TMP_DIR/app/contexts/serviceWorker.entry.ts" "$OUT_DIR/app.worker.js" --minify
    bundle_ts "$TMP_DIR/app/contexts/sidePanel.entry.ts" "$OUT_DIR/app.sidepanel.js" --minify

    # CSS compilation from TEMP
    compile_scss "$TMP_DIR/app/app.scss" "$OUT_DIR/app.css"
    compile_scss "$TMP_DIR/app/contexts/sidePanel/sidepanel.scss" "$OUT_DIR/sidepanel.css"
done

# --- ZIP ARCHIVE CREATION (PACKAGE MODE) ---
if [ "$IS_PACKAGE" = true ]; then
    echo "📦 Creating Chrome archive..."
    (cd "$CHROME_DIR" && zip -qr "../ogame-multiverse_chrome.zip" .)
    
    echo "📦 Creating Firefox archive..."
    (cd "$FIREFOX_DIR" && zip -qr "../ogame-multiverse_firefox.zip" .)
    
    echo "✅ Archives successfully created in ./dist/"
fi
# ------------------------------------------------

# Final cleanup of temp directory
rm -rf "$TMP_DIR"

# Cleanup of build directory
rm -rf "$BUILD_DIR"

echo "🎉 All builds complete. $CHROME_DIR (Chrome) and $FIREFOX_DIR (Firefox) are ready."