#!/usr/bin/env bash
# Test, build and deploy Abeggi, then write the addresses to
# contracts/deployments/<network>.json and web/.env.local.
#
#   ./deploy.sh                          # testnet, native XLM
#   TOKEN_ASSET=USDC:<ISSUER> ./deploy.sh
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-ada}"
TOKEN_ASSET="${TOKEN_ASSET:-native}"
SYMBOL="${TOKEN_SYMBOL:-$([ "$TOKEN_ASSET" = native ] && echo XLM || echo "${TOKEN_ASSET%%:*}")}"

HERE="$(cd "$(dirname "$0")" && pwd)"
CRATE="$HERE/abeggi"
WASM="$CRATE/target/wasm32v1-none/release/abeggi.wasm"

for bin in cargo stellar; do
  command -v "$bin" >/dev/null || { echo "missing: $bin" >&2; exit 1; }
done

case "$NETWORK" in
  testnet) RPC="https://soroban-testnet.stellar.org"; PASS="Test SDF Network ; September 2015" ;;
  mainnet) RPC="${RPC_URL:?set RPC_URL for mainnet}"; PASS="Public Global Stellar Network ; September 2015" ;;
  *) echo "unsupported NETWORK: $NETWORK" >&2; exit 1 ;;
esac

if ! stellar keys address "$SOURCE" >/dev/null 2>&1; then
  [ "$NETWORK" = testnet ] || { echo "create + fund key '$SOURCE' first" >&2; exit 1; }
  stellar keys generate "$SOURCE" --network "$NETWORK" --fund
fi

(cd "$CRATE" && cargo test && stellar contract build)

TOKEN_ID="$(stellar contract id asset --asset "$TOKEN_ASSET" --network "$NETWORK")"
CONTRACT_ID="$(stellar contract deploy --wasm "$WASM" --source "$SOURCE" --network "$NETWORK" \
  -- --token "$TOKEN_ID" | tail -n1)"

mkdir -p "$HERE/deployments"
cat > "$HERE/deployments/$NETWORK.json" <<JSON
{ "network": "$NETWORK", "contractId": "$CONTRACT_ID", "tokenId": "$TOKEN_ID", "tokenSymbol": "$SYMBOL" }
JSON

cat > "$HERE/../web/.env.local" <<ENV
NEXT_PUBLIC_STELLAR_NETWORK=$NETWORK
NEXT_PUBLIC_RPC_URL=$RPC
NEXT_PUBLIC_NETWORK_PASSPHRASE="$PASS"
NEXT_PUBLIC_ABEGGI_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_TOKEN_CONTRACT_ID=$TOKEN_ID
NEXT_PUBLIC_TOKEN_SYMBOL=$SYMBOL
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV

echo "deployed $CONTRACT_ID (token $TOKEN_ID)"
