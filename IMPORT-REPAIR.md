# MCP 批量导入修复说明

线上 `/mcp` 请求出现 `Worker exceeded CPU time limit`，对应 Cloudflare 1102。

## 改动

- 复用 41 个静态 Zod 输入/输出 schema，减少每次请求的初始化开销。MCP server、用户身份、权限检查和回调仍按请求创建。
- Markdown 分析在没有代码、注释、链接等标记时跳过不必要的扫描；字数统计避免创建整篇字符数组。
- 附件配额支持 `ATTACHMENT_QUOTA_BYTES` 环境变量，非法或缺省值仍回退到 1 GiB。这个 fork 的 R2 配置设为 2 GiB，以容纳约 1.39 GiB 的待导入原件。单文件 25 MiB、每小时 100 次上传限制保持原值。
- 没有修改数据库结构、OAuth、删除权限、计费套餐或笔记内容。

## 验证

- 使用 Node 24.19.0；TypeScript 检查、Worker 与前端生产构建通过（构建有前端分包体积提示；本地 Wrangler 日志目录写入受限不影响构建结果）。
- 单元测试：74 项通过，1 项原有失败。原有失败为 `extractAttachmentIds > keeps stripping nested ordinary code inside an md-example fence`；在基线 c146593f0c2153431433260d0377622906f17e42 的未修改源码上也复现。
- 临时对照检查：200 组固定种子的 Markdown/Unicode 混合样本，对比 6 个分析函数，结果与基线一致；已移除临时基线副本。
- 新增测试涵盖用户身份隔离、无读取 scope 时拒绝访问、配额配置、Unicode 字数和标签保护区域。

本地同进程、20 次采样的中位数（约 60 万字符的合成正文）：

| 操作 | 修改前 ms | 修改后 ms |
| --- | ---: | ---: |
| 创建 MCP server | 4.57 | 1.29 |
| 摘要分析 | 29.61 | 5.04 |
| 字数统计 | 28.10 | 9.00 |
| 标签提取 | 51.82 | 1.70 |
| Wiki 链接提取 | 31.97 | 0.05 |

这些是本地 Node 测量，不是 Cloudflare CPU 计量，也不是免费计划可用性保证。Workers Free 单个 HTTP 请求的 CPU 限制为 10 ms；大正文和附件仍可能超限。上线后先验证小型读取，再恢复导入；若仍超限，需要继续拆分处理或由账户所有者决定是否升级 Workers。

## 部署与恢复

本变更需合并到部署分支后由 Cloudflare 构建发布。若 Dashboard 覆盖了环境变量，请确认 `ATTACHMENT_QUOTA_BYTES=2147483648` 生效。该值是应用配额，不会改变 Cloudflare 套餐。

恢复前必须核实上次结果不确定的写入，确认目标笔记内容后再继续。导入器已经保存本地断点，并为附件重试使用稳定 attachment_id，避免重复上传。已导入内容不需要清空重来。

参考：[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[R2 免费用量](https://developers.cloudflare.com/r2/pricing/)。
