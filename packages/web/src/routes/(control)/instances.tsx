import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(control)/instances')({
    component: InstancesPage,
})

function InstancesPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">实例管理</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">实例管理功能正在开发中...</p>
            </div>
        </div>
    )
}
