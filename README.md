# SSL Certificate Expiration Checker (GNOME Extension)

A GNOME Shell extension that monitors SSL/TLS certificate expiration dates for a configurable list of websites with status indicators and desktop alerts.

---

## ✨ Features

- 🟢 **Green Icon (`security-high-symbolic`)**: All monitored websites have healthy, valid SSL certificates (> 7 days remaining).
- 🟠 **Orange Icon (`security-medium-symbolic`)**: Warning! At least one certificate is expiring within 7 days (or user-configured threshold).
- 🔴 **Red Icon (`security-low-symbolic`)**: Critical! At least one certificate has expired or encountered a connection/SSL error.
- 📋 **Interactive Popup Menu**:
  - Displays each monitored site with remaining days & exact expiration timestamp.
  - Clicking any site opens it directly in your default browser.
  - "Check Now" button for instant manual re-checking.
  - Direct shortcut to extension settings.
- ⚙️ **Rich Preferences Window (Libadwaita)**:
  - Add & remove domain names / hostnames dynamically.
  - Configure warning threshold (default: 7 days).
  - Configure background check interval (in minutes).
  - Toggle desktop notifications on or off.
- ⚡ **Non-Blocking & Asynchronous**: Fast parallel background TLS checks that never freeze or lag the GNOME Shell UI.

---

## 🚀 Installation

Run the installation script:
```bash
./install.sh
```

Or manually install:
```bash
UUID="ssl-expiration-checker@custom.extension"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$TARGET_DIR/schemas"
cp metadata.json extension.js prefs.js check_ssl.py stylesheet.css "$TARGET_DIR/"
cp schemas/org.gnome.shell.extensions.ssl-expiration-checker.gschema.xml "$TARGET_DIR/schemas/"
glib-compile-schemas "$TARGET_DIR/schemas/"
chmod +x "$TARGET_DIR/check_ssl.py"

gnome-extensions enable "$UUID"
```

### Restart GNOME Shell:
- **X11**: Press `Alt + F2`, type `r`, and press `Enter`.
- **Wayland**: Log out and log back in.

---

## 🛠️ Testing the Helper Script Directly

You can test the SSL verification script via command line:
```bash
./check_ssl.py '["google.com", "github.com", "expired.badssl.com"]' 7
```
