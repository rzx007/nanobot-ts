import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useGetConfigQuery, useUpdateConfigMutation, configQueryKeys } from '@/services/config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldContent,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from '@tanstack/react-form'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { configSchema } from '@/types/config'

const initialDefaults = {
  agents: {
    defaults: {
      model: 'openai:gpt-4o',
      temperature: 0.1,
      maxTokens: 8192,
      maxIterations: 40,
      memoryWindow: 100,
      streaming: true,
      workspace: '~/.nanobot/workspace',
    },
  },
  providers: {
    openai: { apiBase: 'https://api.openai.com/v1' },
    anthropic: { apiBase: 'https://api.anthropic.com' },
    google: { apiBase: 'https://generativelanguage.googleapis.com' },
    deepseek: { apiBase: 'https://api.deepseek.com' },
    groq: { apiBase: 'https://api.groq.com/openai/v1' },
    openrouter: { apiBase: 'https://openrouter.ai/api/v1' },
  },
  tools: {
    restrictToWorkspace: false,
    exec: { timeout: 30, allowedCommands: 'ls, pwd, cat, echo, grep' },
    web: { hasApiKey: false },
    browser: { enabled: false, headed: false },
    approval: { enabled: true },
  },
  subagent: { enabled: true, mode: 'auto' as const, concurrency: 3 },
  server: { port: 3000, host: '0.0.0.0' },
}

export const Route = createFileRoute('/(settings)/config')({
  component: ConfigPage,
})

function ConfigPage() {
  const queryClient = useQueryClient()
  const { data: config } = useGetConfigQuery()
  const updateConfigMutation = useUpdateConfigMutation()

  const form = useForm({
    defaultValues: config ?? initialDefaults,
    validators: {
      onSubmit: configSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateConfigMutation.mutateAsync(value)
        toast.success('配置已保存')
        queryClient.invalidateQueries({ queryKey: configQueryKeys.config() })
      } catch {
        toast.error('保存失败')
      }
    },
  })

  React.useEffect(() => {
    if (config) {
      form.reset(config)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when config loads
  }, [config])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="shrink-0 flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">系统配置</h1>
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          保存配置
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className='space-y-4'
      >
        <Card>
          <CardHeader>
            <CardTitle>代理配置</CardTitle>
            <CardDescription>配置默认的AI代理设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <form.Field
                name="agents.defaults.model"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>默认模型</FieldLabel>
                      <Select
                        name={field.name}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai:gpt-4o">OpenAI GPT-4o</SelectItem>
                          <SelectItem value="openai:gpt-4-turbo">OpenAI GPT-4 Turbo</SelectItem>
                          <SelectItem value="anthropic:claude-3-5-sonnet-20240620">
                            Anthropic Claude 3.5 Sonnet
                          </SelectItem>
                          <SelectItem value="google:gemini-2.0-flash">Google Gemini 2.0 Flash</SelectItem>
                          <SelectItem value="deepseek:deepseek-chat">DeepSeek Chat</SelectItem>
                          <SelectItem value="groq:gemma2-9b-it">Groq Gemma 2 9B</SelectItem>
                          <SelectItem value="openrouter:meta-llama-3.1-70b-instruct">
                            OpenRouter Llama 3.1 70B
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="agents.defaults.temperature"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>温度参数</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        step="0.1"
                        min={0}
                        max={2}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="agents.defaults.maxTokens"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>最大 Token 数</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={1}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="agents.defaults.maxIterations"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>最大迭代次数</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={1}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="agents.defaults.memoryWindow"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>内存窗口</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={1}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="agents.defaults.streaming"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>启用流式返回</FieldLabel>
                        <FieldDescription>是否启用流式响应</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />

              <form.Field
                name="agents.defaults.workspace"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>工作区路径</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>提供商配置</CardTitle>
            <CardDescription>配置各个AI提供商的API设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              {(
                [
                  ['providers.openai.apiBase', 'OpenAI API 基础 URL', 'https://api.openai.com/v1'],
                  ['providers.anthropic.apiBase', 'Anthropic API 基础 URL', 'https://api.anthropic.com'],
                  ['providers.google.apiBase', 'Google API 基础 URL', 'https://generativelanguage.googleapis.com'],
                  ['providers.deepseek.apiBase', 'DeepSeek API 基础 URL', 'https://api.deepseek.com'],
                  ['providers.groq.apiBase', 'Groq API 基础 URL', 'https://api.groq.com/openai/v1'],
                  ['providers.openrouter.apiBase', 'OpenRouter API 基础 URL', 'https://openrouter.ai/api/v1'],
                ] as const
              ).map(([name, label, placeholder]) => (
                <form.Field
                  key={name}
                  name={name}
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="url"
                          placeholder={placeholder}
                          value={field.state.value ?? ''}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    )
                  }}
                />
              ))}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>工具配置</CardTitle>
            <CardDescription>配置系统工具的设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <form.Field
                name="tools.restrictToWorkspace"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>限制工作区</FieldLabel>
                        <FieldDescription>是否限制工具只能在工作区内执行</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />

              <form.Field
                name="tools.exec.timeout"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>执行超时（秒）</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={1}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="tools.exec.allowedCommands"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>允许的命令</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="ls, pwd, cat, echo, grep"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="tools.web.hasApiKey"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>Web 搜索 API 密钥</FieldLabel>
                        <FieldDescription>是否配置了 Web 搜索 API 密钥</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />

              <form.Field
                name="tools.browser.enabled"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>启用浏览器工具</FieldLabel>
                        <FieldDescription>是否启用浏览器工具</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />

              <form.Field
                name="tools.browser.headed"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>启用有头浏览器</FieldLabel>
                        <FieldDescription>是否启用有头浏览器（需要图形界面）</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />

              <form.Field
                name="tools.approval.enabled"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>启用审批工具</FieldLabel>
                        <FieldDescription>是否启用审批工具</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>子代理配置</CardTitle>
            <CardDescription>配置子代理的行为</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <form.Field
                name="subagent.enabled"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <FieldContent>
                        <FieldLabel htmlFor={field.name}>启用子代理</FieldLabel>
                        <FieldDescription>是否启用子代理功能</FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                      <Switch
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        aria-invalid={isInvalid}
                      />
                    </Field>
                  )
                }}
              />

              <form.Field
                name="subagent.mode"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>子代理模式</FieldLabel>
                      <Select
                        name={field.name}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                          <SelectValue placeholder="选择模式" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">自动</SelectItem>
                          <SelectItem value="manual">手动</SelectItem>
                        </SelectContent>
                      </Select>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="subagent.concurrency"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>并发数量</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={1}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>服务器配置</CardTitle>
            <CardDescription>配置服务器运行参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <form.Field
                name="server.host"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>主机地址</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="0.0.0.0"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="server.port"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>端口号</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={1}
                        max={65535}
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              />
            </FieldGroup>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
