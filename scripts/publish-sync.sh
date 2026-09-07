#!/usr/bin/env bash
# The app and plugin now live in one repository. Never mirror either checkout.
set -euo pipefail
printf '%s\n' 'persona-lab: publish-sync is retired. Edit this repository directly; use its release workflows to publish.' >&2
exit 1
