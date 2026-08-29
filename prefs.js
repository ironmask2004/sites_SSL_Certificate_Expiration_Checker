import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export default class SSLExpirationCheckerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('SSL Checker'),
            icon_name: 'security-high-symbolic',
        });
        window.add(page);

        // --- Group: Monitored Sites ---
        const sitesGroup = new Adw.PreferencesGroup({
            title: _('Monitored Sites'),
            description: _('Add domains or hostnames to monitor for SSL certificate expiration.'),
        });
        page.add(sitesGroup);

        // Add Site Entry Row
        const addEntryRow = new Adw.EntryRow({
            title: _('Add New Domain / Host'),
        });
        const addBtn = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
            tooltip_text: _('Add site to list'),
        });
        addEntryRow.add_suffix(addBtn);

        const addSite = () => {
            let text = addEntryRow.get_text().trim();
            if (!text) return;

            // Remove scheme and paths
            text = text.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
            if (!text) return;

            const currentSites = settings.get_strv('sites-list');
            if (!currentSites.includes(text)) {
                currentSites.push(text);
                settings.set_strv('sites-list', currentSites);
            }
            addEntryRow.set_text('');
            rebuildSitesList();
        };

        addBtn.connect('clicked', addSite);
        addEntryRow.connect('entry-activated', addSite);
        sitesGroup.add(addEntryRow);

        // Dynamic rows container for sites list
        const rowsBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_top: 8,
        });
        sitesGroup.add(rowsBox);

        const rebuildSitesList = () => {
            // Remove existing children in rowsBox
            let child = rowsBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                rowsBox.remove(child);
                child = next;
            }

            const currentSites = settings.get_strv('sites-list');
            if (currentSites.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: _('No sites added yet'),
                    subtitle: _('Type a domain name above and click Add'),
                });
                rowsBox.append(emptyRow);
                return;
            }

            for (const site of currentSites) {
                const row = new Adw.ActionRow({
                    title: site,
                    icon_name: 'network-server-symbolic',
                });

                const deleteBtn = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['destructive-action', 'flat'],
                    tooltip_text: _('Remove site'),
                });

                deleteBtn.connect('clicked', () => {
                    const list = settings.get_strv('sites-list');
                    const updated = list.filter(s => s !== site);
                    settings.set_strv('sites-list', updated);
                    rebuildSitesList();
                });

                row.add_suffix(deleteBtn);
                rowsBox.append(row);
            }
        };

        rebuildSitesList();

        // --- Group: General Settings ---
        const configGroup = new Adw.PreferencesGroup({
            title: _('Monitoring Configuration'),
            description: _('Configure check frequency and alert thresholds.'),
        });
        page.add(configGroup);

        // Warning days spin row
        const warningSpin = new Adw.SpinRow({
            title: _('Warning Threshold (Days)'),
            subtitle: _('Show orange warning status when remaining days are less than or equal to this value (default: 7 days)'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 90,
                step_increment: 1,
                page_increment: 7,
                value: settings.get_int('warning-days'),
            }),
        });
        warningSpin.connect('notify::value', () => {
            settings.set_int('warning-days', warningSpin.get_value());
        });
        configGroup.add(warningSpin);

        // Interval spin row
        const intervalSpin = new Adw.SpinRow({
            title: _('Check Interval (Minutes)'),
            subtitle: _('Frequency of automated background SSL checks (default: 60 minutes)'),
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 1440,
                step_increment: 5,
                page_increment: 60,
                value: settings.get_int('check-interval-minutes'),
            }),
        });
        intervalSpin.connect('notify::value', () => {
            settings.set_int('check-interval-minutes', intervalSpin.get_value());
        });
        configGroup.add(intervalSpin);

        // Desktop notification switch
        const notifySwitch = new Adw.SwitchRow({
            title: _('Desktop Notifications'),
            subtitle: _('Show desktop alert popups when certificates enter warning or expired state'),
            active: settings.get_boolean('notify-on-warning'),
        });
        notifySwitch.connect('notify::active', () => {
            settings.set_boolean('notify-on-warning', notifySwitch.get_active());
        });
        configGroup.add(notifySwitch);
    }
}
