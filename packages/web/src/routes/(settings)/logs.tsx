import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(settings)/logs')({
    component: LogsPage,
})

function LogsPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">日志查看</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">日志查看功能正在开发中...</p>
            </div>
        </div>
    )
}
