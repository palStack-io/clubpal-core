import { createContext, useContext, useState, useCallback } from 'react'
import useMediaQuery from '../hooks/useMediaQuery'

const MobileNavContext = createContext({
  isMobile: false,
  sidebarOpen: false,
  openSidebar: () => {},
  closeSidebar: () => {},
})

export function MobileNavProvider({ children }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <MobileNavContext.Provider value={{ isMobile, sidebarOpen, openSidebar, closeSidebar }}>
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav() {
  return useContext(MobileNavContext)
}
