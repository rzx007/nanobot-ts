import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { request } from '@/lib/request'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, CheckCircle, XCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

interface SkillInfo {
    name: string
    path: string
    content: string
    description?: string
    part?: string
    author?: string
    triggers?: string[]
    available?: boolean
    _frontmatter?: Record<string, unknown>
}

interface SkillsResponse {
    code: number
    message: string
    data: {
        skills: SkillInfo[]
        total: number
    }
}

export const Route = createFileRoute("/(proxy)/skills")({
    component: SkillsPage,
})

function SkillsPage() {
    const [skills, setSkills] = useState<SkillInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null)

    const fetchSkills = async () => {
        try {
            setLoading(true)
            const response = await request<SkillsResponse>('/api/v1/skills')
            setSkills(response.data.skills)
        } catch (error) {
            toast.error('Failed to load skills', {
                description: error instanceof Error ? error.message : 'Unknown error'
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSkills()
    }, [])

    return (
        <div className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold mb-1">技能管理</h2>
                    <p className="text-muted-foreground text-sm">
                        管理和查看可用的 AI 技能
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchSkills}>
                    刷新
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">加载中...</div>
                </div>
            ) : skills.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">暂无可用技能</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {skills.map((skill) => (
                        <SkillCard
                            key={skill.name}
                            skill={skill}
                            onView={() => setSelectedSkill(skill)}
                        />
                    ))}
                </div>
            )}

            <SkillDetailDialog
                skill={selectedSkill}
                open={!!selectedSkill}
                onOpenChange={(open) => !open && setSelectedSkill(null)}
            />
        </div>
    )
}

interface SkillCardProps {
    skill: SkillInfo
    onView: () => void
}

function SkillCard({ skill, onView }: SkillCardProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-base mb-1">{skill.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                            {skill.description || '暂无描述'}
                        </CardDescription>
                    </div>
                    <Badge
                        variant={skill.available ? 'default' : 'destructive'}
                        className="ml-2 shrink-0"
                    >
                        {skill.available ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {skill.available ? '可用' : '不可用'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {skill.author && (
                        <div className="text-xs text-muted-foreground">
                            作者: {skill.author}
                        </div>
                    )}
                    {skill.part && (
                        <div className="text-xs text-muted-foreground">
                            版本: {skill.part}
                        </div>
                    )}
                    {skill.triggers && skill.triggers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {skill.triggers.slice(0, 3).map((trigger) => (
                                <Badge key={trigger} variant="secondary" className="text-xs">
                                    {trigger}
                                </Badge>
                            ))}
                            {skill.triggers.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                    +{skill.triggers.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={onView}
                    >
                        <Info className="h-4 w-4 mr-2" />
                        查看详情
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

interface SkillDetailDialogProps {
    skill: SkillInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

function SkillDetailDialog({ skill, open, onOpenChange }: SkillDetailDialogProps) {
    if (!skill) return null

    const frontmatter = skill._frontmatter || {}
    const allowedTools = frontmatter['allowed-tools'] as string | undefined

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] min-w-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-start">
                        <DialogTitle className="text-xl mr-2">{skill.name}</DialogTitle>
                        <Badge
                            variant={skill.available ? 'default' : 'destructive'}
                        >
                            {skill.available ? '可用' : '不可用'}
                        </Badge>
                    </div>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-4">
                        {skill.description && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">描述</h3>
                                <p className="text-sm text-muted-foreground">
                                    {skill.description}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {skill.part && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">版本</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {skill.part}
                                    </p>
                                </div>
                            )}
                            {skill.author && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">作者</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {skill.author}
                                    </p>
                                </div>
                            )}
                        </div>

                        {skill.triggers && skill.triggers.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">触发关键词</h3>
                                <div className="flex flex-wrap gap-2">
                                    {skill.triggers.map((trigger) => (
                                        <Badge key={trigger} variant="secondary">
                                            {trigger}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {allowedTools && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">允许的工具</h3>
                                <div className="bg-muted p-3 rounded-md">
                                    <code className="text-xs text-foreground">
                                        {allowedTools}
                                    </code>
                                </div>
                            </div>
                        )}

                        {skill.content && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">技能文档</h3>
                                <div className="bg-muted p-4 rounded-md">
                                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                        {skill.content}
                                    </pre>
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                            <p>路径: {skill.path}</p>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
