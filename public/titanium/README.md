# 钛灰暖光三维服务空间

直接预览：`/titanium/user.html?preview=1#hall`；保留原始完整开场：`/titanium/user.html`。

本版本在 GitHub `main` 的 `2b8c059` 基础上构建；具体来源见 `source-upstream.json`。保留最新版居民控制器、办事工作台、政策查询、主动关怀、生日与资料核验逻辑。办事服务选项进入最新版工作台；关怀、政策、共创、消息与人工协助仍使用真实既有流程。没有自动发送对话、加入共创或提交事项。

背景与六个展件在同一个 Three.js 场景中渲染：连续弧面墙地、共享摄影棚 HDR 环境光、暖色主光、金属与玻璃边缘、软投影、低强度地面反射。照片嵌在有实体厚度的展件上，名称融入照片；不增加侧栏、说明文案或重复入口。

各选项使用不同高度、深度、角速度和独立姿态；位置不共面。缓慢运动中可以看到侧边与背面；悬停或键盘聚焦时朝向用户并停留。拖动实际调整相机视角，方向键选择服务，Home 回到全景。暂停、减少动态效果、页面隐藏与详情页暂停均保留。窄屏使用纵向空间构图，并关闭额外的平面反射渲染；WebGL 不可用时提供照片入口。

真实照片复用 `../album/photos/`，来源与许可保留在其中的 `sources.json`。真实摄影棚环境为 Poly Haven 的 [Studio Small 09](https://polyhaven.com/a/studio_small_09)，作者 Sergej Majboroda，使用 [CC0](https://polyhaven.com/license)；来源也记录在 `assets/sources.json`。Three.js 0.186.1 主模块复用 `../reels/vendor/`，HDRLoader、Reflector 来自同版本官方包，保留 MIT 许可证。

执行 `node scripts/build-titanium-variant.cjs` 仅刷新本版本的页面和最新业务控制器，不改写原版或其他独立版本。`node scripts/prepare-titanium-assets.cjs [官方 three npm 压缩包路径]` 准备本地运行资源。所有媒体与模块均在本地提供，运行时不依赖外站。

本轮仅本地预览，未推送 GitHub。最新版 120 项既有测试与全量 JavaScript 语法检查已通过，测试未使用实际模型额度。

浏览器验证：六个选项在无操作时持续移动；暂停后投影位置保持不变；实际点击关怀展件进入关怀分类；办事服务进入最新版工作台。桌面与 390×844 手机显示正常，无横向溢出，控制台没有渲染错误。政府端及所有旧版目录均未因本次视觉实现发生改动。
