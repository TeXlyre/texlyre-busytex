#!/bin/bash

VERSION=$(node -p "require('./package.json').version")
REPO="TeXlyre/texlyre-busytex"
RELEASE_TAG="assets-v$VERSION"
ARCHIVE_NAME="busytex-assets.tar.gz"

echo "Creating archive from public/core/busytex..."
echo "Version: v$VERSION"
echo ""

cd public/core
tar -czf ../../$ARCHIVE_NAME busytex/
cd ../..

echo ""
echo "Archive created successfully!"
echo ""
echo "Please upload manually:"
echo "1. Go to: https://github.com/$REPO/releases/new"
echo "2. Tag: $RELEASE_TAG"
echo "3. Title: BusyTeX Assets v$VERSION"
echo "4. Upload file: $ARCHIVE_NAME"
echo ""
echo "Archive location: $(pwd)/$ARCHIVE_NAME"
echo ""
read -p "Press Enter after uploading to delete the archive..."

rm $ARCHIVE_NAME
echo "✓ Cleanup complete"