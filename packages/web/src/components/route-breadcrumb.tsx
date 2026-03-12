import { useLocation } from '@tanstack/react-router'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from 'react'

export function RouteBreadcrumb() {
    const location = useLocation()
    const pathname = location.pathname

    const breadcrumbs = pathname.split('/').filter(Boolean)

    const getBreadcrumbTitle = (path: string, isLast: boolean) => {
        const titles: Record<string, string> = {
            'chat': '聊天',
            'control': '控制',
            'overview': '概览',
            'channels': '频道',
            'instances': '实例',
            'sessions': '会话',
            'usage': '使用情况',
            'cron': '定时任务',
            'proxy': '代理',
            'skills': '技能',
            'nodes': '节点',
            'settings': '设置',
            'config': '配置',
            'debug': '调试',
            'logs': '日志',
        }

        return titles[path] || path
    }

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {/* <BreadcrumbItem>
                    <BreadcrumbLink to="/">首页</BreadcrumbLink>
                </BreadcrumbItem> */}
                {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1
                    const href = '/' + breadcrumbs.slice(0, index + 1).join('/')

                    return (
                        <React.Fragment key={crumb}>
                            {/* <BreadcrumbSeparator /> */}
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{getBreadcrumbTitle(crumb, true)}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink to={href}>{getBreadcrumbTitle(crumb, false)}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </React.Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
