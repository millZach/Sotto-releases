# Sotto releases

Installers, disk images, checksums and the auto-update feed for [Sotto](https://saysotto.com), the local voice dictation app for Windows and Apple silicon Macs.

The source repository is private. Download the newest release from the Releases page. Windows installs update themselves from this repository.

macOS builds are ad-hoc signed and not notarized: after installing, open Privacy & Security and choose Open Anyway, or run `xattr -dr com.apple.quarantine /Applications/Sotto.app`. Apple silicon only.

## The site

[saysotto.com](https://saysotto.com) is the `site/` folder here, published by GitHub Pages on every push to `main` that touches it. It is one HTML file with no build step. It bundles the Figtree typeface (Erik Kennedy, [SIL Open Font License 1.1](https://openfontlicense.org/)) in `site/fonts/`.
