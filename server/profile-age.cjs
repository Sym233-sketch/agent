'use strict';
const birthday=require('./birthday.cjs');
function value(profile,day=birthday.today()){
 if(profile.birthDate)return birthday.age(profile.birthDate,day);
 // Older profiles have no birth date. Zero can be an old empty-value coercion.
 return Number.isInteger(profile.age)&&profile.age>0&&profile.age<=130?profile.age:null;
}
function field(profile,day=birthday.today()){
 const age=value(profile,day);if(age===null)return{value:null,source:null,evidence:null};
 return{value:age===0?'未满1周岁':String(age),source:profile.birthDate?'birth-date':'profile',evidence:profile.birthDate?'根据本人登记的出生日期计算周岁，截至'+day:'本人此前登记的年龄，尚待核实'};
}
module.exports={value,field};
