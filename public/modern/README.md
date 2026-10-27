# 开场之后的现代工作台（独立方案）

入口：`/modern/user.html`。未填写资料时仍播放原有的七幕开场，结束后进入新工作台。
服务与提醒：`/modern/services.html`。

## 范围

- 只新增本目录，原版与 `/community/` 上一套设计均保留。
- 开场继续直接加载根目录的 `onboarding.js`、`onboarding.css`、`onboarding-scene.js`，没有修改开场及其光标、背景、点击音效。
- 已核对 GitHub `6eecc6c8a00bdedd8f7546dccfbd21fa02a649d2` 的三个开场文件，与本地对应 Git blob 完全一致。
- 日常界面使用现有居民控制器、政策发现模块和服务控制器。`modern.js` 只负责布局、文案、导航和原生帮助弹窗；后端、授权、匹配规则、政策出处及不确定性均由原模块处理。
- 本方案没有合并远程新增的业务模块，也没有推送到 GitHub；这是对本地现有流程的独立界面设计。
- 不加入示例获批金额、虚构待办数量或自动申请入口。数据、资料修改、兴趣设置与官方原文仍通过原有流程使用。

## 设计参考

- [Landing Love · Linear](https://www.landing.love/sites/linear/)：深色空间、细边界、界面信息层级。实际查看了该站提供的 Linear 截图。
- [Landing Love · Huly](https://www.landing.love/sites/huly/)：与科技产品相协调的深色视觉、少量光感。
- [Land-book](https://land-book.com/) 与 [Siteinspire · Linear](https://www.siteinspire.com/website/9425-linear)：现代产品界面的排版与留白参考。
- [21st · Community Components](https://21st.dev/community/components)：浏览了导航、Dashboard 与交互组件分类；没有引入组件依赖。

本轮精修另外参考 [Apple 的材质设计](https://developer.apple.com/design/human-interface-guidelines/materials)、[Gemini 的 Neural Expressive 说明](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/)、[21st Animated Tabs](https://21st.dev/%40kuratlielia/components/tabs) 和 [Motion 的共享布局动画说明](https://motion.dev/docs/react-layout-animations)。只借鉴信息层次、材质及动效组织方式，没有复制这些作品的代码或图片，也没有引入 React 或第三方动画运行库。

## 矢量与动效

- 银色结环是原创参数化 SVG；七类需求图标和信封插画也是矢量。源文件与可复现生成器一并保留。重新生成：`node scripts/build-modern-art.cjs`。
- 较复杂的结环以 SVG 图片显示，避免把数千个几何节点放进工作台 DOM。闲置动效只做轻微位移和旋转，指针光感用事件触发的单帧任务更新，不增加自定义光标。
- 居民端页面、服务栏目使用原生 View Transition 过渡；侧栏滑块在切换前保留当前位置，连续点击会优先完成最后一次操作。
- 分类悬停、搜索聚焦、政策卡片进入和弹窗各有反馈。卡片仅在进入视口时播放，后台页面暂停装饰动画。
- 尊重系统的减少动态效果、减少透明度与增强对比度设置。原来的固定 45% 点击音效仍由根目录脚本负责，没有新增音量界面。

`modern.js` 负责居民页面的呈现与原操作的衔接，`polish.js` 负责共享动效，`polish.css` 是最后一层精修样式。人工协助入口位于顶部，手机端头像也可以打开服务档案。

## 本地检查

按项目的正常方式启动后访问以上地址。预览时可使用开场自带的演示编号，所有测试资料应为虚构资料。UI 设计无需真实证件号，也无需调用模型。

本次独立预览使用端口 5177 和仓库之外的演示数据目录。原版 13 个关键文件的字节校验保持一致；项目 66 项测试及 JavaScript 语法检查均通过。
