#!/bin/bash

# This script is for older pi models like the Pi 3, Pi 2, Pi Zero, and Pi Zero 2
# It installs the required software to use a 3.5" SPI display with touch screen and configures Pi OS to start the app on boot
# YOU NEED TO DO SOME PREP-WORK FOR THIS SCRIPT TO WORK, SEE BELOW:

# Requirements and steps
# A Raspberry Pi, running Raspberry Pi OS Bookworm 64-bit (FULL version WITH DESKTOP!)
# A 3.5" SPI display with touch screen (tested with a generic one, but should work with most)
# The application already built into a .deb package from another Pi/device (set your url in config.json.template, rename it to config.json, and build with "npm run make-pi")
# Copy the .deb package to this Pi once it first boots up
# Running this script as root AFTER the app deb package has been copied to the Pi (script will find it and install it)
# A cold beer while you wait for the script to finish :)

USERNAME="logan"

# Check for root privileges
if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root" 
    exit 1
fi

echo ""
echo ""
echo "======================= Minimal Display Manager With Single Application Kiosk Installer For Raspberry Pi ======================="
echo ""
echo ""

echo "====== Running Pre-Installation Checks ======"
echo ""

# Verify that the internet is reachable and DNS resolution is working
if ! ping -q -c 1 -W 1 google.com >/dev/null; then
    echo "The internet is not reachable. Please check your network connection and try again."
    exit 1
fi

# Verify that the configured username exists
if ! id -u $USERNAME &>/dev/null; then
    echo "The configured username '$USERNAME' does not exist. Either change this user to match yours, or create the user and try again. Try running from `sudo su` as root as well."
    echo ""
    exit 1
fi

# Verify that the *.deb package is here in this directory with the script, otherwise alert the user they need to build it and put it here next to script
if [ ! -f /home/$USERNAME/*.deb ]; then
    echo "The application .deb package is not in the home directory. Please build the application on another Pi/device and copy the .deb package to this Pi before running this script."
    echo ""
    exit 1
fi

echo "Pre-installation checks passed. Proceeding with installation..."
echo ""

echo ""
echo "====== Performing System Update ======"
echo ""

apt update && apt upgrade -y

echo ""
echo "OS updated."
echo ""

echo ""
echo "====== Installing APT Packages ======"
echo ""

apt install vnstat neofetch btop git wavemon -y

echo ""
echo "APT packages installed."
echo ""

echo ""
echo "====== Installing Application .deb Package ======"
echo ""

# Install the required dependencies
apt install trash-cli libglib2.0-bin -y

dpkg -i /home/$USERNAME/*.deb

echo ""
echo "Application .deb package installed."
echo ""

echo ""
echo "====== Configure Display Driver and Touch Screen for 3.5 TFT ======"
echo ""

# AIGHT, now let's install and configure the display and touch capabilities, assuming a 3.5" SPI display, adjust as needed for others (LCD-Show has multiple versions of the setup scripts)
cd /home/$USERNAME

git clone https://github.com/goodtft/LCD-show.git
chmod -R 755 LCD-show
cd LCD-show

# Remove the "sudo reboot" from the end of the LCD35-show file to prevent the pi from rebooting after this part
sed -i -e "s/sudo reboot//" LCD35-show

# Also remove the echo "reboot now" line
sed -i -e "s/echo \"reboot now\"//" LCD35-show

./LCD35-show

cd /home/$USERNAME

# if needed, rotate:
# cd LCD-show/
# sudo ./rotate.sh 90

# Install the calibration tool
cp LCD-show/xinput-calibrator_0.7.5-1_armhf.deb /home/$USERNAME

# To run the calibration tool:
# DISPLAY=:0.0 xinput_calibrator

# Enable multiarch support if not on ARMHF system
if [ "$(dpkg --print-architecture)" != "armhf" ]; then
  dpkg --add-architecture armhf
  apt update
fi

# Install the dependencies for the calibration tool
apt install libc6:armhf libgcc-s1:armhf libstdc++6:armhf libx11-6:armhf libxext6:armhf libxi6:armhf -y

# Install the calibration tool
dpkg -i xinput-calibrator_0.7.5-1_armhf.deb

# Correct any missing dependencies or issues
apt install -f -y

# Create calibration file
# This preset should work for the 3.5" display out of the box, even pre-calibrated!
# You may need to run the calibration tool again for yours, the calibration tool will output what to put in this file)
echo 'Section "InputClass"
        Identifier "calibration"
        MatchProduct "ADS7846 Touchscreen"
        Option "Calibration" "2715 2684 2979 2964"
        Option "SwapAxes" "0"
EndSection' | tee /etc/X11/xorg.conf.d/99-calibration.conf > /dev/null

# Now set a higher speed for the SPI connection to the display for improved performance and refresh rate
# Replace dtoverlay=tft35a:rotate=90 with dtoverlay=tft35a:rotate=90,speed=24000000,fps=60

# NOTE: 24000000 is ideal and seems to work on higher-end pi's like the pi4/5, but seems to cause artifacting on the pi3 and down. 16000000 seems to work fine on the pi3.
# if you want best of the best and have a pi 4/5, you can try 24000000

# Prompt the user to choose the SPI speed
echo ""
echo "You can choose between two SPI speeds for the display:"
echo "1) 16MHz - This is the default speed and is most compatible with most Raspberry Pi boards, including older models."
echo "2) 24MHz - This is faster and can improve performance, but it typically only works reliably on newer, higher-end Raspberry Pi boards like the Pi 4 or Pi 5. On older boards, it may cause visual artifacts."
echo ""
read -p "Enter 1 for default (most compatible) or 2 for faster (Pi4/Pi5 recommended): " choice

if [ "$choice" = "2" ]; then
    speed="24000000"
    echo "You selected the faster speed (24MHz). This may not work well on older boards."
else
    speed="16000000"
    echo "You selected the default speed (16MHz), which should be compatible with most boards."
fi

# Prompt the user to enter their rotation angle
echo ""
echo "Please enter the rotation angle for your display."
echo "Hint: GPIO header towards top should be 90, and GPIO towards bottom should be 270."
read -p "Enter rotation angle (90, 180, 270, etc.): " rotation_angle

# If the line already exists in config.txt, modify it. Otherwise, add it.
if grep -q "dtoverlay=tft35a:rotate=" /boot/firmware/config.txt; then
    sed -i "s|dtoverlay=tft35a:rotate=.*|dtoverlay=tft35a:rotate=$rotation_angle,speed=$speed,fps=60|" /boot/firmware/config.txt
else
    echo "dtoverlay=tft35a:rotate=$rotation_angle,speed=$speed,fps=60" >> /boot/firmware/config.txt
fi

echo "SPI display settings applied to /boot/firmware/config.txt."

echo ""
echo "  ---- Display and touch screen components installed and configured. ----"
echo ""

echo ""
echo "====== Create .desktop File ======"
echo ""

cat <<EOL > /etc/xdg/autostart/gitlab-feed-autostart.desktop
#!/usr/bin/env xdg-open
# This is an autostart .desktop file for use in Gnome desktop to launch the app using the begin.sh shell script.
# This will launch the app in Gnome when the user logs in. (if automating, you may want to have an auto login user and configure the screen saver and sleep settings to never sleep)
# BE SURE TO TO CHANGE THE EXEC PATH BELOW TO THE BEGIN.SH SCRIPT LOCATION FOR YOUR SYSTEM
[Desktop Entry]
Version=1.0
Type=Application
Name=GitLabFeed
Terminal=false
Exec='/home/$USERNAME/begin.sh'
Icon=utilities-terminal
EOL

chmod +x /etc/xdg/autostart/gitlab-feed-autostart.desktop

echo ".desktop file created and made executable."
echo ""

echo ""
echo "====== Create Begin.sh ======"
echo ""

cat <<EOL > /home/$USERNAME/begin.sh
#!/bin/bash
# This is a shell script used to start the program, can be called on OS startup to auto start the program
cd /home/$USERNAME/
# Start the application (deb package installed by the script)
gitlab-activity-display
EOL

chmod +x /home/$USERNAME/begin.sh

echo "begin.sh script created and made executable."
echo ""

echo ""
echo "====== Configure No Sleep, No Screensaver, and Auto-Login User ======"
echo ""

# Disable screen blanking
cat <<EOL > /etc/xdg/autostart/disable-screensaver.desktop
[Desktop Entry]
Type=Application
Name=Disable Screen Saver
Exec=xset s off
EOL

# Disable sleep
cat <<EOL > /etc/xdg/autostart/disable-sleep.desktop
[Desktop Entry]
Type=Application
Name=Disable Sleep
Exec=xset -dpms
EOL

# Set the user to auto-login
raspi-config nonint do_boot_behaviour B4

echo "No sleep, no screensaver, and auto-login configured."

echo ""
echo "====== Installation Complete! Rebooting... ======"
echo ""

# Reboot the system with a confirmation prompt
read -p "The installation is complete. Would you like to reboot now? (y/n): " reboot_choice
if [ "$reboot_choice" = "y" ]; then
    reboot
else
    echo "Got it. Please reboot the system to apply the changes as soon as you're ready to!"
fi
