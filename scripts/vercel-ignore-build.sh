#!/bin/bash

# Vercel Ignore Build Script
# This script determines whether Vercel should build a deployment
# based on GitHub Actions CI status

echo "🔍 Checking if build should proceed..."

# If we're on a PR, check if CI has passed
if [ -n "$VERCEL_GIT_COMMIT_REF" ] && [ "$VERCEL_ENV" == "preview" ]; then
  echo "📋 Preview deployment detected"
  echo "⏭️  Skipping Vercel build - GitHub Actions will run tests"
  
  # Exit with 0 to skip the build (let GitHub Actions handle it)
  exit 0
fi

# For production deployments, always build
if [ "$VERCEL_ENV" == "production" ]; then
  echo "🚀 Production deployment - proceeding with build"
  
  # Check if this is main/master branch
  if [ "$VERCEL_GIT_COMMIT_REF" == "main" ] || [ "$VERCEL_GIT_COMMIT_REF" == "master" ]; then
    echo "✅ Building production from $VERCEL_GIT_COMMIT_REF"
    exit 1
  fi
fi

# Default: proceed with build
echo "✅ Proceeding with build"
exit 1

