#!/bin/bash
set -e

# Database setup script for CI environments
# This script ensures database is properly initialized with all migrations

echo "🔧 Setting up test database..."

# Export database URLs
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/test_db}"
export DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"

echo "📊 Database URL: ${DATABASE_URL}"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
bunx prisma generate

# Use prisma migrate reset which properly handles schema recreation
echo "🗄️ Resetting database and applying all migrations..."
if [ "$SKIP_SEED" == "true" ]; then
  bunx prisma migrate reset --force --skip-seed --skip-generate || {
    echo "❌ Migration reset failed. Attempting manual migration..."
    bunx prisma migrate deploy || {
      echo "❌ Migration deploy also failed"
      exit 1
    }
  }
else
  bunx prisma migrate reset --force --skip-generate || {
    echo "❌ Migration reset failed. Attempting manual migration..."
    bunx prisma migrate deploy || {
      echo "❌ Migration deploy also failed"
      exit 1
    }
  }
fi

# Verify critical tables exist
echo "🔍 Verifying database tables..."
bunx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('User', 'Post', 'Comment', 'Actor', 'Pool', 'Question')
ORDER BY tablename;
EOF

# List ALL tables to debug what's being created
echo "📋 Listing all tables created:"
bunx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
EOF

# Count tables to ensure migration succeeded
TABLE_COUNT=$(bunx prisma db execute --url="$DATABASE_URL" --stdin <<< "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | grep -oE '[0-9]+' | tail -1)
echo "✅ Found $TABLE_COUNT tables in database"

if [ "$TABLE_COUNT" -lt "15" ]; then
  echo "❌ ERROR: Expected at least 15 tables but found only $TABLE_COUNT"
  echo "Migration may have failed. Checking migration status..."
  bunx prisma migrate status

  # Check specifically for critical tables
  echo "Checking for critical tables..."
  for table in User Post Comment Actor Pool Question Market Position; do
    EXISTS=$(bunx prisma db execute --url="$DATABASE_URL" --stdin <<< "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table';" | grep -oE '[0-9]+' | tail -1 || echo "0")
    if [ "$EXISTS" -eq "0" ]; then
      echo "❌ CRITICAL: $table table does not exist!"
    else
      echo "✓ $table table exists"
    fi
  done

  # Don't exit if we have core tables
  CORE_TABLES=$(bunx prisma db execute --url="$DATABASE_URL" --stdin <<< "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('User', 'Post', 'Comment');" | grep -oE '[0-9]+' | tail -1 || echo "0")
  if [ "$CORE_TABLES" -lt "3" ]; then
    echo "❌ FATAL: Core tables (User, Post, Comment) are missing. Cannot continue."
    exit 1
  fi
  echo "⚠️  WARNING: Not all tables created, but core tables exist. Continuing..."
else
  echo "✅ Found $TABLE_COUNT tables in database"
fi

# Run seed if not skipped
if [ "$SKIP_SEED" != "true" ]; then
  echo "🌱 Seeding database..."
  bunx prisma db seed
fi

echo "✅ Database setup complete!"