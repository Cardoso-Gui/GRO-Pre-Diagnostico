// Professional identity is independent of authorization (admin/editor).
// Registration is declared by the administrator, not verified with a council.
export const PROFESSIONAL_ROLES=Object.freeze({
 safety_technician:'Técnico de Segurança do Trabalho',
 safety_engineer:'Engenheiro de Segurança do Trabalho',
 safety_assistant:'Auxiliar de Segurança do Trabalho'
});
export const REGISTRATION_UFS=Object.freeze(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
export function professionalRoleLabel(role){return Object.hasOwn(PROFESSIONAL_ROLES,role)?PROFESSIONAL_ROLES[role]:'Função profissional não informada';}
export function professionalRegistrationLabel(member){
 const number=String(member?.professional_registration||'').trim();
 if(!number)return '';
 if(member.professional_role==='safety_technician')return 'Registro MTE: '+number;
 if(member.professional_role==='safety_engineer')return 'CREA'+(member.professional_registration_uf?'/'+member.professional_registration_uf:'')+': '+number;
 return '';
}
export function isEligibleProfessional(member){
 if(!member?.active||!String(member.display_name||'').trim()||!String(member.professional_registration||'').trim())return false;
 if(member.professional_role==='safety_technician')return true;
 return member.professional_role==='safety_engineer'&&REGISTRATION_UFS.includes(member.professional_registration_uf);
}
export function reportProfessionalIdentity(assessment){
 const identity=assessment?.final_snapshot?.responsible_professional;
 // Never enrich a preserved/legacy report with today's professional credentials.
 if(identity&&typeof identity==='object')return {
  name:String(identity.display_name||'').trim()||'Responsável não disponível',
  role:professionalRoleLabel(identity.professional_role),
  registration:professionalRegistrationLabel({professional_role:identity.professional_role,professional_registration:identity.registration_number,professional_registration_uf:identity.registration_uf}),
  frozen:true
 };
 return {name:assessment?.team_members?.display_name?.trim()||'',role:'',registration:'',frozen:false};
}
