'use strict';
const agents=[
 {id:'milestones',name:'人生节点',description:'在重要年龄节点，递来下一步需要的信息。',color:'#b6cbff',icon:'spark'},
 {id:'credentials',name:'证照与资格',description:'证件临期、资格复核、年检，提前安排。',color:'#8bdbcf',icon:'card'},
 {id:'benefits',name:'补贴与待遇',description:'发现待核实的支持，关注认证与到账记录。',color:'#ead6a2',icon:'wallet'},
 {id:'health',name:'健康与安全',description:'跟进已安排的随访，及时递送已报告的异常。',color:'#f4adb7',icon:'heart'},
 {id:'living',name:'生活与公共服务',description:'缴费、供暖、入学，把截止日期放在心上。',color:'#bdb4f8',icon:'home'},
 {id:'care',name:'特别关怀',description:'换证、探访、儿童关爱，形成可跟进的待办。',color:'#a9d2ab',icon:'leaf'}
];
const adulthood={title:'中华人民共和国民法典第十七条',url:'https://www.court.gov.cn/zixun/xiangqing/233181.html',scope:'十八周岁成年年龄节点；不推定其他民事能力或待遇资格'};
const elder={title:'中华人民共和国老年人权益保障法第二条',url:'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_3c63a2ea4deb48c3810cfe7390a591e8.html',scope:'六十周岁老年人年龄定义；不是地方老年证、优待证或津贴申领条件'};
function row(id,agent,title,trigger,description,action,extra={}){return{id,agent,title,trigger,description,action,materials:[],sources:[],localRule:'具体条件、办理窗口与材料以所在地区现行官方规则为准。',...extra}}
const scenarios=[
 row('adult-18','milestones','18 岁成年提醒','milestone','在本人或已获授权家庭成员年满18岁时，递送成年事项提示。','了解成年后的办事与个人授权事项',{age:18,sources:[adulthood],localRule:'不从身份证号码解析生日，不自动授予或变更业务权限。'}),
 row('senior-card','milestones','60 岁养老服务提示','milestone','年满60岁时，提示核实本地老年证及适老服务。','核对所在地区老年证办理条件',{age:60,sources:[elder]}),
 row('preferential-card','milestones','优待服务办理提示','milestone','年满60岁时，提示了解所在地适老优待项目。','核对本地优待项目及适用人群',{age:60,sources:[elder],localRule:'不将60岁等同于所有优待证资格；退役军人等优待证须另核身份条件。'}),
 row('identity-renewal','credentials','身份证换证','due','按已登记有效期，提前提醒换证。','查看换证材料与官方办理渠道'),
 row('driving-renewal','credentials','驾驶证换证','due','按已登记有效期提示换证，不自行推定可驾驶资格。','核实交管部门当前换证要求'),
 row('residence-renewal','credentials','居住证续签','due','按当地签注或有效期限，提醒续签与材料准备。','核对当地签注及续办要求'),
 row('housing-review','credentials','保障房资格年审','window','在已核实的复核窗口开启及截止前提醒。','按本次年审清单准备材料'),
 row('farm-inspection','credentials','农机年检','due','按登记的检验日期提示年检。','核对检验地点、预约及材料'),
 row('vessel-inspection','credentials','渔船年检','due','按登记的船舶检验日期提示办理。','向主管机构核实本次检验安排'),
 row('senior-allowance','benefits','高龄津贴主动发现','event','收到已授权的资格待核实事件后，提醒核验本地条件。','核实年龄、户籍和当地津贴规则',{eventType:'eligibility_candidate',task:'待遇资格核验',localRule:'本系统不审批资格、不发钱；免申即享须由具备权限的业务系统办理。'}),
 row('subsistence-review','benefits','低保待遇复核','window','按已确认的复核时间递送材料准备提醒。','核对本次收入及家庭情况材料'),
 row('special-support-review','benefits','特困供养复核','window','在登记的复核期内提醒并提供材料记录。','核实当地复核和提交方式'),
 row('agriculture-payment','benefits','农业补贴到账记录','event','收到发放渠道回执或本人记录后提示核对。','核对发放批次及实际收款记录',{eventType:'payment_receipt'}),
 row('heating-payment','benefits','取暖补贴到账记录','event','按已收到的到账信息，提醒本人核对。','核对补贴批次与实际到账情况',{eventType:'payment_receipt'}),
 row('disability-payment','benefits','残疾补贴到账记录','event','对已收到的补贴发放记录进行提醒。','核对发放信息，发现差异向正式渠道查询',{eventType:'payment_receipt'}),
 row('pension-certification','benefits','养老金资格认证','window','认证窗口开启和截止前分阶段提醒。','通过已核实的官方入口完成认证'),
 row('chronic-followup','health','慢病随访与异常线索','recurring','按医护人员已安排的随访时间提醒；已授权异常事件另行递送。','联系原随访团队核对安排',{eventType:'health_concern',task:'健康线索待联系',localRule:'不设置通用诊断阈值，不诊断、不调整药物；异常需由医护人员判断。'}),
 row('prenatal-visit','health','产检预约','due','按已预约的产检日期提醒，不自行计算医疗程序。','向预约机构核对时间和材料'),
 row('child-vaccination','health','儿童接种预约','due','按接种机构已安排的日期提醒。','核对接种门诊预约及接种禁忌咨询'),
 row('elder-safety','health','独居老人安全线索','event','接收已授权设备或本人报告的摔倒、静止等异常线索。','及时核查本人情况并联系正式救援或照护渠道',{eventType:'safety_alert',task:'安全线索待核查',urgent:true}),
 row('gas-safety','health','燃气异常线索','event','接收已授权设备或本人报告的燃气隐患。','尽快联系当地燃气应急或正式救援渠道',{eventType:'safety_alert',task:'燃气隐患待核查',urgent:true}),
 row('fire-safety','health','消防异常线索','event','接收已授权烟感或本人报告的消防隐患。','优先保障人身安全，联系正式救援渠道',{eventType:'safety_alert',task:'消防隐患待核查',urgent:true}),
 row('water-payment','living','水费与阶梯价提醒','due','按账单缴费日提醒；收到已授权阶梯价事件时提示核对。','核对供水单位账单与官方缴费入口',{eventType:'tier_notice'}),
 row('electricity-payment','living','电费与阶梯价提醒','due','按账单缴费日提醒；不从其他账户推测用电情况。','核对供电单位账单与官方缴费入口',{eventType:'tier_notice'}),
 row('gas-payment','living','燃气费与阶梯价提醒','due','按已登记缴费日及已授权阶梯信息提醒。','核对燃气单位账单与官方缴费入口',{eventType:'tier_notice'}),
 row('heating-switch','living','供暖报停与恢复','window','按已核实的报停或恢复办理窗口提醒。','向供暖单位核对截止日期和办理方式'),
 row('school-enrollment','living','义务教育报名','window','按家庭自行登记或已授权的报名安排提醒。','核对当年本地入学规则、材料和入口',{localRule:'不根据年龄或地址自动认定学区、学位或录取资格。'}),
 row('public-housing-rent','living','公租房租金','recurring','按租约约定的缴费日提醒，周期由本人登记。','核对租约、租金与正式缴费渠道'),
 row('disability-renewal','care','残疾人证换证','due','按已登记有效期提醒换证与预约咨询。','核实当地换证流程及是否提供上门评残'),
 row('elder-visits','care','老人定期探访','recurring','按已获授权、已安排的探访周期生成待办。','由工作人员核对探访意愿与服务安排',{task:'探访安排待确认',localRule:'不以年龄直接认定失能或特困；待办并不代表真实网格员已经接单。'}),
 row('child-care','care','留守儿童关爱','window','按监护人授权和已登记的开学、假期节点提醒。','核实监护人意愿和当地关爱活动',{task:'儿童关爱待联系',localRule:'只使用监护人授权的最少资料，不推断或公开儿童家庭处境。'})
];
module.exports={agents,scenarios};
