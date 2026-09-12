export type Point = { x: number; y: number; z: number; visibility?: number };
export type Frame = {
  p: Point[];
  l: Point[];
  r: Point[];
  f?: Point[];
  t: number;
  aspect: number;
};
export type Reference = {
  id: string;
  label: string;
  frames: Frame[];
  fps: number;
  duration: number;
  source: string;
};
export const lessons = [
  {
    id: "0030",
    label: "Hola",
    hint: "Una seña para abrir una conversación.",
    group: "Primer encuentro",
  },
  {
    id: "0000",
    label: "Gracias",
    hint: "Un pequeño gesto de agradecimiento.",
    group: "Primer encuentro",
  },
  {
    id: "0032",
    label: "Por favor",
    hint: "Pide algo con amabilidad.",
    group: "Primer encuentro",
  },
  {
    id: "0031",
    label: "Adiós",
    hint: "Hasta la próxima conversación.",
    group: "Primer encuentro",
  },
  {
    id: "0038",
    label: "Yo",
    hint: "Empieza a hablar de ti.",
    group: "Conocernos",
  },
  {
    id: "0039",
    label: "Tú",
    hint: "Dirígete a la otra persona.",
    group: "Conocernos",
  },
  {
    id: "0005",
    label: "Nombre",
    hint: "El primer paso para presentarte.",
    group: "Conocernos",
  },
  {
    id: "0026",
    label: "¿Cómo estás?",
    hint: "Abre espacio para escuchar.",
    group: "Conocernos",
  },
  {
    id: "0024",
    label: "Bien",
    hint: "Comparte cómo te sientes.",
    group: "Conocernos",
  },
  {
    id: "0001",
    label: "Buenos días",
    hint: "Empieza el día conectando.",
    group: "Conocernos",
  },
];
