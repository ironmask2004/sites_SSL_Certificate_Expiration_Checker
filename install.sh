#!/bin/bash
set -e

UUID="ssl-expiration-checker@custom.extension"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "==> Compiling GSettings schema..."
glib-compile-schemas schemas/

echo "==> Creating extension directory: $EXT_DIR"
mkdir -p "$EXT_DIR"
mkdir -p "$EXT_DIR/schemas"

echo "==> Copying extension files..."
cp metadata.json "$EXT_DIR/"
cp extension.js "$EXT_DIR/"
cp prefs.js "$EXT_DIR/"
cp check_ssl.py "$EXT_DIR/"
cp stylesheet.css "$EXT_DIR/"
cp schemas/org.gnome.shell.extensions.ssl-expiration-checker.gschema.xml "$EXT_DIR/schemas/"
cp schemas/gschemas.compiled "$EXT_DIR/schemas/"
chmod +x "$EXT_DIR/check_ssl.py"

echo "==> Enabling extension..."
gnome-extensions enable "$UUID" 2>/dev/null || true

echo "==> Done! If GNOME Shell is running under X11, press Alt+F2, type 'r', and hit Enter."
echo "    Under Wayland, log out and log back in, or manage with 'gnome-extensions enable $UUID'."
