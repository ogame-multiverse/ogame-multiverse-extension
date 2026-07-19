#!/bin/bash

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
if ! npx tsc --noEmit -p tsconfig.app.worker.json; then
    echo "❌ Type checking failed for worker app."
    exit 1
fi

# Nettoyage des builds précédents
rm -rf ./dist ./dist_firefox

# 2. Boucle de build pour générer les deux dossiers
for TARGET in chrome firefox; do
    if [ "$TARGET" = "firefox" ]; then
        OUT_DIR="./dist_firefox"
        MANIFEST_SRC="src/manifest_firefox.json"
    else
        OUT_DIR="./dist"
        MANIFEST_SRC="src/manifest.json"
    fi

    echo "🚀 Building extension for target: $TARGET into $OUT_DIR..."

    # FIX : On crée la racine d'abord, on copie les dossiers sources,
    # puis on crée le sous-dossier pour la police.
    mkdir -p "$OUT_DIR"
    cp -r "src/assets" "$OUT_DIR/"
    cp -r "src/views" "$OUT_DIR/"
    
    mkdir -p "$OUT_DIR/assets/fonts"
    cp node_modules/@fontsource/material-symbols-outlined/files/material-symbols-outlined-latin-400-normal.woff2 "$OUT_DIR/assets/fonts/"
    
    if [ -f "$MANIFEST_SRC" ]; then
        cp "$MANIFEST_SRC" "$OUT_DIR/manifest.json"
    else
        echo "❌ $MANIFEST_SRC missing."
        exit 1
    fi

    # Bundling JS
    bundle_ts "src/app/contexts/content.entry.ts" "$OUT_DIR/app.content.js" --minify
    bundle_ts "src/app/contexts/serviceWorker.entry.ts" "$OUT_DIR/app.worker.js" --minify
    bundle_ts "src/app/contexts/sidePanel.entry.ts" "$OUT_DIR/app.sidepanel.js" --minify

    # Compilation CSS
    compile_scss "src/app/sidePanelContext/sidepanel.scss" "$OUT_DIR/sidepanel.css"
done

echo "🎉 All builds complete. /dist (Chrome) and /dist_firefox (Firefox) are ready."