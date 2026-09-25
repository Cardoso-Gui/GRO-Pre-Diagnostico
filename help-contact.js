// WhatsApp do administrador, com país e DDD, apenas números.
export const ADMIN_WHATSAPP = '5517991951286';

const dialog = document.querySelector('#contact-dialog');
const title = document.querySelector('#contact-title');
const description = document.querySelector('#contact-description');
const whatsapp = document.querySelector('#contact-whatsapp');
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
    description.textContent = content.description;
    if (ADMIN_WHATSAPP) whatsapp.href = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(content.message)}`;
    whatsapp.hidden = !ADMIN_WHATSAPP;
    dialog.showModal();
  });
}
document.querySelector('#contact-close').addEventListener('click', () => dialog.close());
document.querySelector('#contact-back').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

