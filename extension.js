import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const SSLIndicator = GObject.registerClass(
class SSLIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'SSL Expiration Checker', false);
        this._extension = extension;
        this._settings = extension.getSettings();
        this._lastStatus = null;
        this._isChecking = false;

        // Panel Icon
        this._icon = new St.Icon({
            icon_name: 'security-high-symbolic',
            style_class: 'system-status-icon ssl-status-icon ssl-status-ok',
            style: 'color: #2ec27e;',
        });
        this.add_child(this._icon);

        this._buildMenu();
    }

    _buildMenu() {
        this.menu.removeAll();

        // Header section
        this._headerBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'ssl-header-box',
            x_expand: true,
        });

        this._headerTitle = new St.Label({
            text: _('SSL Expiration Checker'),
            style_class: 'ssl-header-title',
        });
        this._headerSubtitle = new St.Label({
            text: _('Checking certificates...'),
            style_class: 'ssl-header-subtitle',
        });
        this._headerBox.add_child(this._headerTitle);
        this._headerBox.add_child(this._headerSubtitle);

        const headerItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        headerItem.add_child(this._headerBox);
        this.menu.addMenuItem(headerItem);

        // Action buttons row (Check Now, Preferences)
        const actionsItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        const actionsBox = new St.BoxLayout({
            x_expand: true,
            style: 'spacing: 8px; padding: 4px 12px;',
        });

        const refreshBtn = new St.Button({
            label: _('🔄 Check Now'),
            style_class: 'button',
            x_expand: true,
        });
        refreshBtn.connect('clicked', () => {
            this._extension.checkAllSites();
        });

        const prefsBtn = new St.Button({
            label: _('⚙️ Settings'),
            style_class: 'button',
            x_expand: true,
        });
        prefsBtn.connect('clicked', () => {
            this.menu.close();
            this._extension.openPreferences();
        });

        actionsBox.add_child(refreshBtn);
        actionsBox.add_child(prefsBtn);
        actionsItem.add_child(actionsBox);
        this.menu.addMenuItem(actionsItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Sites Section (Scrollable if many sites)
        this._sitesSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._sitesSection);
    }

    setChecking(checking) {
        this._isChecking = checking;
        if (checking) {
            this._icon.icon_name = 'emblem-synchronizing-symbolic';
            this._icon.style_class = 'system-status-icon ssl-status-icon ssl-status-checking';
            this._icon.style = 'color: #9a9996;';
            this._headerSubtitle.text = _('Checking certificates now...');
        }
    }

    setNetworkOffline() {
        this._isChecking = false;
        this._icon.icon_name = 'network-offline-symbolic';
        this._icon.style_class = 'system-status-icon ssl-status-icon ssl-status-checking';
        this._icon.style = 'color: #9a9996;';
        this._headerSubtitle.text = _('Waiting for network connection...');
    }

    updateResults(data) {
        this._isChecking = false;
        const overallStatus = data.overall_status || 'ok';
        const results = data.results || [];
        const checkedAt = data.checked_at || '';

        // Update panel icon:
        // - Red icon: when some site's SSL is expired
        // - Orange icon: when some site has <= warning_days
        // - Amber/warning icon: when there's a connection/network error
        // - Green icon: if all SSL are OK
        if (overallStatus === 'expired') {
            this._icon.icon_name = 'security-low-symbolic';
            this._icon.style_class = 'system-status-icon ssl-status-icon ssl-status-expired';
            this._icon.style = 'color: #e01b24;';
        } else if (overallStatus === 'warning') {
            this._icon.icon_name = 'security-medium-symbolic';
            this._icon.style_class = 'system-status-icon ssl-status-icon ssl-status-warning';
            this._icon.style = 'color: #f57900;';
        } else if (overallStatus === 'error') {
            this._icon.icon_name = 'dialog-warning-symbolic';
            this._icon.style_class = 'system-status-icon ssl-status-icon ssl-status-error';
            this._icon.style = 'color: #e66100;';
        } else {
            this._icon.icon_name = 'security-high-symbolic';
            this._icon.style_class = 'system-status-icon ssl-status-icon ssl-status-ok';
            this._icon.style = 'color: #2ec27e;';
        }

        // Header Subtitle
        let subtitleText = '';
        if (results.length === 0) {
            subtitleText = _('No sites configured in settings');
        } else if (overallStatus === 'expired') {
            subtitleText = _('⚠️ Action Required: Expired SSL Certificate(s)!');
        } else if (overallStatus === 'warning') {
            subtitleText = _('⚡ Warning: Certificate(s) expiring soon!');
        } else if (overallStatus === 'error') {
            subtitleText = _('⚠️ Connection error checking one or more sites');
        } else {
            subtitleText = _('✓ All SSL certificates are valid and secure');
        }

        if (checkedAt) {
            subtitleText += `\n${_('Last checked:')} ${checkedAt}`;
        }
        this._headerSubtitle.text = subtitleText;

        // Rebuild sites list
        this._sitesSection.removeAll();

        if (results.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem(_('Click Settings to add sites'), {
                reactive: true,
            });
            emptyItem.connect('activate', () => {
                this.menu.close();
                this._extension.openPreferences();
            });
            this._sitesSection.addMenuItem(emptyItem);
            return;
        }

        for (const item of results) {
            const siteItem = new PopupMenu.PopupBaseMenuItem({
                reactive: true,
                style_class: 'ssl-site-item',
            });

            const rowBox = new St.BoxLayout({
                x_expand: true,
                orientation: Clutter.Orientation.HORIZONTAL,
                style: 'spacing: 10px;',
            });

            let iconName = 'security-high-symbolic';
            let iconClass = 'ssl-status-ok';
            let iconColor = '#2ec27e';
            let statusText = '';
            let subtitleClass = 'ssl-site-subtitle';

            if (item.status === 'expired') {
                iconName = 'dialog-error-symbolic';
                iconClass = 'ssl-status-expired';
                iconColor = '#e01b24';
                const daysAbs = item.days_left !== null ? Math.abs(item.days_left) : 0;
                statusText = item.days_left !== null 
                    ? _(`EXPIRED ${daysAbs.toFixed(0)} days ago (${item.expiry_str})`)
                    : _(`EXPIRED (${item.expiry_str || 'Date unknown'})`);
                subtitleClass = 'ssl-site-subtitle ssl-badge-expired';
            } else if (item.status === 'error') {
                iconName = 'dialog-warning-symbolic';
                iconClass = 'ssl-status-error';
                iconColor = '#e66100';
                statusText = _(`Connection error: ${item.error || 'Failed to connect'}`);
                subtitleClass = 'ssl-site-subtitle ssl-badge-error';
            } else if (item.status === 'warning') {
                iconName = 'dialog-warning-symbolic';
                iconClass = 'ssl-status-warning';
                iconColor = '#f57900';
                statusText = _(`Expires in ${item.days_left} days! (${item.expiry_str})`);
                subtitleClass = 'ssl-site-subtitle ssl-badge-warning';
            } else {
                iconName = 'emblem-ok-symbolic';
                iconClass = 'ssl-status-ok';
                iconColor = '#2ec27e';
                statusText = _(`Expires in ${item.days_left} days (${item.expiry_str})`);
                subtitleClass = 'ssl-site-subtitle ssl-badge-ok';
            }

            const itemIcon = new St.Icon({
                icon_name: iconName,
                style_class: `ssl-status-icon ${iconClass}`,
                style: `color: ${iconColor};`,
            });

            const textBox = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
            });

            const titleLabel = new St.Label({
                text: item.site,
                style_class: 'ssl-site-title',
            });

            const subtitleLabel = new St.Label({
                text: statusText,
                style_class: subtitleClass,
            });

            textBox.add_child(titleLabel);
            textBox.add_child(subtitleLabel);

            rowBox.add_child(itemIcon);
            rowBox.add_child(textBox);

            siteItem.add_child(rowBox);

            // Clicking opens URL in browser
            siteItem.connect('activate', () => {
                const targetUrl = item.site.startsWith('http') ? item.site : `https://${item.site}`;
                try {
                    Gio.AppInfo.launch_default_for_uri_async(targetUrl, null, null, null);
                } catch (e) {
                    console.error(`Failed to open URL ${targetUrl}:`, e);
                }
            });

            this._sitesSection.addMenuItem(siteItem);
        }
    }
});

export default class SSLExpirationCheckerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new SSLIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Network monitoring: wait for network ready before checking
        this._networkMonitor = Gio.NetworkMonitor.get_default();
        this._networkChangedId = this._networkMonitor.connect('network-changed', (monitor, available) => {
            if (available) {
                this._scheduleCheck(3000);
            } else if (this._indicator) {
                this._indicator.setNetworkOffline();
            }
        });

        // Listen for settings changes
        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            if (key === 'sites-list' || key === 'warning-days') {
                this.checkAllSites();
            } else if (key === 'check-interval-minutes') {
                this._resetTimer();
            }
        });

        // Delay initial check slightly on startup to let network/DNS fully initialize
        if (this._networkMonitor.network_available) {
            this._scheduleCheck(5000);
        } else {
            this._indicator.setNetworkOffline();
        }
        this._resetTimer();
    }

    disable() {
        if (this._scheduledCheckId) {
            GLib.Source.remove(this._scheduledCheckId);
            this._scheduledCheckId = null;
        }

        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._networkChangedId && this._networkMonitor) {
            this._networkMonitor.disconnect(this._networkChangedId);
            this._networkChangedId = null;
        }
        this._networkMonitor = null;

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }

    _scheduleCheck(delayMs = 5000) {
        if (this._scheduledCheckId) {
            GLib.Source.remove(this._scheduledCheckId);
            this._scheduledCheckId = null;
        }

        this._scheduledCheckId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delayMs,
            () => {
                this._scheduledCheckId = null;
                this.checkAllSites();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _resetTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        const intervalMinutes = Math.max(5, this._settings.get_int('check-interval-minutes'));
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            intervalMinutes * 60,
            () => {
                this.checkAllSites();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    async checkAllSites() {
        if (!this._indicator) return;

        // Verify network availability before running
        if (this._networkMonitor && !this._networkMonitor.network_available) {
            this._indicator.setNetworkOffline();
            return;
        }

        this._indicator.setChecking(true);

        const sitesList = this._settings.get_strv('sites-list');
        const warningDays = this._settings.get_int('warning-days');
        const scriptPath = GLib.build_filenamev([this.path, 'check_ssl.py']);

        try {
            const proc = Gio.Subprocess.new(
                [
                    '/usr/bin/python3',
                    scriptPath,
                    JSON.stringify(sitesList),
                    warningDays.toString(),
                ],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (subprocess, res) => {
                try {
                    const [ok, stdout, stderr] = subprocess.communicate_utf8_finish(res);
                    if (ok && stdout) {
                        const data = JSON.parse(stdout);
                        if (this._indicator) {
                            this._indicator.updateResults(data);
                            this._checkAndNotify(data);
                        }
                    } else {
                        console.error('SSL Checker script failed:', stderr);
                        if (this._indicator) {
                            this._indicator.setChecking(false);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing SSL checker response:', e);
                    if (this._indicator) {
                        this._indicator.setChecking(false);
                    }
                }
            });
        } catch (e) {
            console.error('Failed to launch SSL check subprocess:', e);
            if (this._indicator) {
                this._indicator.setChecking(false);
            }
        }
    }

    _checkAndNotify(data) {
        if (!this._settings.get_boolean('notify-on-warning')) return;

        const expiredCount = data.results.filter(r => r.status === 'expired').length;
        const warningCount = data.results.filter(r => r.status === 'warning').length;

        if (expiredCount > 0) {
            Main.notify(
                _('SSL Certificate Expired!'),
                _(`${expiredCount} site(s) have expired SSL certificates. Click the panel icon for details.`)
            );
        } else if (warningCount > 0) {
            const warningDays = this._settings.get_int('warning-days');
            Main.notify(
                _('SSL Certificate Expiring Soon'),
                _(`${warningCount} site(s) will expire within ${warningDays} days. Click the panel icon for details.`)
            );
        }
    }
}
