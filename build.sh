#!/bin/bash

TMP_DIR="./dist/temp"
BUILD_DIR="./dist/build"
CHROME_DIR="./dist/ogame-multiverse_chrome"
FIREFOX_DIR="./dist/ogame-multiverse_firefox"

# --- ANALYSE DES ARGUMENTS ---
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

# Nettoyage des builds précédents
rm -rf "$TMP_DIR" "$BUILD_DIR" "$CHROME_DIR" "$FIREFOX_DIR" ./dist/*.zip

# Création des répertoires
mkdir -p "$TMP_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$CHROME_DIR"
mkdir -p "$FIREFOX_DIR"

# Copie des sources dans le dossier temporaire
echo "📂 Copie des sources dans $TMP_DIR..."
cp -r src/* "$TMP_DIR/"

# Définition du chemin vers le fichier globalConstants.ts
GLOBAL_CONSTANTS_FILE="$TMP_DIR/app/globalConstants.ts"

# Fonction de compilation pour TypeScript
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

# Fonction de compilation pour SCSS
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

# 1. Dépendances & Vérification des types
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

# --- MODIFICATION DU NUMÉRO DE VERSION ---
if [ -n "$VERSION_NUMBER" ]; then
    echo "🏷️ Version spécifiée : $VERSION_NUMBER"

    # Remplacement dans les manifests
    sed -i "s/\"version\": \"0.0.0\"/\"version\": \"$VERSION_NUMBER\"/g" "$TMP_DIR/manifest.json"
    sed -i "s/\"version\": \"0.0.0\"/\"version\": \"$VERSION_NUMBER\"/g" "$TMP_DIR/manifest_firefox.json"

    # Remplacement dans le code TS
    if [ -f "$GLOBAL_CONSTANTS_FILE" ]; then
        sed -i "s/__VERSION__/$VERSION_NUMBER/g" "$GLOBAL_CONSTANTS_FILE"
        echo "✅ Version injectée dans globalConstants.ts"
    else
        echo "⚠️ Avertissement : $GLOBAL_CONSTANTS_FILE introuvable."
    fi
fi
# ------------------------------------------

# 2. Boucle de build pour générer les deux dossiers
for TARGET in chrome firefox; do

    OUT_DIR="$CHROME_DIR"
    MANIFEST_SRC="$TMP_DIR/manifest.json"
    if [ "$TARGET" = "firefox" ]; then
        OUT_DIR="$FIREFOX_DIR"
        MANIFEST_SRC="$TMP_DIR/manifest_firefox.json"
    fi

    echo "🚀 Building extension for target: $TARGET into $OUT_DIR..."

    # Utilisation des sources du dossier temporaire
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

    # Bundling JS depuis TEMP
    bundle_ts "$TMP_DIR/app/contexts/content.entry.ts" "$OUT_DIR/app.content.js" --minify
    bundle_ts "$TMP_DIR/app/contexts/serviceWorker.entry.ts" "$OUT_DIR/app.worker.js" --minify
    bundle_ts "$TMP_DIR/app/contexts/sidePanel.entry.ts" "$OUT_DIR/app.sidepanel.js" --minify

    # Compilation CSS depuis TEMP
    compile_scss "$TMP_DIR/app/app.scss" "$OUT_DIR/app.css"
    compile_scss "$TMP_DIR/app/contexts/sidePanel/sidepanel.scss" "$OUT_DIR/sidepanel.css"
done

# --- CREATION DES ARCHIVES ZIP (MODE PACKAGE) ---
if [ "$IS_PACKAGE" = true ]; then
    echo "📦 Création de l'archive pour Chrome..."
    (cd "$CHROME_DIR" && zip -qr "../ogame-multiverse_chrome.zip" .)
    
    echo "📦 Création de l'archive pour Firefox..."
    (cd "$FIREFOX_DIR" && zip -qr "../ogame-multiverse_firefox.zip" .)
    
    echo "✅ Archives créées avec succès dans ./dist/"
fi
# ------------------------------------------------

# Nettoyage final du dossier temporaire
rm -rf "$TMP_DIR"

# Nettoyage du dossier de build
rm -rf "$BUILD_DIR"

echo "🎉 All builds complete. $CHROME_DIR (Chrome) and $FIREFOX_DIR (Firefox) are ready."