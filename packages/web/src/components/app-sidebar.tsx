"use client"

import * as React from "react"
import { Link } from '@tanstack/react-router'

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  IconRobot,
  IconSettings,
  IconLifebuoy,
  IconSend,
  IconChartPie,
  IconCommand,
  IconChartBarPopular,
  IconActivity,
  IconServer,
  IconLink,
  IconBuildingBroadcastTower,
  IconFileTextSpark,
  IconDeviceDesktopCheck,
  IconAlarm,
  IconBookmarkAi,
  IconBinaryTree2,
  IconBug,
  IconFileText,
  IconSubtitlesAi,
} from "@tabler/icons-react"


const data = {
  user: {
    name: "Admin",
    email: "admin@nanobot.io",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "聊天",
      url: "/chat",
      icon: <IconSubtitlesAi />,
      isActive: true,
    },
    {
      title: "控制",
      url: "/overview",
      items: [
        {
          title: "概览",
          icon: <IconChartBarPopular />,
          url: "/overview",
        },
        {
          title: "频道",
          icon: <IconLink />,
          url: "/channels",
        },
        {
          title: "实例",
          icon: <IconBuildingBroadcastTower />,
          url: "/instances",
        },
        {
          title: "会话",
          icon: <IconFileTextSpark />,
          url: "/sessions",
        },
        {
          title: "使用情况",
          icon: <IconDeviceDesktopCheck />,
          url: "/usage",
        },
        {
          title: "定时任务",
          icon: <IconAlarm />,
          url: "/cron",
        },
      ],
    },
    {
      title: "代理",
      url: "/proxy",

      items: [
        {
          title: "代理",
          icon: <IconRobot />,
          url: "/proxy",
        },
        {
          title: "技能",
          icon: <IconBookmarkAi />,
          url: "/skills",
        },
        {
          title: "节点",
          icon: <IconBinaryTree2 />,
          url: "/nodes",
        },
      ],
    },
    {
      title: "设置",
      items: [
        {
          title: "配置",
          url: "/config",
          icon: <IconSettings />,
        },
        {
          title: "调试",
          url: "/debug",
          icon: <IconBug />,
        },
        {
          title: "日志",
          url: "/logs",
          icon: <IconFileText />,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "支持",
      url: "#",
      icon: <IconLifebuoy />,
    },
    {
      title: "反馈",
      url: "#",
      icon: <IconSend />,
    },
  ],
  projects: [
    {
      name: "生产环境",
      url: "#",
      icon: <IconServer />,
    },
    {
      name: "测试环境",
      url: "#",
      icon: <IconActivity />,
    },
    {
      name: "开发环境",
      url: "#",
      icon: <IconChartPie />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <IconCommand className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">NanoBot-TS</span>
                  <span className="truncate text-xs">Web Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
