import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(control)/cron')({
    component: CronPage,
})

function CronPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">定时任务</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">定时任务管理功能正在开发中...</p>
            </div>
        </div>
    )
}
