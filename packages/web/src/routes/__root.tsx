import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AppSidebar } from "@/components/app-sidebar"
import { RouteBreadcrumb } from "@/components/route-breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"

const RootLayout = () => (
    <>
        <SidebarProvider className='h-svh overflow-hidden'>
            <AppSidebar />
            <SidebarInset className="min-h-0">
                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <RouteBreadcrumb />
                    </div>
                </header>
                <div className="flex flex-1 min-h-0">
                    <div className="flex-1 min-h-0 overflow-auto">
                        <Outlet />
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
        <TanStackRouterDevtools />
    </>
)

export const Route = createRootRoute({ component: RootLayout })