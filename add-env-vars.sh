#!/bin/bash
# Add all environment variables from .env.local to Vercel production

TOKEN="nozE6KPqG1OOwxAwt0KfcDA3"

# Read .env.local and add each variable
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  if [[ $key =~ ^#.* ]] || [[ -z "$key" ]]; then
    continue
  fi

  # Remove any quotes from value
  value=$(echo "$value" | sed 's/^"//;s/"$//')

  echo "Adding $key to Vercel production..."
  echo "$value" | vercel env add "$key" production --token "$TOKEN" --yes 2>&1 | grep -v "Vercel CLI"
done < .env.local

echo "Done! All environment variables added."
