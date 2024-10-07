#!/bin/bash

set -e

cd cli
deno compile --allow-env --allow-net --allow-read --allow-run --allow-write --target x86_64-pc-windows-msvc --output ../build/bbai.exe src/main.ts
cd ..

cd api
deno run --allow-read --allow-run --allow-write scripts/compile.ts --target x86_64-pc-windows-msvc --output ../build/bbai-api.exe
cd ..
