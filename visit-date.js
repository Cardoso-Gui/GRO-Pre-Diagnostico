// A visit date is an explicit calendar date, never a timestamp or inferred date.
(function(global){
 function normalize(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1)return '';
  const date=new Date(value+'T12:00:00Z');
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value?value:'';
 }
 const read=answers=>normalize(answers?.visitDate??answers?.visit_date);
 const format=answers=>{const value=read(answers);return value?value.split('-').reverse().join('/'):'Não informada';};
 const invalidField=field=>Boolean(field?.validity?.badInput||(field?.value&&!normalize(field.value)));
 global.GRO_VISIT_DATE=Object.freeze({normalize,read,format,invalidField});
})(globalThis);
