# Architecture overview assets

`architecture-overview.svg` is an original diagram with embedded, unmodified AWS service SVG icons. `architecture-overview.png` is its raster export. The SVG is self-contained and does not fetch external assets.

- Publisher: Amazon Web Services.
- Source: https://aws.amazon.com/architecture/icons/
- Package: July 31, 2026 release.
- Download: https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip
- AWS permits use of these assets to create architecture diagrams, as described on the source page. AWS retains ownership of its icons. Their use does not imply endorsement.

To rebuild, extract the package's relevant 64px service SVGs into a directory and run:

```text
node scripts/build-streaming-overview.mjs <icon-directory>
```

The PNG was rendered from the SVG with `@resvg/resvg-js`, using system fonts, at 1800 × 1900 pixels. The renderer is a generation-time tool, not an application dependency.
