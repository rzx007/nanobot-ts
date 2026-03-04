#!/usr/bin/env bun
/**
 * 简单的浏览器工具测试
 */

const { execaCommand } = await import('execa');

async function testBrowser() {
  console.log('🚀 测试浏览器自动化...\n');

  try {
    console.log('📖 步骤 1: 打开 example.com...');
    const openResult = await execaCommand('agent-browser open https://example.com --headed', {
      shell: true,
      timeout: 15000,
    });
    console.log('   结果:', openResult.stdout);

    console.log('\n📸 步骤 2: 获取页面快照...');
    const snapshotResult = await execaCommand('agent-browser snapshot -i', {
      shell: true,
      timeout: 15000,
    });
    console.log('   结果:');
    console.log(snapshotResult.stdout);

    console.log('\n✅ 测试通过！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  } finally {
    console.log('\n🔒 关闭浏览器...');
    try {
      const closeResult = await execaCommand('agent-browser close', {
        shell: true,
        timeout: 10000,
      });
      console.log('   结果:', closeResult.stdout);
    } catch (e) {
      console.log('   浏览器关闭出错:', e);
    }
  }
}

testBrowser().catch(console.error);
