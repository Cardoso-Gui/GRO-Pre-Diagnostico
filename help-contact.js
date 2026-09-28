// WhatsApp do administrador, com país e DDD, apenas números.
export const ADMIN_WHATSAPP = '5517991951286';

const dialog = document.querySelector('#contact-dialog');
const title = document.querySelector('#contact-title');
const description = document.querySelector('#contact-description');
const whatsapp = document.querySelector('#contact-whatsapp');
const recovery=document.querySelector('#recovery-form'), userInput=document.querySelector('#recovery-user'), send=document.querySelector('#recovery-send');
function updateRecovery(){
 const user=userInput.value.trim();send.disabled=!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(user);
 const message=document.querySelector('#recovery-message');message.replaceChildren();
 if(user){const strong=document.createElement('strong');strong.textContent=user;message.append('Olá! Esqueci minha senha do GRO. Meu usuário é ',strong,'. Pode me ajudar a recuperar o acesso?');}
 else message.textContent='Informe seu usuário para visualizar a mensagem.';
}
userInput.addEventListener('input',updateRecovery);
recovery.addEventListener('submit',event=>{event.preventDefault();updateRecovery();if(send.disabled||!recovery.reportValidity())return;const message=`Olá! Esqueci minha senha do GRO. Meu usuário é *${userInput.value.trim()}*. Pode me ajudar a recuperar o acesso?`;window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');});
const messages = {
  'password-help': {
    title: 'Vamos recuperar seu acesso.',
    description: 'Entre em contato com o administrador do sistema para solicitar a redefinição da sua senha.',
    message: 'Olá! Esqueci minha senha de acesso ao GRO. Pode me ajudar a redefini-la?'
  },
  'request-access': {
    title: 'Seu acesso começa aqui.',
    description: 'Entre em contato com o administrador do sistema para solicitar seu usuário e a liberação de acesso ao GRO.',
    message: 'Olá! Gostaria de solicitar meu acesso ao sistema GRO. Pode me ajudar?'
  }
};

for (const [id, content] of Object.entries(messages)) {
  document.getElementById(id).addEventListener('click', () => {
    title.textContent = content.title;
    description.textContent = id==='password-help'?'Informe seu usuário para solicitar ajuda ao administrador.':content.description;
    if (ADMIN_WHATSAPP) whatsapp.href = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(content.message)}`;
    recovery.hidden=id!=='password-help';
    whatsapp.hidden = !ADMIN_WHATSAPP || id==='password-help';
    if(id==='password-help'){userInput.value=document.querySelector('#username')?.value.trim()||'';updateRecovery();}
    dialog.showModal();
  });
}
document.querySelector('#contact-close').addEventListener('click', () => dialog.close());
document.querySelector('#contact-back').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
