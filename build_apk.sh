#!/bin/bash
set -e

echo "=================================================="
echo "   AERIVA AI — Android APK Generator"
echo "=================================================="

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$PROJECT_DIR/mobile"

cd "$MOBILE_DIR"

# 1. Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo ""
    echo "❌ Flutter SDK not found in PATH."
    echo ""
    echo "To install Flutter on your Mac, run:"
    echo "   brew install --cask flutter"
    echo "or download it from: https://docs.flutter.dev/get-started/install/macos"
    echo ""
    exit 1
fi

# 2. Check / Generate Android platform directory if needed
if [ ! -d "android" ]; then
    echo "⚙️  Generating Android platform scaffold..."
    flutter create . --platforms=android --org com.aeriva.app
fi

# 3. Fetch dependencies
echo "📦 Installing packages..."
flutter pub get

# 4. Build the standalone Release APK
echo "🚀 Compiling standalone Android APK (release mode)..."
flutter build apk --release

echo ""
echo "=================================================="
echo "✅ APK BUILT SUCCESSFULLY!"
echo "=================================================="
echo ""
echo "📍 APK File Location:"
echo "$MOBILE_DIR/build/app/outputs/flutter-apk/app-release.apk"
echo ""
echo "📱 How to Install on your Phone:"
echo "1. Send 'app-release.apk' to your phone via WhatsApp, Google Drive, or USB cable."
echo "2. Open the file on your phone and tap 'Install'."
echo "3. The AERIVA app icon will now appear on your phone screen."
echo "4. You can open and use it 24/7 even with your computer turned off!"
echo "=================================================="

