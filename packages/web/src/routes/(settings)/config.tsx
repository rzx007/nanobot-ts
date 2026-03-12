import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(settings)/config')({
    component: ConfigPage,
})

function ConfigPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">系统配置</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">系统配置功能正在开发中...</p>
            </div>
        </div>
    )
}
