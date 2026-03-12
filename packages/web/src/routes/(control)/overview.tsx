import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(control)/overview')({
    component: OverviewPage,
})

function OverviewPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">概览</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">总实例数</div>
                    <div className="text-2xl font-bold">12</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">活跃会话</div>
                    <div className="text-2xl font-bold">8</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">消息总数</div>
                    <div className="text-2xl font-bold">1,234</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">活跃频道</div>
                    <div className="text-2xl font-bold">5</div>
                </div>
            </div>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">系统概览功能正在开发中...</p>
            </div>
        </div>
    )
}
