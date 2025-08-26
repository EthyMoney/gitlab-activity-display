# gitlab-activity-display

RSS activity feed display app for a Pi and a 3.5" TFT display.

## Build It

```bash
npm i
apt install rpm -y
npm run make # also available is make-pi for x64 pi, or make-pi-32 for 32-bit pi
```

## Install It

```bash
apt install trash-cli libglib2.0-bin -y
sudo dpkg -i /out/make/deb/<arch-here>/gitlab-activity-display_*.deb
```

## Run As Service

See `service-config.txt` for details on how to run the app as a service.

## Uninstall It

```bash
apt remove --purge gitlab-activity-display -y
```
