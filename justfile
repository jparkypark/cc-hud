# cc-hud justfile

set quiet

# Default recipe: show available commands
default:
    @just --list

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
