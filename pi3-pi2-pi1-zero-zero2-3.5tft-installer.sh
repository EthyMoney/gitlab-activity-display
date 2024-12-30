#!/bin/bash

# This will set up a new fresh pi running pi os lite for booting into minimal display manager and running the app
# This will also install and configure the SPI display and touch screen drivers

# THIS SCRIPT ONLY WORKS ON NEWER PI MODELS LIKE THE PI 4 AND PI 5, AND WITH 64-BIT PI OS LITE
# Use the other script for older models!

# Requirements
# A Raspberry Pi 4 or Pi 5, running Raspberry Pi OS Lite Bookworm 64-bit
# A 3.5" SPI display with touch screen (tested with a generic one, but should work with most)
# A GitLab feed URL to display activity from
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

apt install vnstat neofetch git lightdm compton xserver-xorg xserver-xorg-input-all xinit x11-xserver-utils xserver-xorg-core xserver-xorg-video-all openbox npm wavemon -y

echo ""
echo "====== Installing Updated Node.js and NPM + Global Packages ======"
echo ""

npm i n -g
n lts
hash -r
npm i -g npm
npm i -g npm-check-updates pm2 yarn
hash -r

echo ""
echo "Node.js, NPM, and global packages installed."
echo ""

echo ""
echo "====== Configuring OpenBox ======"
echo ""

# Create the autostart file at /home/$USERNAME/.config/openbox/autostart
mkdir -p /home/$USERNAME/.config/openbox
cat << EOF > /home/$USERNAME/.config/openbox/autostart
#!/bin/bash

# Disable screen saver and power management
xset s off
xset -dpms
xset s noblank

# Compton for display performance and vsync
compton -b &

# Start the application (deb package installed by the script)
gitlab-activity-display &
EOF

echo "Wrote autostart file."

# Ensure the script is executable
chmod +x /home/$USERNAME/.config/openbox/autostart

# Create xsession file to launch openbox
echo "#!/bin/bash" > /home/$USERNAME/.xsession
echo "xset s off" >> /home/$USERNAME/.xsession
echo "xset -dpms" >> /home/$USERNAME/.xsession
echo "xset s noblank" >> /home/$USERNAME/.xsession
echo "exec openbox-session" >> /home/$USERNAME/.xsession

# Make the .xsession file executable
chmod +x /home/$USERNAME/.xsession

# Change the owner of the .xsession file to the user
chown $USERNAME:$USERNAME /home/$USERNAME/.xsession

echo "Set up .xsession file."

echo ""
echo "Openbox configured."
echo ""

echo ""
echo "====== Processing Pi Configuration Special Triggers ======"
echo ""

sed -i 's/console=tty1/console=tty3/' /boot/firmware/cmdline.txt
sed -i 's/$/ quiet splash plymouth.ignore-serial-consoles logo.nologo loglevel=3/' /boot/firmware/cmdline.txt

raspi-config nonint do_boot_splash 0

# Config adjustments for display performance using compton
echo -e "vsync = true;\nbackend = \"glx\";\nfading = false;\nshadow-exclude = [ \"name = 'cursor'\" ];" >/home/$USERNAME/.config/compton.conf

# Ensure the user owns their config files
chown -R $USERNAME:$USERNAME /home/$USERNAME/.config

# Update initramfs
update-initramfs -u

echo ""
echo "Configuration triggers complete."
echo ""

echo ""
echo "Configuration complete."
echo ""

echo ""
echo "====== Installing and Configuring Display and Touch Screen ======"
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

# Detect Raspberry Pi version
MODEL=$(cat /proc/device-tree/model)

if [[ $MODEL == *"Raspberry Pi 4"* || $MODEL == *"Raspberry Pi 5"* ]]; then
    echo "Detected Raspberry Pi 4 or 5. No additional configuration required for Xorg."
else
    echo "Detected older Raspberry Pi model. Applying Xorg configuration for SPI display."

    # Create Xorg configuration for SPI display
    mkdir -p /etc/X11/xorg.conf.d

    cat << EOF > /etc/X11/xorg.conf.d/99-fbdev.conf
Section "Device"
    Identifier "SPI Display"
    Driver "fbdev"
    Option "fbdev" "/dev/fb1"
EndSection

Section "Screen"
    Identifier "Default Screen"
    Device "SPI Display"
    Monitor "Primary Monitor"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Modes "480x320"
    EndSubSection
EndSection

Section "Monitor"
    Identifier "Primary Monitor"
EndSection
EOF

    echo "Xorg configuration for SPI display has been created."

    # Ensure correct permissions for framebuffer device
    chmod a+rw /dev/fb1
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
echo "====== Installing The Application ======"
echo ""

# Clone the application
cd /home/$USERNAME
git clone https://github.com/EthyMoney/gitlab-activity-display.git

# Install the application dependencies
cd /home/$USERNAME/gitlab-activity-display

# this is a workaround for a bug in npm optional dependencies that causes a broken electron-forge install
rm -rf package-lock.json

# Increase swap size to 2GB to prevent out of memory errors during build (especially needed on 512MB RAM models) - the electron make command is gonna slam the RAM...
sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile

# Activate the new swap size
systemctl restart dphys-swapfile

# install yarn globally since electron forge requires it
node --max-old-space-size=8000 $(which npm) install -g yarn

node --max-old-space-size=8000 $(which npm) install

# Install RPM for electron make build
apt install rpm -y

# Set username as the owner of the application files
chown -R $USERNAME:$USERNAME /home/$USERNAME/gitlab-activity-display

# rename config file
mv /home/$USERNAME/gitlab-activity-display/config.json.template /home/$USERNAME/gitlab-activity-display/config.json

# Prompt the user to enter their GitLab feed URL
echo ""
echo "Here's what an example feed URL looks like, including the feed token that you can find on the bottom your personal access tokens page. The feed URL is found on your activity pages:"
echo "https://gitlab.yourcompany.com/dashboard/projects.atom?feed_token=your_feed_token_here"
echo ""
read -p "Enter your GitLab feed URL including the feed token: " gitlabFeedUrl

# Replace the placeholder text in the config.json file
sed -i "s|replace me!|$gitlabFeedUrl|g" /home/$USERNAME/gitlab-activity-display/config.json

# Build the app (will be arm64 for assumably a Pi running 64-bit Pi OS)
node --max-old-space-size=8000 $(which npm) run make-pi-32

# Install the required dependencies
apt install trash-cli libglib2.0-bin -y

# Install the built application deb file (note: this might complain about some missing KDE dependencies, but it's fine)
dpkg -i /home/$USERNAME/gitlab-activity-display/out/make/deb/armhf/gitlab-activity-display_*_armhf.deb

# Undo the swap size change
sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=512/' /etc/dphys-swapfile

# Activate the original swap size
systemctl restart dphys-swapfiles

# the autostart file for openbox is configured to start this built app on boot, we're done!

echo ""
echo "  ---- Application Installed. ----"
echo ""

echo ""
echo "====== Configuring  Autologin ======"
echo ""

sudo raspi-config nonint do_boot_behaviour B4

echo ""
echo "Autologin configured."
echo ""

# Update initramfs (again, just in case)
update-initramfs -u

# Now prompt the user to reboot with a default of yes
echo ""
echo ""
read -p "All done! Would you like to reboot now? (You'll need to before this all works anyways) [Y/n] " -n 1 -r
REPLY=${REPLY:-Y}

if [[ $REPLY =~ ^[Yy]$ ]]; then
  reboot
fi

# End of script

# For the record, the display setup stuff came from here:
# https://cdn.sparkfun.com/assets/4/c/2/0/8/User_Guide_For_3.5_inch_LCD.pdf

# And the display manager and auto-start stuff came from here:
# https://raspberrypi.stackexchange.com/questions/57128/how-to-boot-into-own-python-script-gui-only/57560#57560
# Be sure to look at the footnote for raspbian lite, that's what I usually use
