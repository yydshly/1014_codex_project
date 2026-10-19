const str = {type:'string'};
const strings = {type:'array',items:str};
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array = items => ({type:'array',items});
const kind = {type:'string',enum:['observed','user_self_report','vendor_claim','inferred']};
export const referenceSchema = object({source_id:str,quote:str,role:{type:'string',enum:['support','counter']}});
export const evidenceSchema = object({evidence:array(object({source_id:str,quote:str,summary:str,kind,role:{type:'string',enum:['support','counter']}})),limitations:strings});
export const analysisSchema = object({scope:str,findings:array(object({statement:str,kind,references:array(referenceSchema),unknowns:strings,next_validation:str})),limitations:strings});
export function validateShape(value,schema,at='$') {
  if(schema.type==='object') {
    if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(`${at} 应为对象`);
    for(const key of schema.required) if(!(key in value)) throw new Error(`${at}.${key} 缺失`);
    for(const [key,v] of Object.entries(value)) {if(!schema.properties[key])throw new Error(`${at}.${key} 为未知字段`);validateShape(v,schema.properties[key],`${at}.${key}`);}
  } else if(schema.type==='array') {
    if(!Array.isArray(value) || value.length>40)throw new Error(`${at} 应为不超过 40 项的数组`);
    value.forEach((v,i)=>validateShape(v,schema.items,`${at}[${i}]`));
  } else if(schema.type==='string' && (typeof value!=='string' || value.length>8000)) throw new Error(`${at} 应为不超过 8000 字的文本`);
  if(schema.enum && !schema.enum.includes(value)) throw new Error(`${at} 的取值无效`);
  return value;
}
