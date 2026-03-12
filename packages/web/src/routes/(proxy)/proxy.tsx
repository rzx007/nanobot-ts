import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute("/(proxy)/proxy")({
    component: ProxyPage,
})

function ProxyPage() {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">代理配置</h2>
            <div className="bg-card border rounded-lg p-4">
                <p className="text-muted-foreground">代理配置功能正在开发中...</p>
            </div>
        </div>
    )
}
