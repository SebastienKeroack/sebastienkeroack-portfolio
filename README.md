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

On Linux, run as an unprivileged user with Python 3.11 or later, Skopeo with
digest-preserving OCI copy support, and umoci with rootless unpack support on
`PATH`. Supply a local containers/image policy that permits Skopeo's copy.
Set `manifest_digest` to the expected `sha256:…` manifest digest recorded by the
build.

```sh
python3 ci/verify_static_image.py /path/to/static.oci.tar \
  --expected-manifest-digest "$manifest_digest" \
  --policy /etc/containers/policy.json
```

The offline check accepts plain OCI archives with uncompressed or gzip-compressed
OCI layers. It compares the image's Nginx configuration to `ci/nginx/static.conf`,
`ci/nginx/http.conf`, and `ci/nginx/server.conf` from the verifier's checkout.
It prints JSON with the archive SHA-256, manifest digest, platform, and hashes of
the pages, referenced assets, and Nginx configuration it checked. Run the fixture
tests with `python3 -B -m unittest -v ci.test_verify_static_image`.

## License

This project is licensed under the [Apache License 2.0](LICENSE), allowing for open-source use, modification, and distribution.
