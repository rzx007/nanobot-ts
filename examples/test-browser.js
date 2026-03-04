#!/usr/bin/env bun
/**
 * 测试修复后的浏览器工具
 */

const { execaCommand } = await import('execa');

async function testBrowserTools() {

  try {
    console.log('📖 步骤 1: 打开百度（不使用 --wait）...');
    const openResult = await execaCommand(
      'agent-browser --session test_session open www.baidu.com --headed',
      { shell: true, timeout: 30000 },
    );
    console.log('   结果:', openResult.stdout);

    console.log('\n📸 步骤 2: 获取页面快照...');
    const snapshotResult = await execaCommand('agent-browser --session test_session snapshot -i', {
      shell: true,
      timeout: 15000,
    });
    console.log('   结果:');
    console.log(snapshotResult.stdout);

    console.log('\n🖼 步骤 3: 截图...');
    const screenshotResult = await execaCommand('agent-browser --session test_session screenshot', {
      shell: true,
      timeout: 15000,
    });
    console.log('   结果:', screenshotResult.stdout);

    console.log('\n✅ 所有测试通过！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stdout) console.log('stdout:', error.stdout);
    if (error.stderr) console.log('stderr:', error.stderr);
  } finally {
    console.log('\n🔒 关闭浏览器...');
    try {
      const closeResult = await execaCommand('agent-browser --session test_session close', {
        shell: true,
        timeout: 10000,
      });
      console.log('   结果:', closeResult.stdout);
    } catch (e) {
      console.log('   浏览器关闭出错:', e.message);
    }
  }
}

testBrowserTools().catch(console.error);
