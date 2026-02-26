/**
 * SkillLoader 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from '../../../src/core/skills';
import type { Config } from '../../../src/config/schema';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('SkillLoader', () => {
  let skillLoader: SkillLoader;
  let testWorkspace: string;
  let testSkillsDir: string;

  const createTestConfig = (workspace: string): Config => ({
    agents: {
      defaults: {
        workspace,
        model: 'openai:gpt-4o',
        temperature: 0.1,
        maxTokens: 8192,
        maxIterations: 40,
        memoryWindow: 100,
      },
    },
    providers: {
      openai: { apiKey: 'test-key' },
      anthropic: { apiKey: 'test-key' },
      openrouter: { apiKey: 'test-key' },
      deepseek: { apiKey: 'test-key' },
    },
    channels: {
      whatsapp: { enabled: false, allowFrom: [], usePairingCode: false },
      feishu: {
        enabled: false,
        appId: '',
        appSecret: '',
        encryptKey: '',
        verificationToken: '',
        allowFrom: [],
      },
      email: {
        enabled: false,
        consentGranted: false,
        imapHost: '',
        imapPort: 993,
        imapUsername: '',
        imapPassword: '',
        imapMailbox: 'INBOX',
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        fromAddress: 'test@example.com',
        allowFrom: [],
        autoReplyEnabled: true,
      },
    },
    tools: {
      restrictToWorkspace: false,
      exec: { timeout: 60, allowedCommands: [] },
      web: { search: { apiKey: '' } },
    },
  });

  beforeEach(async () => {
    testWorkspace = path.join(os.tmpdir(), `nanobot-test-${Date.now()}`);
    testSkillsDir = path.join(testWorkspace, 'skills');
    await fs.mkdir(testSkillsDir, { recursive: true });
    const config = createTestConfig(testWorkspace);
    skillLoader = new SkillLoader(config);
  });

  afterEach(async () => {
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch {}
  });

  describe('init', () => {
    it('should load no skills from empty directory', async () => {
      await skillLoader.init();

      expect(skillLoader.getSkillNames()).toHaveLength(0);
    });

    it('should load skills from subdirectories', async () => {
      // Create a test skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '# Test Skill\n\nThis is a test skill.',
        'utf-8',
      );

      await skillLoader.init();

      expect(skillLoader.getSkillNames()).toContain('test-skill');
    });

    it('should skip directories without SKILL.md', async () => {
      const skillDir = path.join(testSkillsDir, 'no-skill-dir');
      await fs.mkdir(skillDir);
      await fs.writeFile(path.join(skillDir, 'README.md'), 'Not a skill', 'utf-8');

      await skillLoader.init();

      expect(skillLoader.getSkillNames()).toHaveLength(0);
    });

    it('should parse frontmatter from skill', async () => {
      const skillDir = path.join(testSkillsDir, 'weather');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: weather
description: Get weather information
---

# Weather Skill

This skill provides weather information.`,
        'utf-8',
      );

      await skillLoader.init();

      const skill = skillLoader.getSkill('weather');
      expect(skill).not.toBeNull();
      expect(skill?.description).toBe('Get weather information');
    });
  });

  describe('getSkill', () => {
    it('should return null for non-existent skill', async () => {
      await skillLoader.init();

      const skill = skillLoader.getSkill('nonexistent');
      expect(skill).toBeNull();
    });

    it('should return skill when exists', async () => {
      const skillDir = path.join(testSkillsDir, 'test');
      await fs.mkdir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test\n\nTest content', 'utf-8');

      await skillLoader.init();

      const skill = skillLoader.getSkill('test');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test');
    });
  });

  describe('getSkillNames', () => {
    it('should return array of skill names', async () => {
      const skill1 = path.join(testSkillsDir, 'skill1');
      const skill2 = path.join(testSkillsDir, 'skill2');
      await fs.mkdir(skill1);
      await fs.mkdir(skill2);
      await fs.writeFile(path.join(skill1, 'SKILL.md'), '# Skill 1\n', 'utf-8');
      await fs.writeFile(path.join(skill2, 'SKILL.md'), '# Skill 2\n', 'utf-8');

      await skillLoader.init();

      const names = skillLoader.getSkillNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('skill1');
      expect(names).toContain('skill2');
    });
  });

  describe('getAllSkills', () => {
    it('should return empty array when no skills', async () => {
      await skillLoader.init();

      expect(skillLoader.getAllSkills()).toEqual([]);
    });

    it('should return array of all skills', async () => {
      const skillDir = path.join(testSkillsDir, 'test');
      await fs.mkdir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test\n\nContent', 'utf-8');

      await skillLoader.init();

      const skills = skillLoader.getAllSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('test');
    });
  });

  describe('getAlwaysSkills', () => {
    it('should return empty array when no skills', async () => {
      await skillLoader.init();

      expect(skillLoader.getAlwaysSkills()).toEqual([]);
    });

    it('should return skills with always=true in metadata', async () => {
      const skillDir = path.join(testSkillsDir, 'always-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
metadata: '{"nanobot": {"always": true}}'
---

# Always Skill`,
        'utf-8',
      );

      await skillLoader.init();

      const alwaysSkills = skillLoader.getAlwaysSkills();
      expect(alwaysSkills).toHaveLength(1);
      expect(alwaysSkills[0].name).toBe('always-skill');
    });
  });

  describe('buildSkillsSummary', () => {
    it('should return empty string when no skills', async () => {
      await skillLoader.init();

      expect(skillLoader.buildSkillsSummary()).toBe('');
    });

    it('should return XML-formatted skills summary', async () => {
      const skillDir = path.join(testSkillsDir, 'test');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
description: A test skill
---

# Test Skill`,
        'utf-8',
      );

      await skillLoader.init();

      const summary = skillLoader.buildSkillsSummary();
      expect(summary).toContain('<skills>');
      expect(summary).toContain('<skill');
      expect(summary).toContain('test');
    });
  });

  describe('getSkillMetadata', () => {
    it('should return null for non-existent skill', async () => {
      await skillLoader.init();

      const metadata = skillLoader.getSkillMetadata('nonexistent');
      expect(metadata).toBeNull();
    });

    it('should return metadata for existing skill', async () => {
      const skillDir = path.join(testSkillsDir, 'test');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test
description: A test
---

# Test`,
        'utf-8',
      );

      await skillLoader.init();

      const metadata = skillLoader.getSkillMetadata('test');
      expect(metadata).not.toBeNull();
      expect(metadata?.name).toBe('test');
    });
  });
});
