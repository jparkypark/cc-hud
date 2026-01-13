# cc-hud justfile

set quiet

# Default recipe: show available commands
default:
    @just --list

# Enable or disable menubar auto-start on login
autostart action="enable":
    #!/usr/bin/env bash
    set -euo pipefail

    PLIST=~/Library/LaunchAgents/com.cc-hud.menubar.plist

    case "{{action}}" in
        enable)
            mkdir -p ~/Library/LaunchAgents
            /usr/libexec/PlistBuddy -c "Clear dict" "$PLIST" 2>/dev/null || true
            /usr/libexec/PlistBuddy -c "Add :Label string com.cc-hud.menubar" "$PLIST"
            /usr/libexec/PlistBuddy -c "Add :ProgramArguments array" "$PLIST"
            /usr/libexec/PlistBuddy -c "Add :ProgramArguments:0 string /usr/bin/open" "$PLIST"
            /usr/libexec/PlistBuddy -c "Add :ProgramArguments:1 string -a" "$PLIST"
            /usr/libexec/PlistBuddy -c "Add :ProgramArguments:2 string /Applications/CCMenubar.app" "$PLIST"
            /usr/libexec/PlistBuddy -c "Add :RunAtLoad bool true" "$PLIST"
            /usr/libexec/PlistBuddy -c "Add :KeepAlive bool false" "$PLIST"
            launchctl load "$PLIST" 2>/dev/null || true
            echo "Auto-start enabled. CCMenubar will launch on login."
            ;;
        disable)
            if [ -f "$PLIST" ]; then
                launchctl unload "$PLIST" 2>/dev/null || true
                rm "$PLIST"
                echo "Auto-start disabled."
            else
                echo "Auto-start was not enabled."
            fi
            ;;
        status)
            if [ -f "$PLIST" ]; then
                echo "Auto-start is enabled."
            else
                echo "Auto-start is disabled."
            fi
            ;;
        *)
            echo "Unknown action: {{action}}"
            echo "Usage: just autostart [enable|disable|status]"
            exit 1
            ;;
    esac

# Install both menubar and statusline (default), or specify: just install menubar|statusline
install component="all":
    #!/usr/bin/env bash
    set -euo pipefail

    install_statusline() {
        echo "Installing statusline dependencies..."
        cd apps/statusline && bun install
        echo "Statusline installed."
        echo ""
        echo "Configure Claude Code by adding to ~/.claude/settings.json:"
        echo '  "statusLine": {'
        echo '    "type": "command",'
        echo "    \"command\": \"bun {{justfile_directory()}}/apps/statusline/src/index.ts\""
        echo '  }'
    }

    install_menubar() {
        echo "Writing menubar config..."
        echo '{"hooksDir": "{{justfile_directory()}}/hooks"}' > ~/.claude/cc-hud-menubar.json
        echo "Building CCMenubar..."
        xcodebuild -project apps/menubar/CCMenubar/CCMenubar.xcodeproj \
            -scheme CCMenubar \
            -configuration Debug \
            build \
            -quiet
        echo "Stopping existing CCMenubar if running..."
        pkill -x CCMenubar 2>/dev/null || true
        echo "Installing to /Applications..."
        cp -r ~/Library/Developer/Xcode/DerivedData/CCMenubar-*/Build/Products/Debug/CCMenubar.app /Applications/
        echo "Launching CCMenubar..."
        open /Applications/CCMenubar.app
        echo "Done. CCMenubar installed and running."
        echo ""
        echo "To launch automatically on login: just autostart enable"
    }

    case "{{component}}" in
        all)
            install_statusline
            echo ""
            install_menubar
            ;;
        menubar)
            install_menubar
            ;;
        statusline)
            install_statusline
            ;;
        *)
            echo "Unknown component: {{component}}"
            echo "Usage: just install [all|menubar|statusline]"
            exit 1
            ;;
    esac
