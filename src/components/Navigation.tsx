'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const links = [
  { href: '/dashboard', label: '📊 Dashboard' },
  { href: '/drafts', label: '📝 Draft Queue' },
  { href: '/calendar', label: '📅 Calendar' },
  { href: '/published', label: '✅ Published' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-liberty-blue text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦅</span>
            <span className="font-bold text-lg tracking-wide">
              Liberty Quest Content Engine
            </span>
          </div>
          <div className="flex items-center gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'px-4 py-2 rounded text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-liberty-red text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
