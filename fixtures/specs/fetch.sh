#!/usr/bin/env bash
# Downloads the fixture specs that are not committed (too large, or licence unclear) into
# fixtures/specs/large/, which is gitignored, and verifies each against a pinned SHA-256.
#
# Usage: fixtures/specs/fetch.sh
#
# Every URL names a commit SHA, so the bytes cannot change. A hash mismatch is an error: the bad
# file is deleted and the script exits non-zero. To move a pin, change the URL and the hash together
# and update README.md; say why in the commit.
#
# TLS verification is never disabled. Behind a proxy, set HTTPS_PROXY and the CA bundle as usual.
set -euo pipefail

dest="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/large"
raw="https://raw.githubusercontent.com"

# name | sha256 | url
specs="
stripe.json|7cff4cc46d0654101a36a3302f7544640f5f73e4f3cad6f264f0e23c19fa1776|$raw/stripe/openapi/a8f2a259ab96578fa3475562e91614d420283530/openapi/spec3.json
github-ghes.json|4033d3bb4df0ecc0326c7e67f725860d54c027afb3e722c37ae03c4e75918920|$raw/github/rest-api-description/d560905bbf50d79e40d6a006ce2e5834cfd86a31/descriptions/ghes-3.9/ghes-3.9.json
github-api-3.1.json|815458acec192fa555b3d2ae66c7e413c165ce28819a551da831fffcd937b62f|$raw/github/rest-api-description/d560905bbf50d79e40d6a006ce2e5834cfd86a31/descriptions-next/api.github.com/api.github.com.json
clubhouse.yaml|1a61f68c44c589066b80770b7c66af7f17f4018edb7a1583a37e44ab04af59af|$raw/APIs-guru/openapi-directory/f04b8d0bcd39c52e1cf3ad7a5fe744709832ae49/APIs/clubhouseapi.com/1/openapi.yaml
"

if command -v sha256sum >/dev/null 2>&1; then
  hash_of() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  hash_of() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  echo "fetch.sh: need sha256sum or shasum" >&2
  exit 2
fi

mkdir -p "$dest"
failed=0

while IFS='|' read -r name want url; do
  [ -n "$name" ] || continue
  out="$dest/$name"

  if [ -f "$out" ] && [ "$(hash_of "$out")" = "$want" ]; then
    echo "ok       $name (already present)"
    continue
  fi

  tmp="$out.part"
  rm -f "$tmp"
  if ! curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
      --output "$tmp" "$url"; then
    rm -f "$tmp"
    echo "FAILED   $name: download failed: $url" >&2
    failed=1
    continue
  fi

  got="$(hash_of "$tmp")"
  if [ "$got" != "$want" ]; then
    rm -f "$tmp" "$out"
    echo "MISMATCH $name" >&2
    echo "         expected $want" >&2
    echo "         got      $got" >&2
    echo "         from     $url" >&2
    failed=1
    continue
  fi

  mv -f "$tmp" "$out"
  echo "ok       $name (downloaded)"
done <<<"$specs"

if [ "$failed" -ne 0 ]; then
  echo "fetch.sh: one or more specs failed; see above. Nothing with a bad hash was kept." >&2
  exit 1
fi
echo "All specs present and verified in $dest"
