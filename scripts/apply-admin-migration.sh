#!/bin/bash

# Admin Dashboard Migration Script
# This script applies the database changes needed for the admin dashboard

set -e

echo "🔧 Babylon Admin Dashboard Migration"
echo "======================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it in your .env file or export it"
    exit 1
fi

echo "📋 This will add the following fields to the User table:"
echo "   - isAdmin (boolean, default: false)"
echo "   - isBanned (boolean, default: false)"
echo "   - bannedAt (timestamp, nullable)"
echo "   - bannedReason (text, nullable)"
echo "   - bannedBy (text, nullable)"
echo ""
echo "⚠️  WARNING: This will modify your database schema"
echo ""
read -p "Do you want to continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🚀 Applying migration..."

# Apply the migration using psql
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f prisma/migrations/add_admin_ban_fields.sql
    echo ""
    echo "✅ Migration applied successfully!"
else
    echo "❌ psql not found. Trying with Prisma..."
    bunx prisma db push --accept-data-loss
    echo ""
    echo "✅ Schema updated with Prisma!"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Grant admin privileges to a user:"
echo "      bun run scripts/manage-admin.ts grant <username-or-wallet>"
echo ""
echo "   2. Verify admin users:"
echo "      bun run scripts/manage-admin.ts list"
echo ""
echo "   3. Access the admin dashboard:"
echo "      Log in and click the Admin link in the sidebar"
echo ""
echo "✨ Admin dashboard is ready to use!"

