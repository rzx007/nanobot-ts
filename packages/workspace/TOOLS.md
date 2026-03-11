# TOOLS.md

## Available Tools

This document describes all tools available to nanobot.

### File System Tools

#### read_file

**Description**: Read the contents of a file.

**Parameters**:
- `path` (string, required): Path to the file to read.

**Usage Example**:
```
Read file at /home/user/project/src/index.ts
```

#### write_file

**Description**: Write content to a file.

**Parameters**:
- `path` (string, required): Path to the file to write.
- `content` (string, required): Content to write to the file.

**Usage Example**:
```
Write "console.log('Hello')" to /home/user/project/hello.js
```

#### edit_file

**Description**: Edit specific lines in a file.

**Parameters**:
- `path` (string, required): Path to the file to edit.
- `old_str` (string, required): Old string to replace.
- `new_str` (string, required): New string to replace with.

**Usage Example**:
```
Replace "console.log('old')" with "console.log('new')" in /home/user/project/hello.js
```

#### list_dir

**Description**: List the contents of a directory.

**Parameters**:
- `path` (string, required): Path to the directory to list.

**Usage Example**:
```
List files in /home/user/project/src
```

### Shell Tools

#### exec

**Description**: Execute a shell command.

**Parameters**:
- `command` (string, required): Shell command to execute.
- `cwd` (string, optional): Working directory for the command.

**Usage Example**:
```
Run "npm install" in the current directory
```

**Safety Notes**:
- Commands timeout after 60 seconds by default
- Some dangerous commands may be blocked
- Workspace restrictions apply if enabled

### Web Tools

#### web_search

**Description**: Search the web using Brave Search API.

**Parameters**:
- `query` (string, required): Search query.

**Usage Example**:
```
Search for "TypeScript best practices 2024"
```

#### web_fetch

**Description**: Fetch and parse content from a URL.

**Parameters**:
- `url` (string, required): URL to fetch.

**Usage Example**:
```
Fetch content from https://example.com
```

### Messaging Tools

#### message

**Description**: Send a message to a specific chat channel.

**Parameters**:
- `channel` (string, required): Target channel (whatsapp, feishu, email, qq).
- `chat_id` (string, required): Chat ID to send to.
- `content` (string, required): Message content.

**Usage Example**:
```
Send "Task completed!" to whatsapp:+1234567890
```

### Task Management Tools

#### spawn

**Description**: Spawn a background sub-agent for parallel task execution.

**Parameters**:
- `task` (string, required): Task description.
- `channel` (string, optional): Channel to deliver results to.

**Usage Example**:
```
Spawn a background task to analyze a large log file
```

---

**Note**: Tool availability may vary based on configuration and workspace restrictions.
