# 主动服务 Agent

`/services.html` 是居民端主动服务中心，`/services.html?view=government` 是工作人员待办。两端已有“主动服务”入口，政府主工作台保持单屏。

6 组 Agent、31 个场景定义在 `server/service-scenarios.cjs`。覆盖18岁成年、60岁养老提示，证照换证/资格年审/农机渔船年检，补贴线索/待遇复核/养老金认证，随访产检疫苗/安全线索，生活缴费/供暖/入学，以及残疾人证/探访/儿童关爱。

## 执行与证据

- 日期类由本人登记或授权连接器提供。运行时每分钟检查，在30天内、一周内、前一天、当天及逾期阶段提醒；提前量是产品配置，不是法定办理期限。阶段去重，恢复运行只补查当前阶段。
- 窗口类记录实际开始和截止日期。周期类支持已约定天数或每月同日，月底保留原始日锚点；本人确认处理后才推进下一期。
- 事件类只接收本人记录或经令牌认证的连接器事件。来源始终保留；本人记录不冒充银行回执、设备报警、医疗结论或资格审批。
- 每条提醒有下一步、材料、来源、地区、待核实事项和渠道状态。官方入口只能登记HTTPS政府域名，未提供时留空，不制造办理入口。
- 规则判断不花模型额度。居民主动点击“红通帮我梳理”时，才调用固定的 DeepSeek，并仅提供该条提醒的脱敏证据。出生日期、号码和其他居民数据不交给模型。
- 有需要的提醒生成站内待办，按待认领→已认领→已完成流转，需工作人员确认；不代表真实社区人员已接通或已派单。
- 示例运行完全隔离，不保存提醒、不向居民递送、不调用付费模型。暂停、移除及注销会停止提醒并取消未完成待办；注销清除相关记录。

18岁年龄节点参考[民法典第十七条](https://www.court.gov.cn/zixun/xiangqing/233181.html)；60岁提示参考[老年人权益保障法第二条](https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_3c63a2ea4deb48c3810cfe7390a591e8.html)。法律年龄定义不等于地方证件、津贴或其他资格，地区规则仍需核对。医疗安排由医护/预约机构提供，本系统不生成诊断阈值或免疫程序。

## 接口

| 接口 | 用途 |
| --- | --- |
| `GET /api/services/catalog` | 场景、Agent、渠道状态 |
| `POST /api/services/simulate` | 隔离示例，参数 `scenarioId` |
| `GET /api/services/me` | 当前居民的登记安排、提醒、待办 |
| `POST /api/services/me/records` | 新建授权提醒，`scenarioId`、`consent:true` 及对应日期 |
| `PATCH /api/services/me/records/:id` | 修改安排或暂停/开启（开启需确认授权） |
| `DELETE /api/services/me/records/:id` | 停止并清除敏感安排资料 |
| `POST /api/services/me/records/:id/complete` | 本人确认处理或推进下期 |
| `POST /api/services/me/events` | 本人记录事件，`recordId`、`type`、唯一 `eventId` |
| `POST /api/services/me/notices/:id/read` | 已读 |
| `POST /api/services/me/notices/:id/explain` | 本条提醒的DeepSeek梳理 |
| `GET /api/services/government` | 待办及汇总，不含生日 |
| `POST /api/services/government/scan` | 检查所有已登记安排 |
| `POST /api/services/government/tasks/:id` | 经确认更新待办状态 |
| `POST /api/services/connector/records` | 已授权来源写入/更新安排 |
| `POST /api/services/connector/events` | 已授权事件接入 |

居民接口使用现有 Bearer 账户令牌，严格按当前居民取数。连接器接口必须设置服务器环境变量 `MINCETONG_INGEST_TOKEN`，并通过 `X-Connector-Token` 请求头认证；此令牌禁止写入代码、浏览器或聊天。连接器写入仍需 `residentId`、明确授权和已有场景，不根据姓名搜索或推定身份。事件类型以场景目录的 `eventType` 为准。

## 当前能力边界

已实现站内规则执行、提醒递送、记录去重、工作人员待办与居民主动请求的 DeepSeek 梳理。短信、政务APP、银行/补贴发放、设备、真实网格员及紧急救援均未连接；不会自动发钱、支付、申请、提交、代签或声称已经救援。免费 Render 休眠期间不执行定时检查，恢复后补查；磁盘临时数据可能丢失。紧急安全场景不能依赖本站作为救援通道。共创站共享演示管理权限，只使用虚构资料。

## 验证

`npm test` 包含全场景执行、日期/时区、阶段去重、重启恢复、周期、授权与账户隔离、连接器认证、示例隔离、待办和删除测试，模型响应使用替身，不消耗 API 额度。

可选：设置 `PLAYWRIGHT_MODULE` 和 `BROWSER_PATH` 后运行 `node tests/service-agents.browser.cjs`，验证桌面/手机、居民登记→提醒→本人报告安全线索→政府待办闭环及双端入口。测试资料存于隔离临时目录，完成后清除；截图在被Git忽略的 `test-results/service-agents/`。
