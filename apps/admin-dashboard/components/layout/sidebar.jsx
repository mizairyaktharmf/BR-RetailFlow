"use client"

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Globe,
  MapPin,
  Building2,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Menu,
  X,
  Cake,
  IceCream
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['supreme_admin', 'super_admin', 'admin'] },
  { name: 'Territories', href: '/dashboard/territories', icon: Globe, roles: ['supreme_admin'] },
  { name: 'Area Managers', href: '/dashboard/areas', icon: MapPin, roles: ['supreme_admin', 'super_admin'] },
  { name: 'Branches', href: '/dashboard/branches', icon: Building2, roles: ['supreme_admin', 'super_admin', 'admin'] },
  { name: 'Users', href: '/dashboard/users', icon: Users, roles: ['supreme_admin', 'super_admin', 'admin'] },
  { name: 'Ice Cream Flavors', href: '/dashboard/flavors', icon: IceCream, roles: ['supreme_admin'] },
  { name: 'Cake Products', href: '/dashboard/cake-products', icon: Cake, roles: ['supreme_admin'] },
]

const roleLabels = {
  supreme_admin: 'HQ',
  super_admin: 'TM',
  admin: 'AM',
}

const roleColors = {
  supreme_admin: 'bg-purple-500/20 text-purple-300',
  super_admin: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-cyan-500/20 text-cyan-300',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('br_admin_token')
    localStorage.removeItem('br_admin_user')
    localStorage.removeItem('br_demo_mode')
    router.push('/login')
  }

  const filteredNavigation = navigation.filter(item =>
    user && item.roles.includes(user.role)
  )

  const SidebarContent = ({ mobile = false }) => (
    <div className={cn(
      "flex flex-col h-full bg-slate-900 border-r border-slate-700",
      mobile ? "w-64" : collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-slate-700",
        collapsed && !mobile ? "justify-center" : "gap-3"
      )}>
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 p-[2px] flex-shrink-0">
          <div className="w-full h-full rounded-lg bg-slate-900 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
        </div>
        {(!collapsed || mobile) && (
          <div>
            <h1 className="font-bold text-white text-sm">BR-RetailFlow</h1>
            <p className="text-[10px] text-slate-500">Admin Dashboard</p>
          </div>
        )}
      </div>

      {/* User Info - clickable to profile */}
      {user && (!collapsed || mobile) && (
        <button
          onClick={() => {
            router.push('/dashboard/profile')
            if (mobile) setMobileOpen(false)
          }}
          className="w-full p-4 border-b border-slate-700 hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-medium text-sm">
              {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", roleColors[user.role])}>
                  {roleLabels[user.role]}
                </span>
                {user.territory_name && (
                  <span className="text-[10px] text-slate-500 truncate">{user.territory_name}</span>
                )}
              </div>
            </div>
          </div>
        </button>
      )}
      {user && collapsed && !mobile && (
        <button
          onClick={() => router.push('/dashboard/profile')}
          className="w-full p-3 border-b border-slate-700 hover:bg-slate-800/50 transition-colors flex justify-center"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-medium text-xs">
            {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AD'}
          </div>
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <button
              key={item.name}
              onClick={() => {
                router.push(item.href)
                if (mobile) setMobileOpen(false)
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-slate-400 hover:text-white hover:bg-slate-800",
                collapsed && !mobile && "justify-center px-2"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-purple-400")} />
              {(!collapsed || mobile) && item.name}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all",
            collapsed && !mobile && "justify-center px-2"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || mobile) && "Logout"}
        </button>

        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && "Collapse"}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <SidebarContent />
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white text-sm">BR-RetailFlow</span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0">
            <SidebarContent mobile />
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  )
}
