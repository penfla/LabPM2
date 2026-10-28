#!/bin/sh
# License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Flavio Pendolino
# https://polyformproject.org/licenses/noncommercial/1.0.0
# Start LabPM. The only setting is "dataDir" in labpm.config.json (or: ./start.sh --data /mnt/nas/labpm).
command -v node >/dev/null 2>&1 || { echo "Node.js 22.13 or newer is required: https://nodejs.org"; exit 1; }
cd "$(dirname "$0")" && exec node --no-warnings server/index.js "$@"
