const string = { type: 'string' };
const strings = { type: 'array', items: string };
const object = properties => ({ type:'object', properties, required:Object.keys(properties), additionalProperties:false });
export const sourceSchema = object({url:string,title:string,kind:string,claim:string,quote:string,location:string,access:string,date_basis:string});
const sources = { type:'array',items:sourceSchema };
const solution = object({name:string,description:string,url:string});
export const candidateSchema = object({id:string,audience_id:string,audience:string,problem:string,context:string,obstacle:string,impact:string,evidence_urls:strings,existing_solutions:{type:'array',items:solution},unknowns:strings,next_question:string,decision:{type:'string',enum:['继续调查','优先核实','暂时搁置','证据不足']},reason:string});
const candidates = { type:'array',items:candidateSchema };
export const schemas = {
  people:object({summary:string,people:{type:'array',items:object({id:string,label:string,task:string,context:string,why:string,source_urls:strings,next_question:string})},next_focus:object({audience_id:string,question:string,reason:string}),sources,limitations:strings}),
  problems:object({summary:string,candidates,focus_ids:strings,sources,limitations:strings}),
  investigate:object({summary:string,candidates,sources,limitations:strings,decisions:{type:'array',items:object({candidate_id:string,decision:string,reason:string,next_step:string})}}),
};
