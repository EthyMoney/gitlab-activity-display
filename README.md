# gitlab-activity-display

RSS activity feed display app for a Pi and a 3.5" TFT display.

## Get It

```bash
git clone https://github.com/EthyMoney/gitlab-activity-display.git
sudo chown -R your_username:your_username gitlab-activity-display
cd gitlab-activity-display
```

## Build It

First, set your feed URL with a valid feed token in `config.json` (copy from `config.json.template`). This gets bundled into the built app, so it needs to be correct before building.

**Important: Never use `sudo` with npm commands as it creates permission issues!**

```bash
# Copy and configure the config file
cp config.json.template config.json
# Edit config.json with your GitLab feed URL and token

# Clean any previous builds (if needed)
rm -rf package-lock.json node_modules .vite

# Install dependencies
npm install

# Install system dependencies for packaging
sudo apt install rpm -y

# Build the application (choose one based on your target)
npm run make        # for current architecture
npm run make-pi     # for 64-bit ARM (Pi Zero2/3/4/5)
npm run make-pi-32  # for 32-bit ARM (Pi 1/2/Zero)
```

**If you encounter permission errors:**
```bash
# Fix ownership if files were created with sudo
sudo chown -R $USER:$USER .
# Clean temp directories
sudo rm -rf /tmp/electron-*
# Then retry the build
```

## Install It

```bash
# Install system dependencies
sudo apt install trash-cli libglib2.0-bin -y

# Install the built package (adjust architecture as needed)
sudo dpkg -i out/make/deb/armv7l/gitlab-activity-display_*.deb   # for 32-bit ARM
# or
sudo dpkg -i out/make/deb/arm64/gitlab-activity-display_*.deb    # for 64-bit ARM
# or  
sudo dpkg -i out/make/deb/x64/gitlab-activity-display_*.deb      # for x64
```

## Run As Service

See `service-config.txt` for details on how to run the app as a service.

## Troubleshooting

### Build Issues

**Error: "main entry point was not found"**
- This happens when the build process fails or is interrupted
- Solution: Clean build artifacts and rebuild:
  ```bash
  rm -rf .vite node_modules package-lock.json
  npm install
  npm run make-pi-32  # or your target architecture
  ```

**Error: "EACCES: permission denied"**
- This happens when previous builds were run with `sudo`
- Solution: Fix ownership and clean temp files:
  ```bash
  sudo chown -R $USER:$USER .
  sudo rm -rf /tmp/electron-*
  rm -rf .vite node_modules
  npm install
  ```

**Error: "failed to load config"**
- Make sure `config.json` exists (copy from `config.json.template`)
- Ensure the config file has valid JSON syntax

### Runtime Issues

**App doesn't start or crashes**
- Check that all system dependencies are installed
- Verify the config.json has a valid GitLab feed URL
- Check system resources (especially on Pi 2/3/Zero)

## Uninstall It

```bash
sudo apt remove --purge gitlab-activity-display -y
```
