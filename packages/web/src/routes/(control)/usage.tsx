import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(control)/usage')({
    component: UsagePage,
})

function UsagePage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">使用情况</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">使用情况统计功能正在开发中...</p>
            </div>
        </div>
    )
}
