export const plans = [
  {
    id: 'vip-1',
    name: 'Eco-Basico (VIP 1)',
    subtitle: 'Ideal para quienes estan comenzando en el mundo de las inversiones sustentables.',
    range: '$40.00 - $200.00 USD',
    dailyReturn: '25%',
    term: '365 dias',
    benefit: 'Acreditacion diaria automatica a su balance principal.',
    accent: 'low'
  },
  {
    id: 'vip-2',
    name: 'Plan Eco-Pro',
    subtitle: 'Disenado para inversores que buscan un crecimiento acelerado con una tasa preferencial.',
    range: '$400.00 - $800.00 USD',
    dailyReturn: '25%',
    term: '365 dias',
    benefit: 'Acceso a reportes de impacto ambiental de sus proyectos financiados.',
    accent: 'mid'
  },
  {
    id: 'vip-3',
    name: 'Plan Eco-Elite',
    subtitle: 'Nuestra tasa de retorno mas alta, pensada para capitales institucionales o inversores serios.',
    range: '$1500.00 USD - $3000.00 USD en adelante',
    dailyReturn: '25%',
    term: '365 dias',
    benefit: 'Soporte prioritario 24/7 y retiros procesados en menor tiempo.',
    accent: 'high'
  }
];

export const company = {
  name: 'Eco Negocios & Inversiones',
  tagline: 'Eco-inversiones globales para proyectos sustentables',
  mission:
    'Capitalizar en proyectos sustentables y generar rendimientos diarios con un impacto positivo en el planeta.',
  about:
    'Eco Negocios & Inversiones es una plataforma de gestion de activos dedicada a conectar el capital privado con proyectos de infraestructura de energia renovable en todo el mundo. Creemos que el crecimiento economico debe ir de la mano con el cuidado del medio ambiente.',
  trust:
    'Operamos con total transparencia en la gestion de capitales, garantizando que cada dolar invertido contribuya a un planeta mas limpio y a una billetera mas solida para nuestros usuarios.',
  phone: '+593983538127',
  email: 'Francis67calisto@gmail.com',
  location: 'Ecuador'
};

export const plansUrl = 'https://ecologyinvestment-astro.vercel.app/planes';

export const metrics = [
  { value: '3', label: 'niveles de participacion escalables' },
  { value: '25%', label: 'retorno diario proyectado en todos los planes' },
  { value: '365', label: 'dias de plazo por ciclo de inversion' }
];

export const highlights = [
  'Portafolio orientado a infraestructura de energia renovable',
  'Participacion desde montos accesibles hasta perfiles institucionales',
  'Operacion clara, soporte cercano y seguimiento del capital'
];

export const faqs = [
  {
    question: 'Como se generan mis ganancias diarias?',
    answer:
      'Sus beneficios provienen del financiamiento directo que EcoNegocios realiza en proyectos de energia renovable, principalmente solar y eolica. El flujo de caja generado por la venta de energia limpia se distribuye proporcionalmente entre los socios inversores de forma automatica cada 24 horas.'
  },
  {
    question: 'Cual es el monto minimo para invertir y retirar?',
    answer:
      'El plan de entrada comienza desde $40 USD. Para revisar montos, condiciones operativas y proceso de retiro, la pagina dirige al usuario a la seccion de planes y al canal de contacto directo.'
  },
  {
    question: 'Que tan seguras son mis inversiones en la plataforma?',
    answer:
      'La comunicacion de la marca enfatiza seguimiento del capital, panel de usuario y soporte cercano. La propuesta se presenta alrededor de proyectos reales de energia limpia y una experiencia de gestion mas transparente.'
  }
];

export const testimonials = [
  {
    name: 'Carlos M.',
    quote:
      'Al principio tenia dudas, pero despues de activar mi primer plan de $100, empece a ver los intereses en mi saldo cada manana sin falta. Ya he realizado tres retiros exitosos directamente a mi cuenta. Es una excelente forma de hacer crecer los ahorros mientras apoyamos la energia limpia.'
  },
  {
    name: 'Elena R.',
    quote:
      'Lo que mas me gusta de EcoNegocios es la transparencia. El panel de usuario es muy facil de usar y puedo ver como mi capital genera rendimientos diarios. Empece con el minimo y ahora ya estoy reinvirtiendo mis ganancias para subir de nivel.'
  },
  {
    name: 'Jorge L.',
    quote:
      'He probado muchas plataformas, pero ninguna con la solidez de EcoNegocios. Saber que mi dinero esta respaldado por proyectos de paneles solares reales me da la tranquilidad que buscaba. El soporte al cliente es rapido y los pagos son puntuales.'
  }
];
