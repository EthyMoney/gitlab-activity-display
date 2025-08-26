# gitlab-activity-display

RSS activity feed display app for a Pi and a 3.5" TFT display.

## Get It

```bash
git clone https://github.com/EthyMoney/gitlab-activity-display.git
sudo chown -R your_username:your_username gitlab-activity-display
cd gitlab-activity-display
```

## Build It

First, set your feed URL with a valid feed token in `config.js`. This get's bundled into the built app, so it needs to be correct before building.

```bash
rm -rf package-lock.json
npm i
sudo apt install rpm -y
sudo npm run make # also available is make-pi for x64 pi, or make-pi-32 for 32-bit pi
```

## Install It

```bash
sudo apt install trash-cli libglib2.0-bin -y
sudo dpkg -i /out/make/deb/<arch-here>/gitlab-activity-display_*.deb
```

## Run As Service

See `service-config.txt` for details on how to run the app as a service.

## Uninstall It

```bash
sudo apt remove --purge gitlab-activity-display -y
```
