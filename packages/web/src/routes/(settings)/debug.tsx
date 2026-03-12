import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(settings)/debug')({
    component: DebugPage,
})

function DebugPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">调试工具</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">调试工具功能正在开发中...</p>
            </div>
        </div>
    )
}
