# Security Policy

## Reporting a vulnerability

Do not open a public GitHub issue for a security vulnerability in Oppvera Watch.

Email the maintainer with a description, steps to reproduce, and the impact. The Oppvera Watch contact is Craig Oda via the [oppvera/oppvera-watch](https://github.com/oppvera/oppvera-watch) repository.

## What this app stores

Provider logins (Playwright `storageState`) stay on the Mac under `~/Library/Application Support/Oppvera Watch/`. Watch does not upload cookies, `storageState`, or passwords.

Answer text and citations sync to the paired Oppvera campaign over HTTPS with a device token. Scoring uses Oppvera's hosted keys, not keys on the laptop.

The `.dmg` is ad-hoc signed until a Developer ID is available. Download it from Oppvera or the GitHub Release named in the app docs, not from an unknown mirror.
