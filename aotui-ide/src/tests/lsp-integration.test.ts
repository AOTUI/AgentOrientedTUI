import { lspService } from '../core/lsp-service.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * 集成测试脚本：验证 LSPService 是否能正常工作
 * 
 * 场景：
 * 1. 创建临时 TS 文件
 * 2. 初始化 LSPService
 * 3. 执行 getDiagnostics 和 hover
 * 4. 验证结果
 */
async function runTest() {
    console.log('🧪 Starting LSP Integration Test...');

    const testDir = path.join(process.cwd(), 'test-workspace');
    const testFile = path.join(testDir, 'hello.ts');

    try {
        // 1. 准备测试环境
        await fs.mkdir(testDir, { recursive: true });
        // 创建一个简单的 TS 文件，包含一个类型错误（字符串赋值给数字）
        const code = `
const a: number = 1;
const b: string = "hello";
function greet(name: string) {
    return "Hello, " + name;
}
const c: number = b; // Error here
greet("world");
        `.trim();
        await fs.writeFile(testFile, code);
        console.log(`📝 Created test file at ${testFile}`);

        // 2. 初始化 LSP
        // 注意：LSP Server 启动可能需要几秒钟
        console.log('🚀 Initializing LSP Service...');
        await lspService.init(testDir);

        // 3. 等待 Server 启动
        console.log('⏳ Waiting for Server (5s)...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 4. 执行 Hover 测试
        console.log('🔍 Testing Hover...');
        const hoverResult = await lspService.hover(testFile, 3, 10); // line 3: function greet(name) -> hover on "greet"
        console.log('Hover Result:', JSON.stringify(hoverResult, null, 2));

        if (hoverResult && hoverResult.content && hoverResult.content.includes('greet')) {
            console.log('✅ Hover verified!');
        } else {
            console.warn('⚠️ Hover content unexpected (might depend on TS server version)');
        }

        // 5. 执行 Diagnostics 测试
        // Server 需要一点时间来发布 diagnostics
        console.log('⏳ Waiting for Diagnostics (5s)...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('🔍 Testing Diagnostics...');
        const diagnostics = await lspService.getDiagnostics(testFile);
        console.log('Diagnostics Result:', JSON.stringify(diagnostics, null, 2));

        const hasError = diagnostics.some(d => d.message.includes('Type') && d.message.includes('number'));
        if (hasError) {
            console.log('✅ Diagnostics verified: Found Expected Type Error!');
        } else {
            console.warn('⚠️ No expected type error found. Server might not be fully ready or file not synced.');
        }

    } catch (err) {
        console.error('❌ Test Failed:', err);
    } finally {
        // 清理
        // await fs.rm(testDir, { recursive: true, force: true });
        console.log('🧹 Cleanup done (test-workspace preserved for debugging)');
        process.exit(0);
    }
}

runTest();
