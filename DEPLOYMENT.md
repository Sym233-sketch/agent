# 线上共创站部署

仓库主线为 `main`。Render 从 GitHub 拉取代码，政府端、居民端、文件转换和模型服务在同一个 Node.js 进程运行。团队成员进入同一个 HTTPS 站点，使用团队口令登录。这里的口令是可信共创团队的统一入口，团队内共享管理权限，不是政府与居民的正式分权账号体系。

## 当前演示站

地址：<https://mincetong-agent.onrender.com/team.html>。Render 服务 ID 为 `srv-dbc8sv59fdbs73c8ib4g`，位于用户确认的“共创”工作区，免费单实例，新加坡区域。通过 Render CLI 创建并启用 `main` 的自动部署；`render.yaml` 保留等效配置供复现，当前服务没有绑定 Blueprint。不要为现有站点重复创建同名服务；后续修改部署配置需同步到现有服务，而非仅修改 YAML。

团队口令保存在服务的环境变量里，本机另有 Git 忽略的 `.env.cloud` 供管理员查看，不会写入仓库或公开文档。请私下交给受邀团队。

自动更新还依赖 GitHub App 对 `Sym233-sketch/agent` 的授权。仅有 Render 登录授权或服务上的 Auto-Deploy 开关不够；若主线推送后没有出现 `new_commit` 部署，先检查 [Render GitHub App 仓库权限](https://github.com/apps/render/installations/new)，再检查服务 Settings 的 Git Credentials。用户已为本次部署授权该仓库；后续取消授权会中断自动更新。

## 首次部署

1. 在 Render 连接拥有本仓库权限的 GitHub 账号。必须通过连接的 GitHub 提供方选择仓库；仅填写公开 Git URL 的服务不支持自动部署。
2. 打开 <https://dashboard.render.com/blueprint/new?repo=https://github.com/Sym233-sketch/agent>，选择 `main` 上的 `render.yaml`。
3. 确认使用 **Free** 实例后 Apply。用户已选择免费演示：模板使用 `free`、新加坡区域，不创建付费磁盘或数据库。免费配额限制以 Render 控制台为准。
4. Render 自动生成 `MINCETONG_TEAM_PASSWORD`。管理员在服务的 Environment 页面安全查看，将口令私下交给受邀团队；不要写入仓库、日志或公开链接。
5. 等待部署状态变为 Live。访问服务生成的真实 HTTPS 地址，登录后打开 `/team.html`，确认运行的 commit 与 GitHub 主线相符。
6. 同一域名下：`/#policy` 为政府端，`/user.html` 为居民端，`/agent-settings.html` 为模型配置。不要再分享 `127.0.0.1` 地址。

模板不会配置或调用真实模型。管理员可在受保护的模型配置页填写 API key，或在 Render 环境变量中设置服务商配置。站点部署和自动测试都不会调用付费模型。

## 自动同步

- 推送代码并合并至 `main` 后，GitHub Actions 先执行 `npm ci`、`npm test`、`npm run check` 与入口同步检查。
- `autoDeployTrigger: commit` 使 Render 在主线提交后自动构建。Render 构建时会独立运行测试和语法检查，检查失败不会发布新版本；GitHub Actions 同时提供检查结果。
- 修改 `public/workbench.html` 后，提交前执行 `node scripts/sync-workbench.cjs`，并提交同步后的 `public/index.html`。
- 本机尚未提交、尚未推送、其他分支尚未合并的更改不会上线。线上网页也不直接编辑仓库代码。
- `/team.html` 和受保护的 `/api/version` 显示 Render 实际部署的 Git SHA。通过版本核对同步情况，不把“已推送”当作“已经上线”。

## 存储与访问

- 当前免费模板将政策快照、虚构居民档案、消息与回执写入 `/tmp/mincetong`；休眠、重启和部署后这些演示数据可能丢失。首次部署不会上传任何本地 `data/`。
- 文档审查上传文件、报告和已配置的内存 API key 在服务重启后需要重新导入或设置。磁盘持久化不是这些内存内容的备份。
- 应用使用一个进程和一个实例；文件状态不支持多实例写入。不承诺绝对不中断。
- Render 免费服务闲置 15 分钟会休眠，且不能附加持久化磁盘，不能满足持续在线并保留共创数据的要求。
- 若以后需要常驻并保留数据，先确认费用，再升级付费实例、挂载持久化磁盘并修改 `MINCETONG_DATA_DIR`。本次不自动开通收费资源。
- 云端自动绑定 `0.0.0.0:$PORT`，检测到 Render 时必须配置强口令及 HTTPS 来源才会启动。默认读取 Render 提供的 `RENDER_EXTERNAL_URL`；自定义域名需将 `MINCETONG_PUBLIC_ORIGIN` 设置为该域名的 HTTPS origin。
- 除不含数据的 `/healthz` 外，页面、静态资源和 API 都受团队会话保护。会话 Cookie 使用 Secure、HttpOnly 和 SameSite=Strict；居民 Bearer token 保留独立用途。更换团队口令并重新部署会使旧会话失效。
- 无正式双端权限、身份核验或真实补助发放；只允许受邀团队用虚构数据演示。

## 验证与故障排查

部署前运行 `npm test`、`npm run check`。Render CLI 可用时运行 `render blueprints validate render.yaml`；JSON Schema 验证只检查结构，不能替代 Render 平台验证。

上线后检查 `/healthz` 返回 200、未登录 API 返回 401、登录后三个入口正常、`/api/version` 对应目标 commit，再使用虚构居民验证政府端和居民端互通。看到 Build failed、未通过检查或缺少 GitHub 授权时应检查相应阶段日志，不要宣称已经上线。

官方参考：[Blueprint](https://render.com/docs/blueprint-spec)、[自动部署](https://render.com/docs/deploys)、[免费服务限制](https://render.com/docs/free)、[持久化磁盘](https://render.com/docs/disks)。
