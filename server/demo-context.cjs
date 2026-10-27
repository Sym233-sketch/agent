'use strict';
const context={mode:'fictional-demo',region:'汉东省武畔市',district:'汉东省武畔市',office:'武畔市虚拟政务服务中心',community:'武畔市春和社区（虚构）',notice:'汉东省武畔市及本地机构、业务条件、材料和受理结果均为虚构演示，不对应真实行政区或服务。'};
const fact=value=>({value,source:'demo',evidence:'用户指定的汉东省武畔市虚构演示配置，非本人真实资料'});
const instructions='当前运行汉东省武畔市虚构业务演示。不要再询问省、市、区、街道、户籍、参保地或真实联系地址。统一使用 demoContext 中的虚构地区和机构。业务条件、办理地点、材料样例和服务时间用系统提供的虚构示例走通，不要要求用户补齐现实业务信息。不要联网查找这个不存在的地区，也不要给虚构机构配真实官网或电话。真实全国政策只能标为背景参考，不能称为武畔市现行政策。个人年龄、收入、疾病和家庭身份未提供时保持未知，不把虚构配置当成真实档案。虚构业务资料标注“虚构演示”，技术错误仍如实报告。优先自动准备演示资料并交用户确认，保留用户修改和最后点击提交。';
function apply(c){if(!c.demoContext)c.demoContext={...context};c.facts.district=fact(context.region);return c}
function adaptReply(text){let replaced=false;return String(text||'').split(/(?<=[。！？?\n])/u).map(sentence=>{if(/API|密钥|模型连接|服务器|网络|部署|超时|配置/.test(sentence))return sentence;if(/哪个|哪一|什么市|什么区|在哪|请|告诉|补充|提供|填写/.test(sentence)&&/市|区|省|街道|地址|户籍|参保地|学校名称|证明|证件|银行卡|病历/.test(sentence)){if(replaced)return '';replaced=true;return '本次使用汉东省武畔市的虚构业务资料，相关演示材料由系统准备，不需要补充现实信息。'}return sentence}).join('')}
function organization(kind){const names={paperwork:'武畔市春和社区便民帮办站',emotional:'武畔市春和社区社会工作服务站',companionship:'武畔市春和社区关爱服务站',caregiver:'武畔市春和社区照护支持中心',meals:'武畔市春和社区助餐服务点',mobility:'武畔市春和社区助行服务站'};return{name:(names[kind]||names.paperwork)+'（虚构）',address:'汉东省武畔市春和社区便民服务中心（虚构地址）',hours:'演示安排：工作日 09:00—17:00',coverage:'武畔市春和社区（虚构服务范围）',fees:'演示项目不收取费用；不代表现实服务价格',channel:'站内模拟联系，无真实电话或外部派单'}}
module.exports={context,fact,instructions,apply,organization,adaptReply};
