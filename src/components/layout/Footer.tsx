'use client'

import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Company Info */}
          <div className="text-sm text-muted-foreground">
            © {currentYear} Eliza Labs, Inc. All rights reserved.
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="https://docs.babylon.market/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="https://docs.babylon.market/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/settings?tab=privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Settings
            </Link>
            <a
              href="mailto:support@elizas.com"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>

          {/* Additional Info */}
          <div className="text-xs text-muted-foreground">
            Beta · Entertainment Only
          </div>
        </div>
      </div>
    </footer>
  )
}

