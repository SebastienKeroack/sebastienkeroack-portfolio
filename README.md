# My portfolio

This project contains the source code for my portfolio, designed to be hosted on any server compatible with PHP and Apache (or equivalent).

The website features dynamic content localization, enabling seamless transitions between multiple languages, such as English and French. Its modular and scalable architecture ensures easy maintenance and extensibility. The development stack includes HTML and CSS for visual rendering, JavaScript for client-side interactions, and PHP for server-side logic.

Key features include dynamic language loading, adaptive theme integration (light/dark mode), social media meta tag optimization, secure forms with reCAPTCHA v2, and a structured architecture for efficiently managing both static and dynamic content.

It is accessible at [sebastienkeroack.com](https://sebastienkeroack.com).

## Table of Contents

- [Installation](#Installation)
  - [Windows](https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/docs/windows/LOCAL-DEVELOPMENT.md 'Installation on Windows for local development')
- [Features](#Features)
- [Verify a static image archive](#verify-a-static-image-archive)
- [License](#License)

## Features

- Multilingual support with dynamic language switching (e.g., English, French)
- Theme integration based on system preferences (light/dark mode)
- Social media meta tag support for enhanced sharing
- Modular and scalable architecture
- Backend: PHP; Frontend: CSS, HTML/SHTML and JavaScript
- reCAPTCHA v2 integration for the contact form to enhance security

## Verify a static image archive

The static Bake target exports one OCI image index for `linux/amd64` and
`linux/arm64`. The build workflow compares the index digest across two builds,
including a rebuild without cache, and logs the digest before uploading
`static.oci.tar`.

On Linux, run as an unprivileged user with Python 3.11 or later, Skopeo with
digest-preserving OCI copy support, and umoci with rootless unpack support on
`PATH`. Supply a local containers/image policy that permits Skopeo's copy and
use the index digest recorded by the build.

```sh
python3 ci/verify_static_image.py /path/to/static.oci.tar \
  --expected-index-digest "$index_digest" \
  --policy /etc/containers/policy.json
```

The offline check verifies the index and each child before checking the
effective filesystem, static pages, referenced assets, Nginx configuration, and
absence of PHP. It reports the archive SHA-256, the index digest, and the
manifest and verified file hashes for each platform. Earlier single-manifest
amd64 archives use `--expected-manifest-digest` and retain their original JSON
format. These checks support uncompressed and gzip-compressed OCI layers. Run
the fixtures with `python3 -B -m unittest -v ci.test_verify_static_image`.

## License

This project is licensed under the [Apache License 2.0](LICENSE), allowing for open-source use, modification, and distribution.
