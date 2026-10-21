# Sotto releases

Installers, disk images, packages, checksums and update feeds for [Sotto](https://saysotto.com), the dictation app and one window for your coding agents, on Windows, Apple silicon Macs and Linux.

The source is [millZach/Sotto](https://github.com/millZach/Sotto). Download the newest release from the Releases page, or from saysotto.com, which offers the build for your system.

- **Windows** 10 or 11, x64: run `Sotto-Setup-<version>.exe`. The installer isn't code-signed, so SmartScreen may ask first: choose More info, then Run anyway. Windows installs update themselves from this repository.
- **macOS** 12 or newer, Apple silicon only: open `Sotto-<version>-arm64.dmg` and drag Sotto into Applications. Stable is ad-hoc signed and not notarized: after installing, open Privacy & Security and choose Open Anyway, or run `xattr -dr com.apple.quarantine /Applications/Sotto.app`. It doesn't update itself.
- **Linux**, x64, checked on Omarchy: install `sotto-bin-<version>-1-x86_64.pkg.tar.zst` with `sudo pacman -U`, or unpack `Sotto-<version>-linux-x64.tar.gz`. There is no updater; install each new package the same way.

The `Sotto-host-*` archives are for Sotto hosts on other machines, which update from them when the desktop asks.

## Sotto Owl

Owl is the preview track: a newer build, published daily when anything has merged, with features still being tried out. Owl releases are pre-releases with `-owl.` in their tag; their files start `Sotto-Owl-`, except the Linux package, `sotto-bin-<version>owl…`. An Owl installs in place of Stable and keeps your settings and threads. The Mac Owl is signed and notarized, so it opens like any other app. Owl updates itself on Windows and Mac; on Linux, install each new Owl with `sudo pacman -U`. To go back, install Stable over it.

## The site

[saysotto.com](https://saysotto.com) is the `site/` folder here, published by GitHub Pages on every push to `main` that touches it and on every published release, Owl included. It is one HTML file with no build step. On each deploy, `.github/workflows/deploy-site.yml` points every download link at the newest stable or Owl file for its system; a build its release lacks keeps the link on the releases page. The page reads the visitor's system from the browser and offers its Stable and Owl builds. It bundles the Figtree typeface (Erik Kennedy, [SIL Open Font License 1.1](https://openfontlicense.org/)) in `site/fonts/`.
