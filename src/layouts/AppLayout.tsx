import { Outlet } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import RoleSwitcher from '../components/RoleSwitcher'

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#F5F8FC] pb-16">
      <Outlet />
      <MobileBottomNav />
      {import.meta.env.DEV && <RoleSwitcher />}
    </div>
  )
}
