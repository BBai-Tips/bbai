#!/bin/sh

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Determine architecture
arch=$(uname -m)
case $arch in
    x86_64)
        arch="x86_64"
        ;;
    aarch64|arm64)
        arch="aarch64"
        ;;
    *)
        echo "${RED}Unsupported architecture: $arch${NC}"
        exit 1
        ;;
esac

# Determine OS
os=$(uname -s | tr '[:upper:]' '[:lower:]')
case $os in
    linux)
        os="unknown-linux-gnu"
        ;;
    darwin)
        os="apple-darwin"
        ;;
    *)
        echo "${RED}Unsupported OS: $os${NC}"
        exit 1
        ;;
esac

# Fetch latest release version
latest_version=$(curl -sL https://api.github.com/repos/BBai-Tips/bbai/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
# echo "Latest version: $latest_version"

# Download URL
download_url="https://github.com/BBai-Tips/bbai/releases/download/${latest_version}/bbai-${arch}-${os}-${latest_version}.tar.gz"
# echo "Download URL: $download_url"

# Create a temporary directory
temp_dir=$(mktemp -d)
# echo "Temporary directory: $temp_dir"
trap 'rm -rf "$temp_dir"' EXIT

# Download and extract the tarball
echo "${YELLOW}Downloading bbai ${latest_version} for ${arch}-${os}...${NC}"
curl -sL "$download_url" -o "$temp_dir/bbai.tar.gz"
# echo "Download complete. File size: $(wc -c < "$temp_dir/bbai.tar.gz") bytes"
# echo "File type: $(file "$temp_dir/bbai.tar.gz")"
echo "${YELLOW}Extracting archive...${NC}"
tar xzf "$temp_dir/bbai.tar.gz" -C "$temp_dir"

# List contents of temp directory
# echo "Contents of $temp_dir:"
# ls -la "$temp_dir"

# Make binaries executable
chmod +x "$temp_dir/bbai" "$temp_dir/bbai-api"

# Install binaries
echo "${YELLOW}Installing bbai and bbai-api to /usr/local/bin...${NC}"
echo "${RED}Note: This step requires sudo access. You may be prompted for your password.${NC}"
sudo mv "$temp_dir/bbai" "$temp_dir/bbai-api" /usr/local/bin/

echo "${GREEN}bbai and bbai-api have been successfully installed to /usr/local/bin/${NC}"
echo "${GREEN}You can now run 'bbai' and 'bbai-api' from anywhere in your terminal.${NC}"