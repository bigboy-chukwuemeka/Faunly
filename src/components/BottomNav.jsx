import { NavLink } from 'react-router-dom'
import { Home, Camera, PawPrint, Clock, User } from 'lucide-react'

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/identify', label: 'Identify', icon: Camera },
  { to: '/my-animals', label: 'My Animals', icon: PawPrint },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg)] border-t border-[var(--border)] flex justify-around py-2 pb-[env(safe-area-inset-bottom)]">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center text-xs gap-1 px-2 py-1 ${
              isActive ? 'text-[var(--nav-active)]' : 'text-[var(--nav-inactive)]'
            }`
          }
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
