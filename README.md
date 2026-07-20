# gitlab-activity-display

RSS activity feed display app for a Pi and a 3.5" TFT display.

## Get It

```bash
git clone https://github.com/EthyMoney/gitlab-activity-display.git
sudo chown -R $USER:$USER gitlab-activity-display
cd gitlab-activity-display
```

## Build It

Switch to the branch you want, there's a branch for 3.5" TFT (main), and 10.1" 1024x600 on a 32-bit Pi (32-bit-1024x600-version)

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

## Raspberry Pi Setup Gotchas & Troubleshooting

If you are running this on an older Pi (e.g. Pi 2) or a newer OS (e.g. Debian Trixie 32-bit), you might encounter some specific issues:

### HDMI Display is Black (No Signal)

The new default graphics driver (`vc4-kms-v3d`) has compatibility issues with older 1024x600 monitors, causing the HDMI signal to drop even when Xorg is rendering correctly.

**Fix:** Edit `/boot/firmware/config.txt` and switch to the Fake KMS driver, while also forcing the HDMI resolution:

1. Change `dtoverlay=vc4-kms-v3d` to `dtoverlay=vc4-fkms-v3d` (or delete the line completely to use legacy fbdev).
2. Add the following lines to forcefully drive your 1024x600 monitor:
```ini
hdmi_force_hotplug=1
hdmi_group=2
hdmi_mode=87
hdmi_cvt=1024 600 60 6 0 0 0
```

### Electron App Hangs (100% CPU on 1 Core, No Window)

Debian Trixie restricts user-namespace sandboxing by default. The Electron sandbox initialization will infinitely loop and freeze the app.

**Fix:** Add the `--no-sandbox` flag to the application execution command (e.g. in your Openbox `autostart` file):
```bash
gitlab-activity-display --no-sandbox
```

### Scheduled Backlight Control

You can automatically turn your HDMI monitor on and off using `ddcutil` and `cron`:

1. Install `ddcutil` and enable I2C:
```bash
sudo apt install ddcutil i2c-tools -y
echo 'i2c-dev' | sudo tee -a /etc/modules
sudo modprobe i2c-dev
```

2. Create a control script `/usr/local/bin/display-power`:
```bash
#!/usr/bin/env bash
ACTION="${1:-}"
case "$ACTION" in
  on)  VALUE=1 ;;
  off) VALUE=4 ;;
esac
ddcutil setvcp D6 "$VALUE"
```
3. Make it executable (`sudo chmod +x /usr/local/bin/display-power`) and add it to `sudo crontab -e`:
```text
0 8 * * * /usr/local/bin/display-power on
0 17 * * * /usr/local/bin/display-power off
```
